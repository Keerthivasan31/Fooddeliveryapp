const express = require('express');
const axios = require('axios');
const { v4: uuidv4 } = require('uuid');
const logger = require('../utils/logger');

const router = express.Router();

// -----------------------------------------------------------------------------
// SAFE DEMO PAYMENT GATEWAY
// -----------------------------------------------------------------------------
// This service intentionally NEVER contacts a bank, card network, Stripe,
// Razorpay, or any other real payment processor. It only simulates the
// lifecycle of a card payment using deterministic test card numbers.
//
// Full card numbers and CVVs are NEVER stored. Only the last four digits are
// retained for the demo receipt.
// -----------------------------------------------------------------------------

const payments = new Map();
const idempotency = new Map();

const ORDER_SERVICE_URL =
  process.env.ORDER_SERVICE_URL || 'http://order-service:4000';

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const TEST_CARDS = Object.freeze({
  '4242424242424242': {
    status: 'SUCCEEDED',
    code: 'APPROVED',
    message: 'Test payment approved'
  },
  '4000000000000002': {
    status: 'FAILED',
    code: 'CARD_DECLINED',
    message: 'Test card was declined'
  },
  '4000000000009995': {
    status: 'FAILED',
    code: 'INSUFFICIENT_FUNDS',
    message: 'Test card has insufficient funds'
  },
  '4000000000009987': {
    status: 'FAILED',
    code: 'PROCESSING_ERROR',
    message: 'Test payment processor error'
  }
});

function cleanCardNumber(value) {
  return String(value || '').replace(/\D/g, '');
}

function luhnCheck(number) {
  let sum = 0;
  let doubleDigit = false;
  for (let i = number.length - 1; i >= 0; i -= 1) {
    let digit = Number(number[i]);
    if (doubleDigit) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
    doubleDigit = !doubleDigit;
  }
  return sum % 10 === 0;
}

function maskCard(last4) {
  return `**** **** **** ${last4}`;
}

function validateCard({ cardNumber, expiry, cvv, cardholderName }) {
  const number = cleanCardNumber(cardNumber);
  const expiryValue = String(expiry || '').trim();
  const cvvValue = String(cvv || '').trim();
  const name = String(cardholderName || '').trim();

  if (!TEST_CARDS[number]) {
    return {
      ok: false,
      error:
        'Use one of the supported TEST card numbers. No real card is accepted.'
    };
  }

  if (number.length !== 16 || !luhnCheck(number)) {
    return { ok: false, error: 'Test card number is invalid.' };
  }

  if (!/^(0[1-9]|1[0-2])\/\d{2}$/.test(expiryValue)) {
    return { ok: false, error: 'Expiry must use MM/YY format.' };
  }

  const [month, year] = expiryValue.split('/').map(Number);
  const now = new Date();
  const currentYear = now.getFullYear() % 100;
  const currentMonth = now.getMonth() + 1;
  if (year < currentYear || (year === currentYear && month < currentMonth)) {
    return { ok: false, error: 'Test card has expired.' };
  }

  if (!/^\d{3}$/.test(cvvValue)) {
    return { ok: false, error: 'CVV must contain 3 digits.' };
  }

  if (name.length < 2) {
    return { ok: false, error: 'Cardholder name is required.' };
  }

  return {
    ok: true,
    number,
    last4: number.slice(-4),
    scenario: TEST_CARDS[number]
  };
}

async function getOrder(orderId) {
  const response = await axios.get(`${ORDER_SERVICE_URL}/api/orders/${orderId}`);
  return response.data;
}

async function updateOrderPayment(orderId, paymentStatus) {
  try {
    await axios.patch(`${ORDER_SERVICE_URL}/api/orders/${orderId}/payment`, {
      paymentStatus
    });
  } catch (err) {
    logger.error('Failed to notify order-service of payment status', {
      orderId,
      paymentStatus,
      error: err.message
    });
    throw err;
  }
}

function publicPayment(payment) {
  return {
    id: payment.id,
    orderId: payment.orderId,
    amount: payment.amount,
    currency: payment.currency,
    method: payment.method,
    cardLast4: payment.cardLast4,
    cardBrand: payment.cardBrand,
    status: payment.status,
    outcomeCode: payment.outcomeCode || null,
    message: payment.message || null,
    transactionId: payment.transactionId || null,
    createdAt: payment.createdAt,
    processedAt: payment.processedAt || null,
    refundedAt: payment.refundedAt || null,
    mode: 'TEST'
  };
}

// Health/demo information only. It exposes no secrets or real payment data.
router.get('/test-cards', (req, res) => {
  res.json({
    mode: 'TEST',
    message: 'These are simulated cards. No real payment is processed.',
    cards: [
      { number: '4242 4242 4242 4242', outcome: 'SUCCESS', code: 'APPROVED' },
      { number: '4000 0000 0000 0002', outcome: 'DECLINED', code: 'CARD_DECLINED' },
      { number: '4000 0000 0000 9995', outcome: 'FAILED', code: 'INSUFFICIENT_FUNDS' },
      { number: '4000 0000 0000 9987', outcome: 'FAILED', code: 'PROCESSING_ERROR' }
    ]
  });
});

// Create a payment intent. The amount is checked against the order service so
// the browser cannot simply change the amount it wants to pay.
router.post('/intents', async (req, res) => {
  const {
    orderId,
    amount,
    currency = 'USD',
    cardNumber,
    expiry,
    cvv,
    cardholderName
  } = req.body;

  if (!orderId || !UUID_PATTERN.test(String(orderId))) {
    return res.status(400).json({ error: 'A valid orderId is required.' });
  }

  const numericAmount = Number(amount);
  if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
    return res.status(400).json({ error: 'Amount must be greater than zero.' });
  }

  if (currency !== 'USD') {
    return res.status(400).json({ error: 'Only USD is supported in TEST mode.' });
  }

  const card = validateCard({ cardNumber, expiry, cvv, cardholderName });
  if (!card.ok) return res.status(400).json({ error: card.error });

  try {
    const order = await getOrder(orderId);
    const orderAmount = Number(order.total_amount);

    if (!Number.isFinite(orderAmount) || Math.abs(orderAmount - numericAmount) > 0.001) {
      return res.status(409).json({
        error: 'Payment amount does not match the order total.'
      });
    }

    if (order.payment_status === 'SUCCESS') {
      return res.status(409).json({ error: 'This order is already paid.' });
    }

    const key = req.get('Idempotency-Key');
    if (key && idempotency.has(key)) {
      return res.json(publicPayment(idempotency.get(key)));
    }

    const payment = {
      id: uuidv4(),
      orderId,
      amount: Number(numericAmount.toFixed(2)),
      currency,
      method: 'CARD',
      cardLast4: card.last4,
      cardBrand: 'TEST-VISA',
      status: 'REQUIRES_CONFIRMATION',
      outcomeCode: null,
      message: 'Test payment is ready for confirmation.',
      createdAt: new Date().toISOString(),
      processedAt: null,
      refundedAt: null,
      _testScenario: card.scenario
    };

    payments.set(payment.id, payment);
    if (key) idempotency.set(key, payment);

    logger.info('Test payment intent created', {
      paymentId: payment.id,
      orderId,
      amount: payment.amount,
      cardLast4: payment.cardLast4
    });

    return res.status(201).json(publicPayment(payment));
  } catch (err) {
    logger.error('Failed to create test payment intent', {
      error: err.message,
      orderId
    });
    return res.status(502).json({
      error: 'Could not verify the order with the order service.'
    });
  }
});

// Confirm a test payment. This deliberately waits briefly so the UI can show
// a realistic PROCESSING state.
router.post('/:id/confirm', async (req, res) => {
  const payment = payments.get(req.params.id);
  if (!payment) return res.status(404).json({ error: 'Payment not found.' });

  if (payment.status === 'SUCCEEDED') {
    return res.json(publicPayment(payment));
  }

  if (payment.status === 'REFUNDED') {
    return res.status(409).json({ error: 'A refunded payment cannot be confirmed.' });
  }

  payment.status = 'PROCESSING';
  payment.message = 'Test payment is being processed.';
  payments.set(payment.id, payment);

  try {
    await updateOrderPayment(payment.orderId, 'PROCESSING');

    await new Promise((resolve) => setTimeout(resolve, 1200));

    const scenario = payment._testScenario;
    payment.status = scenario.status;
    payment.outcomeCode = scenario.code;
    payment.message = scenario.message;
    payment.processedAt = new Date().toISOString();

    if (scenario.status === 'SUCCEEDED') {
      payment.transactionId = `TEST-TXN-${uuidv4().slice(0, 8).toUpperCase()}`;
      await updateOrderPayment(payment.orderId, 'SUCCESS');
    } else {
      await updateOrderPayment(payment.orderId, 'FAILED');
    }

    payments.set(payment.id, payment);

    logger.info('Test payment completed', {
      paymentId: payment.id,
      orderId: payment.orderId,
      status: payment.status,
      outcomeCode: payment.outcomeCode
    });

    const result = publicPayment(payment);
    return res.status(payment.status === 'SUCCEEDED' ? 200 : 402).json(result);
  } catch (err) {
    payment.status = 'FAILED';
    payment.outcomeCode = 'SERVICE_ERROR';
    payment.message = 'The test payment service could not complete the simulation.';
    payment.processedAt = new Date().toISOString();
    payments.set(payment.id, payment);

    try {
      await updateOrderPayment(payment.orderId, 'FAILED');
    } catch (_) {
      // The original service error is already being returned.
    }

    logger.error('Test payment confirmation failed', {
      paymentId: payment.id,
      error: err.message
    });

    return res.status(502).json({
      error: 'Test payment service error.',
      payment: publicPayment(payment)
    });
  }
});

// Backwards-compatible one-call endpoint used by older clients.
router.post('/charge', async (req, res) => {
  const {
    orderId,
    amount,
    cardNumber = '4242424242424242',
    expiry = '12/30',
    cvv = '123',
    cardholderName = 'Test Customer'
  } = req.body;

  try {
    const intentResponse = await axios.post(
      `${req.protocol}://${req.get('host')}/api/payments/intents`,
      { orderId, amount, currency: 'USD', cardNumber, expiry, cvv, cardholderName },
      { headers: req.get('Idempotency-Key') ? { 'Idempotency-Key': req.get('Idempotency-Key') } : {} }
    );

    const confirmed = await axios.post(
      `${req.protocol}://${req.get('host')}/api/payments/${intentResponse.data.id}/confirm`
    );

    return res.status(confirmed.status).json(confirmed.data);
  } catch (err) {
    const status = err.response?.status || 500;
    return res.status(status).json(err.response?.data || { error: err.message });
  }
});

router.get('/order/:orderId', (req, res) => {
  const records = [...payments.values()]
    .filter((payment) => payment.orderId === req.params.orderId)
    .map(publicPayment)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  res.json(records);
});

router.get('/:id', (req, res) => {
  const payment = payments.get(req.params.id);
  if (!payment) return res.status(404).json({ error: 'Payment not found.' });
  res.json(publicPayment(payment));
});

router.post('/:id/refund', async (req, res) => {
  const payment = payments.get(req.params.id);
  if (!payment) return res.status(404).json({ error: 'Payment not found.' });

  if (payment.status !== 'SUCCEEDED') {
    return res.status(409).json({ error: 'Only successful payments can be refunded.' });
  }

  payment.status = 'REFUNDED';
  payment.message = 'Test refund completed.';
  payment.refundedAt = new Date().toISOString();
  payments.set(payment.id, payment);

  try {
    await updateOrderPayment(payment.orderId, 'REFUNDED');
  } catch (err) {
    return res.status(502).json({
      error: 'Refund simulated, but order status could not be updated.'
    });
  }

  res.json(publicPayment(payment));
});

module.exports = router;

const express = require("express");
const { v4: uuidv4 } = require("uuid");
const pool = require("../db/pool");
const logger = require("../utils/logger");
const { publishOrderEvent } = require("../utils/sns");

const router = express.Router();

// Create a new order
router.post("/", async (req, res) => {
  const { customerId, restaurantId, items, totalAmount, deliveryAddress } =
    req.body;

  if (
    !customerId ||
    !restaurantId ||
    !Array.isArray(items) ||
    items.length === 0 ||
    totalAmount === undefined ||
    totalAmount === null ||
    !deliveryAddress
  ) {
    return res.status(400).json({ error: "Missing required order fields" });
  }

  const uuidPattern =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (
    !uuidPattern.test(String(customerId)) ||
    !uuidPattern.test(String(restaurantId))
  ) {
    return res
      .status(400)
      .json({ error: "customerId and restaurantId must be valid UUIDs" });
  }

  const numericTotal = Number(totalAmount);
  if (!Number.isFinite(numericTotal) || numericTotal <= 0) {
    return res
      .status(400)
      .json({ error: "totalAmount must be a positive number" });
  }

  const id = uuidv4();
  try {
    const result = await pool.query(
      `INSERT INTO orders (id, customer_id, restaurant_id, items, total_amount, delivery_address)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [
        id,
        customerId,
        restaurantId,
        JSON.stringify(items),
        numericTotal,
        String(deliveryAddress).trim(),
      ],
    );

    const order = result.rows[0];
    logger.info("Order created", { orderId: id });

    // Fire-and-forget notification via SNS -> triggers Lambda for downstream automation
    publishOrderEvent("ORDER_PLACED", order).catch((err) =>
      logger.error("Failed to publish SNS event", { error: err.message }),
    );

    res.status(201).json(order);
  } catch (err) {
    logger.error("Failed to create order", { error: err.message });
    res.status(500).json({ error: "Internal server error" });
  }
});

// Get order by id
router.get("/:id", async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM orders WHERE id = $1", [
      req.params.id,
    ]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Order not found" });
    }
    res.json(result.rows[0]);
  } catch (err) {
    logger.error("Failed to fetch order", { error: err.message });
    res.status(500).json({ error: "Internal server error" });
  }
});

// List orders for a customer
router.get("/", async (req, res) => {
  const { customerId, restaurantId, status } = req.query;
  const conditions = [];
  const values = [];

  if (customerId) {
    values.push(customerId);
    conditions.push(`customer_id = $${values.length}`);
  }
  if (restaurantId) {
    values.push(restaurantId);
    conditions.push(`restaurant_id = $${values.length}`);
  }
  if (status) {
    values.push(status);
    conditions.push(`status = $${values.length}`);
  }

  const whereClause = conditions.length
    ? `WHERE ${conditions.join(" AND ")}`
    : "";

  try {
    const result = await pool.query(
      `SELECT * FROM orders ${whereClause} ORDER BY created_at DESC LIMIT 100`,
      values,
    );
    res.json(result.rows);
  } catch (err) {
    logger.error("Failed to list orders", { error: err.message });
    res.status(500).json({ error: "Internal server error" });
  }
});

// Update order status (used by tracking-service / restaurant app / delivery app)
router.patch("/:id/status", async (req, res) => {
  const { status } = req.body;
  const validStatuses = [
    "PLACED",
    "ACCEPTED",
    "PREPARING",
    "OUT_FOR_DELIVERY",
    "DELIVERED",
    "CANCELLED",
  ];

  if (!validStatuses.includes(status)) {
    return res
      .status(400)
      .json({
        error: `Invalid status. Must be one of ${validStatuses.join(", ")}`,
      });
  }

  try {
    const currentResult = await pool.query(
      "SELECT * FROM orders WHERE id = $1",
      [req.params.id],
    );
    if (currentResult.rows.length === 0) {
      return res.status(404).json({ error: "Order not found" });
    }

    const currentStatus = currentResult.rows[0].status;
    const allowedNext = {
      PLACED: ["ACCEPTED", "CANCELLED"],
      ACCEPTED: ["PREPARING", "CANCELLED"],
      PREPARING: ["OUT_FOR_DELIVERY", "CANCELLED"],
      OUT_FOR_DELIVERY: ["DELIVERED"],
      DELIVERED: [],
      CANCELLED: [],
    };

    if (!allowedNext[currentStatus].includes(status)) {
      return res
        .status(409)
        .json({
          error: `Cannot change order status from ${currentStatus} to ${status}`,
        });
    }

    const result = await pool.query(
      `UPDATE orders SET status = $1, updated_at = now() WHERE id = $2 RETURNING *`,
      [status, req.params.id],
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Order not found" });
    }

    const order = result.rows[0];
    publishOrderEvent("ORDER_STATUS_UPDATED", order).catch((err) =>
      logger.error("Failed to publish SNS event", { error: err.message }),
    );

    res.json(order);
  } catch (err) {
    logger.error("Failed to update order status", { error: err.message });
    res.status(500).json({ error: "Internal server error" });
  }
});

// Update payment status (called by payment-service)
router.patch("/:id/payment", async (req, res) => {
  const { paymentStatus } = req.body;
  const validPaymentStatuses = ["PENDING", "PROCESSING", "SUCCESS", "FAILED", "REFUNDED"];
  if (!validPaymentStatuses.includes(paymentStatus)) {
    return res.status(400).json({
      error: `Invalid payment status. Must be one of ${validPaymentStatuses.join(", ")}`
    });
  }
  try {
    const result = await pool.query(
      `UPDATE orders SET payment_status = $1, updated_at = now() WHERE id = $2 RETURNING *`,
      [paymentStatus, req.params.id],
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Order not found" });
    }
    res.json(result.rows[0]);
  } catch (err) {
    logger.error("Failed to update payment status", { error: err.message });
    res.status(500).json({ error: "Internal server error" });
  }
});

module.exports = router;

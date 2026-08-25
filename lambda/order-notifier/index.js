// Lambda: order-notifier
// Trigger: SNS topic "order-alerts" (published to by order-service)
// Purpose: sends push/email notification and writes an audit record.
// Also usable as an SNS -> Lambda -> SES/SNS-mobile-push fan-out.

const { SESClient, SendEmailCommand } = require('@aws-sdk/client-ses');

const sesClient = new SESClient({ region: process.env.AWS_REGION || 'us-east-1' });

exports.handler = async (event) => {
  const results = [];

  for (const record of event.Records) {
    const message = JSON.parse(record.Sns.Message);
    const { eventType, order } = message;

    console.log(`Processing event ${eventType} for order ${order.id}`);

    let subject, body;
    switch (eventType) {
      case 'ORDER_PLACED':
        subject = `Order Confirmed - #${order.id.slice(0, 8)}`;
        body = `Your order totaling $${order.total_amount} has been placed and is being processed.`;
        break;
      case 'ORDER_STATUS_UPDATED':
        subject = `Order Update - #${order.id.slice(0, 8)}`;
        body = `Your order status is now: ${order.status}`;
        break;
      default:
        subject = 'Order Notification';
        body = `Update for order ${order.id}`;
    }

    if (process.env.NOTIFICATION_EMAIL) {
      try {
        await sesClient.send(
          new SendEmailCommand({
            Source: process.env.SES_SOURCE_EMAIL || 'no-reply@fooddeliveryapp.com',
            Destination: { ToAddresses: [process.env.NOTIFICATION_EMAIL] },
            Message: {
              Subject: { Data: subject },
              Body: { Text: { Data: body } }
            }
          })
        );
        results.push({ orderId: order.id, status: 'notified' });
      } catch (err) {
        console.error('SES send failed', err);
        results.push({ orderId: order.id, status: 'failed', error: err.message });
      }
    } else {
      console.log('NOTIFICATION_EMAIL not set, skipping SES send (dry run)', { subject, body });
      results.push({ orderId: order.id, status: 'dry-run' });
    }
  }

  return { statusCode: 200, body: JSON.stringify(results) };
};

const { SNSClient, PublishCommand } = require('@aws-sdk/client-sns');

const snsClient = new SNSClient({ region: process.env.AWS_REGION || 'us-east-1' });

async function publishOrderEvent(eventType, order) {
  const topicArn = process.env.ORDER_ALERTS_TOPIC_ARN;
  if (!topicArn) {
    console.warn('ORDER_ALERTS_TOPIC_ARN not set, skipping SNS publish');
    return;
  }
  const command = new PublishCommand({
    TopicArn: topicArn,
    Message: JSON.stringify({ eventType, order }),
    MessageAttributes: {
      eventType: { DataType: 'String', StringValue: eventType }
    }
  });
  return snsClient.send(command);
}

module.exports = { publishOrderEvent };

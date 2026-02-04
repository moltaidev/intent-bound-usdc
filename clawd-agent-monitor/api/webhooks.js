const crypto = require('crypto');

module.exports = async (req, res) => {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle OPTIONS request for CORS preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Handle GET request - Twitter CRC Challenge
  if (req.method === 'GET') {
    const crc_token = req.query.crc_token;

    if (!crc_token) {
      return res.status(400).json({ error: 'Missing crc_token parameter' });
    }

    // Get Twitter consumer secret from environment variable
    const consumer_secret = process.env.TWITTER_CONSUMER_SECRET;

    if (!consumer_secret) {
      console.error('TWITTER_CONSUMER_SECRET environment variable not set');
      return res.status(500).json({ error: 'Server configuration error' });
    }

    // Create HMAC SHA-256 hash
    const hmac = crypto
      .createHmac('sha256', consumer_secret)
      .update(crc_token)
      .digest('base64');

    // Return response token
    const response_token = `sha256=${hmac}`;

    return res.status(200).json({
      response_token: response_token
    });
  }

  // Handle POST request - Twitter webhook events
  if (req.method === 'POST') {
    try {
      // Verify the request signature
      const signature = req.headers['x-twitter-webhooks-signature'];

      if (!signature) {
        return res.status(401).json({ error: 'Missing signature' });
      }

      const consumer_secret = process.env.TWITTER_CONSUMER_SECRET;

      if (!consumer_secret) {
        return res.status(500).json({ error: 'Server configuration error' });
      }

      // Verify signature
      const hash = crypto
        .createHmac('sha256', consumer_secret)
        .update(JSON.stringify(req.body))
        .digest('base64');

      const expectedSignature = `sha256=${hash}`;

      if (signature !== expectedSignature) {
        return res.status(401).json({ error: 'Invalid signature' });
      }

      // Process the webhook payload
      console.log('Received webhook event:', JSON.stringify(req.body, null, 2));

      // TODO: Add your webhook event processing logic here
      // For now, just acknowledge receipt
      return res.status(200).json({ status: 'received' });

    } catch (error) {
      console.error('Error processing webhook:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  // Method not allowed
  return res.status(405).json({ error: 'Method not allowed' });
};

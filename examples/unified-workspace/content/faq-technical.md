# Technical FAQ

## API Rate Limits

API Rate Limits by Plan:
- Free: 100 requests/minute, 1,000 requests/day
- Pro: 1,000 requests/minute, 50,000 requests/day
- Team: 5,000 requests/minute, 500,000 requests/day
- Enterprise: Custom limits

When you hit a rate limit, you'll receive a 429 error. Implement exponential backoff in your code to handle this gracefully.

## Webhook Setup

Setting up webhooks:
1. Go to Settings > Integrations > Webhooks
2. Click "Add Webhook"
3. Enter your endpoint URL (must be HTTPS)
4. Select events to subscribe to
5. Save and note the signing secret

All webhook payloads include a signature header (X-Signature) for verification. Use the signing secret to verify the payload hasn't been tampered with.

## Data Export

Exporting your data:
1. Go to Settings > Data & Privacy
2. Click "Request Data Export"
3. Select what data to include (profile, content, analytics)
4. Click "Generate Export"
5. You'll receive an email with a download link within 24 hours

Exports are available in JSON or CSV format. Large exports may take longer to process.

## Support Hours

Support is available:
- Email: 24/7 (response within 24 hours)
- Live Chat: Monday-Friday, 9am-6pm EST
- Phone (Enterprise only): Monday-Friday, 9am-6pm EST

For urgent issues outside business hours, use the emergency contact form in your dashboard.

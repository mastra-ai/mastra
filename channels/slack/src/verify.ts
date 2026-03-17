import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Verifies a Slack webhook request using the signing secret.
 * See: https://api.slack.com/authentication/verifying-requests-from-slack
 */
export async function verifySlackRequest(
  request: Request,
  signingSecret: string,
): Promise<{ verified: boolean; body: string }> {
  const timestamp = request.headers.get('x-slack-request-timestamp');
  const signature = request.headers.get('x-slack-signature');

  if (!timestamp || !signature) {
    return { verified: false, body: '' };
  }

  // Reject requests older than 5 minutes to prevent replay attacks
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - Number(timestamp)) > 60 * 5) {
    return { verified: false, body: '' };
  }

  const body = await request.text();
  const baseString = `v0:${timestamp}:${body}`;
  const hmac = createHmac('sha256', signingSecret).update(baseString).digest('hex');
  const expected = `v0=${hmac}`;

  const verified = timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  return { verified, body };
}

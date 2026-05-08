import * as crypto from 'crypto';

/**
 * Verify that a request came from Slack
 */
export function verifySlackRequest(
  signingSecret: string,
  requestSignature: string,
  timestamp: string,
  body: string,
): boolean {
  // Reject old requests (more than 5 minutes old)
  const fiveMinutesAgo = Math.floor(Date.now() / 1000) - 60 * 5;
  if (parseInt(timestamp) < fiveMinutesAgo) {
    return false;
  }

  // Compute the expected signature
  const sigBasestring = `v0:${timestamp}:${body}`;
  const mySignature = 'v0=' + crypto.createHmac('sha256', signingSecret).update(sigBasestring, 'utf8').digest('hex');

  // Guard: ensure requestSignature is valid and lengths match before timingSafeEqual
  if (
    typeof requestSignature !== 'string' ||
    Buffer.byteLength(requestSignature, 'utf8') !== Buffer.byteLength(mySignature, 'utf8')
  ) {
    return false;
  }

  // Compare signatures
  return crypto.timingSafeEqual(Buffer.from(mySignature, 'utf8'), Buffer.from(requestSignature, 'utf8'));
}

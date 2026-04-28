import { createHmac, timingSafeEqual, createCipheriv, createDecipheriv, randomBytes, createHash } from 'crypto';

/**
 * Verify a Slack request signature.
 * @see https://api.slack.com/authentication/verifying-requests-from-slack
 */
export function verifySlackRequest(params: {
  signingSecret: string;
  timestamp: string;
  body: string;
  signature: string;
}): boolean {
  const { signingSecret, timestamp, body, signature } = params;
  // Check timestamp to prevent replay attacks (5 minute window)
  const now = Math.floor(Date.now() / 1000);
  const requestTime = parseInt(timestamp, 10);
  if (Math.abs(now - requestTime) > 300) {
    return false;
  }

  // Compute expected signature
  const sigBasestring = `v0:${timestamp}:${body}`;
  const expectedSignature = `v0=${createHmac('sha256', signingSecret).update(sigBasestring).digest('hex')}`;

  // Timing-safe comparison
  try {
    return timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature));
  } catch {
    return false;
  }
}

/**
 * Parse URL-encoded form body from Slack slash commands.
 */
export function parseSlackFormBody(body: string): Record<string, string> {
  const params: Record<string, string> = {};
  for (const pair of body.split('&')) {
    const [key, value] = pair.split('=');
    if (key) {
      params[decodeURIComponent(key)] = decodeURIComponent(value ?? '');
    }
  }
  return params;
}

/**
 * Encrypt sensitive data using AES-256-GCM.
 * Returns base64-encoded string: iv:authTag:ciphertext
 */
export function encrypt(plaintext: string, key: string): string {
  const keyHash = createHash('sha256').update(key).digest();
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', keyHash, iv);
  
  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();
  
  return `${iv.toString('base64')}:${authTag.toString('base64')}:${encrypted.toString('base64')}`;
}

/**
 * Decrypt data encrypted with encrypt().
 */
export function decrypt(ciphertext: string, key: string): string {
  const [ivB64, authTagB64, encryptedB64] = ciphertext.split(':');
  if (!ivB64 || !authTagB64 || !encryptedB64) {
    throw new Error('Invalid ciphertext format');
  }
  
  const keyHash = createHash('sha256').update(key).digest();
  const iv = Buffer.from(ivB64, 'base64');
  const authTag = Buffer.from(authTagB64, 'base64');
  const encrypted = Buffer.from(encryptedB64, 'base64');
  
  const decipher = createDecipheriv('aes-256-gcm', keyHash, iv);
  decipher.setAuthTag(authTag);
  
  return Buffer.concat([
    decipher.update(encrypted),
    decipher.final(),
  ]).toString('utf8');
}

/**
 * Standard Webhooks signing and verification for MCP Events webhook delivery (SEP-3415).
 *
 * @experimental SEP-3415 is a draft; this API may change.
 */
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { WEBHOOK_HEADERS } from './constants';
import { WebhookSecretSchema } from './schemas';

const SECRET_PREFIX = 'whsec_';
const SIGNATURE_VERSION = 'v1,';
const DEFAULT_TOLERANCE_SEC = 300;

/**
 * Generate a Standard Webhooks symmetric secret: `whsec_` + base64 of 32 CSPRNG bytes.
 *
 * @experimental SEP-3415 is a draft; this API may change.
 */
export function generateWebhookSecret(): string {
  return `${SECRET_PREFIX}${randomBytes(32).toString('base64')}`;
}

/** @experimental SEP-3415 is a draft; this API may change. */
export interface SignWebhookOptions {
  /** One secret, or several to dual-sign during a rotation grace window. */
  secret: string | readonly string[];
  /** The `webhook-id` value. */
  id: string;
  /** The `webhook-timestamp` value, in Unix seconds. */
  timestamp: number;
  /** The raw request body, exactly as it will be sent. */
  body: string | Uint8Array;
}

function decodeSecret(secret: string): Buffer {
  return Buffer.from(secret.slice(SECRET_PREFIX.length), 'base64');
}

function computeSignature(key: Buffer, id: string, timestamp: number | string, body: string | Uint8Array): Buffer {
  return createHmac('sha256', key).update(`${id}.${timestamp}.`, 'utf8').update(body).digest();
}

/**
 * Compute the `webhook-signature` header value: `v1,<base64 HMAC-SHA256>` over
 * `${id}.${timestamp}.` + raw body. Several secrets yield space-separated signatures.
 *
 * @throws {Error} when a secret is not a valid `whsec_` secret.
 * @experimental SEP-3415 is a draft; this API may change.
 */
export function signWebhook({ secret, id, timestamp, body }: SignWebhookOptions): string {
  const secrets = typeof secret === 'string' ? [secret] : secret;
  if (secrets.length === 0) {
    throw new Error('signWebhook requires at least one secret');
  }
  return secrets
    .map(value => {
      if (!WebhookSecretSchema.safeParse(value).success) {
        throw new Error('Invalid webhook secret: expected "whsec_" followed by base64 of 24 to 64 bytes');
      }
      return `${SIGNATURE_VERSION}${computeSignature(decodeSecret(value), id, timestamp, body).toString('base64')}`;
    })
    .join(' ');
}

/** @experimental SEP-3415 is a draft; this API may change. */
export type WebhookVerifyFailure = 'missing_headers' | 'invalid_timestamp' | 'stale_timestamp' | 'invalid_signature';

/** @experimental SEP-3415 is a draft; this API may change. */
export type WebhookVerifyResult =
  | {
      ok: true;
      id: string;
      timestamp: number;
      /** The `X-MCP-Subscription-Id` header, when present. */
      subscriptionId?: string;
      /** The secret whose signature matched. */
      secret: string;
    }
  | { ok: false; reason: WebhookVerifyFailure };

/** @experimental SEP-3415 is a draft; this API may change. */
export type WebhookHeaders = Headers | Record<string, string | string[] | undefined>;

/** @experimental SEP-3415 is a draft; this API may change. */
export interface VerifyWebhookOptions {
  /** The expected secret, or every candidate secret (for example those not yet associated with an `id`). */
  secret: string | readonly string[];
  headers: WebhookHeaders;
  /** The raw request body bytes exactly as received, never a re-serialized object. */
  body: string | Uint8Array;
  /** Maximum allowed clock skew, in seconds, in either direction. Defaults to 300. */
  toleranceSec?: number;
}

function readHeader(headers: WebhookHeaders, name: string): string | undefined {
  if (headers instanceof Headers) {
    return headers.get(name) ?? undefined;
  }
  for (const [key, value] of Object.entries(headers)) {
    if (key.toLowerCase() === name) {
      return Array.isArray(value) ? value.join(' ') : value;
    }
  }
  return undefined;
}

/**
 * Verify a Standard Webhooks delivery. Never throws on malformed input; returns a typed failure instead.
 * Signatures are compared in constant time, and any `v1,` signature matching any secret is accepted.
 *
 * @experimental SEP-3415 is a draft; this API may change.
 */
export function verifyWebhook({
  secret,
  headers,
  body,
  toleranceSec = DEFAULT_TOLERANCE_SEC,
}: VerifyWebhookOptions): WebhookVerifyResult {
  const id = readHeader(headers, WEBHOOK_HEADERS.id);
  const rawTimestamp = readHeader(headers, WEBHOOK_HEADERS.timestamp);
  const signatureHeader = readHeader(headers, WEBHOOK_HEADERS.signature);
  if (!id || !rawTimestamp || !signatureHeader) {
    return { ok: false, reason: 'missing_headers' };
  }

  const timestampText = rawTimestamp.trim();
  if (!/^\d+$/.test(timestampText)) {
    return { ok: false, reason: 'invalid_timestamp' };
  }
  const timestamp = Number(timestampText);
  const nowSec = Math.floor(Date.now() / 1000);
  if (Math.abs(nowSec - timestamp) > toleranceSec) {
    return { ok: false, reason: 'stale_timestamp' };
  }

  const candidates = signatureHeader
    .split(/\s+/)
    .filter(entry => entry.startsWith(SIGNATURE_VERSION))
    // Compare the encoded text, not decoded bytes: Node's base64 decoder ignores trailing garbage.
    .map(entry => Buffer.from(entry.slice(SIGNATURE_VERSION.length), 'utf8'));

  const secrets = typeof secret === 'string' ? [secret] : secret;
  for (const value of secrets) {
    if (!WebhookSecretSchema.safeParse(value).success) {
      continue;
    }
    const expected = Buffer.from(
      computeSignature(decodeSecret(value), id, timestampText, body).toString('base64'),
      'utf8',
    );
    for (const candidate of candidates) {
      if (candidate.length === expected.length && timingSafeEqual(candidate, expected)) {
        const subscriptionId = readHeader(headers, WEBHOOK_HEADERS.subscriptionId);
        return { ok: true, id, timestamp, secret: value, ...(subscriptionId ? { subscriptionId } : {}) };
      }
    }
  }
  return { ok: false, reason: 'invalid_signature' };
}

import { createHash, createHmac, timingSafeEqual } from 'node:crypto';

import { z } from 'zod';

import { HttpBoundaryError } from './http-errors.js';

export const webhookHeaderNames = Object.freeze({
  version: 'Kyc-Webhook-Version',
  keyId: 'Kyc-Webhook-Key-Id',
  timestamp: 'Kyc-Webhook-Timestamp',
  deliveryId: 'Kyc-Webhook-Delivery-Id',
  idempotencyKey: 'Idempotency-Key',
  signature: 'Kyc-Webhook-Signature',
});

export type WebhookKey = Readonly<{ keyId: string; secret: string }>;
export type WebhookKeyring = Readonly<{ current: WebhookKey; previous?: WebhookKey | undefined }>;

const canonicalize = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, nested]) => [key, canonicalize(nested)]),
    );
  }
  return value;
};

export const canonicalJson = (value: unknown): string => JSON.stringify(canonicalize(value));

export const webhookSignatureBase = (
  input: Readonly<{
    timestamp: string;
    deliveryId: string;
    idempotencyKey: string;
    canonicalBody: string;
  }>,
): string => `v1\n${input.timestamp}\n${input.deliveryId}\n${input.idempotencyKey}\n${input.canonicalBody}`;

export const signWebhook = (
  input: Readonly<{
    key: WebhookKey;
    timestamp: string;
    deliveryId: string;
    idempotencyKey: string;
    body: unknown;
  }>,
): Readonly<{ body: string; headers: Record<string, string> }> => {
  const body = canonicalJson(input.body);
  const signature = createHmac('sha256', input.key.secret)
    .update(
      webhookSignatureBase({
        timestamp: input.timestamp,
        deliveryId: input.deliveryId,
        idempotencyKey: input.idempotencyKey,
        canonicalBody: body,
      }),
    )
    .digest('hex');
  return {
    body,
    headers: {
      [webhookHeaderNames.version]: 'v1',
      [webhookHeaderNames.keyId]: input.key.keyId,
      [webhookHeaderNames.timestamp]: input.timestamp,
      [webhookHeaderNames.deliveryId]: input.deliveryId,
      [webhookHeaderNames.idempotencyKey]: input.idempotencyKey,
      [webhookHeaderNames.signature]: `v1=${signature}`,
      'Content-Type': 'application/json',
    },
  };
};

const requiredHeader = (headers: Headers, name: string): string => {
  const value = headers.get(name);
  if (value === null || value === '') {
    throw new HttpBoundaryError('WEBHOOK_HEADER_MISSING', 'A required webhook header is missing', 400);
  }
  return value;
};

export const verifyWebhook = <Output>(
  input: Readonly<{
    headers: Headers;
    rawBody: string;
    keyring: WebhookKeyring;
    now: Date;
    schema: z.ZodType<Output>;
  }>,
): Readonly<{
  payload: Output;
  deliveryId: string;
  idempotencyKey: string;
  keyId: string;
  signedAt: string;
  payloadFingerprint: string;
}> => {
  const version = requiredHeader(input.headers, webhookHeaderNames.version);
  const keyId = requiredHeader(input.headers, webhookHeaderNames.keyId);
  const timestamp = requiredHeader(input.headers, webhookHeaderNames.timestamp);
  const deliveryId = requiredHeader(input.headers, webhookHeaderNames.deliveryId);
  const idempotencyKey = requiredHeader(input.headers, webhookHeaderNames.idempotencyKey);
  const suppliedSignature = requiredHeader(input.headers, webhookHeaderNames.signature);
  if (version !== 'v1') {
    throw new HttpBoundaryError('WEBHOOK_VERSION_UNSUPPORTED', 'The webhook version is unsupported', 400);
  }
  const epochSeconds = z.coerce.number().int().nonnegative().parse(timestamp);
  const deltaSeconds = Math.floor(input.now.getTime() / 1_000) - epochSeconds;
  if (deltaSeconds > 300 || deltaSeconds < -60) {
    throw new HttpBoundaryError('WEBHOOK_TIMESTAMP_INVALID', 'The webhook timestamp is outside the replay window', 400);
  }
  const key = [input.keyring.current, input.keyring.previous]
    .filter((candidate): candidate is WebhookKey => candidate !== undefined)
    .find(candidate => candidate.keyId === keyId);
  if (key === undefined) {
    throw new HttpBoundaryError('WEBHOOK_KEY_UNKNOWN', 'The webhook key is not recognized', 401);
  }
  const expected = `v1=${createHmac('sha256', key.secret)
    .update(webhookSignatureBase({ timestamp, deliveryId, idempotencyKey, canonicalBody: input.rawBody }))
    .digest('hex')}`;
  const expectedBytes = Buffer.from(expected);
  const suppliedBytes = Buffer.from(suppliedSignature);
  if (expectedBytes.length !== suppliedBytes.length || !timingSafeEqual(expectedBytes, suppliedBytes)) {
    throw new HttpBoundaryError('WEBHOOK_SIGNATURE_INVALID', 'The webhook signature is invalid', 401);
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(input.rawBody);
  } catch {
    throw new HttpBoundaryError('WEBHOOK_BODY_INVALID', 'The webhook body is invalid JSON', 400);
  }
  if (canonicalJson(parsed) !== input.rawBody) {
    throw new HttpBoundaryError('WEBHOOK_BODY_NOT_CANONICAL', 'The webhook body is not canonical JSON', 400);
  }
  return {
    payload: input.schema.parse(parsed),
    deliveryId,
    idempotencyKey,
    keyId,
    signedAt: new Date(epochSeconds * 1_000).toISOString(),
    payloadFingerprint: createHash('sha256').update(input.rawBody).digest('hex'),
  };
};

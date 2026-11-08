import { createHash } from 'node:crypto';
import { webhooks } from '@polar-sh/sdk/2026-10';
import { z } from 'zod';
import { BillingError, identifierSchema, timestampSchema, parseInput } from '../contracts.js';
import type { RawWebhookRequest, ProviderNotification } from '../contracts.js';

export async function verifyPolarWebhook(
  request: RawWebhookRequest,
  webhookSecret?: string,
): Promise<ProviderNotification> {
  if (!webhookSecret) throw new BillingError('unsupported');
  const headers = Object.fromEntries(Object.entries(request.headers).map(([key, value]) => [key.toLowerCase(), value]));
  // SDK verification receives the original bytes. Reject malformed UTF-8 so
  // decoding cannot turn different byte sequences into the same signed text.
  let payload: unknown;
  let unknown = false;
  try {
    const decoded = new TextDecoder('utf-8', { fatal: true }).decode(request.body);
    if (!Buffer.from(new TextEncoder().encode(decoded)).equals(Buffer.from(request.body)))
      throw new BillingError('unauthenticated');
    payload = await webhooks.validateEvent(request.body, { ...request.headers }, webhookSecret);
  } catch (error) {
    // The pinned SDK throws UnknownType only after authenticating the body.
    if (error instanceof webhooks.PolarWebhookUnknownTypeError) unknown = true;
    else throw new BillingError('unauthenticated');
  }
  if (headers['webhook-api-version'] !== '2026-10') throw new BillingError('invalid_input');
  if (unknown) {
    try {
      payload = JSON.parse(new TextDecoder().decode(request.body));
    } catch {
      throw new BillingError('invalid_input');
    }
  }
  const envelope = parseInput(
    z.object({
      api_version: z.literal('2026-10'),
      type: z.string().min(1).max(128),
      timestamp: timestampSchema,
      data: z.record(z.string(), z.unknown()),
    }),
    payload,
  );
  const relevant = !unknown && /^(customer|order|subscription|benefit_grant)\./.test(envelope.type);
  const data = envelope.data;
  const customer =
    typeof data.customer === 'object' && data.customer !== null
      ? (data.customer as Record<string, unknown>)
      : undefined;
  const reference = relevant
    ? envelope.type.startsWith('customer.')
      ? data.id
      : (data.customer_id ?? customer?.id)
    : null;
  const accountReference = parseInput(z.string().min(1).max(256).nullable(), reference ?? null);
  if (relevant && accountReference === null) throw new BillingError('invalid_input');
  return {
    status: 'verified',
    id: parseInput(identifierSchema, headers['webhook-id']),
    type: envelope.type,
    accountReference,
    occurredAt: envelope.timestamp,
    digest: createHash('sha256').update(request.body).digest('hex'),
  };
}

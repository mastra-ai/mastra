import { randomBytes } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { WebhookSecretSchema } from './schemas';
import { generateWebhookSecret, signWebhook, verifyWebhook } from './webhook';

// Standard Webhooks spec test vector.
const VECTOR = {
  secret: 'whsec_MfKQ9r8GKYqrTwjUPD8ILPZIo2LaLaSw',
  id: 'msg_p5jXN8AQM9LWM0D4loKWxJek',
  timestamp: 1614265330,
  body: '{"test": 2432232314}',
  signature: 'v1,g0hM9SsE+OTPJTGt/tmIKtSyZlE3uFJELVlNIOLJ1OE=',
};

function vectorHeaders(overrides: Record<string, string | undefined> = {}): Record<string, string | undefined> {
  return {
    'webhook-id': VECTOR.id,
    'webhook-timestamp': String(VECTOR.timestamp),
    'webhook-signature': VECTOR.signature,
    ...overrides,
  };
}

describe('generateWebhookSecret', () => {
  it('produces a valid whsec_ secret of 32 random bytes', () => {
    const secret = generateWebhookSecret();
    expect(WebhookSecretSchema.safeParse(secret).success).toBe(true);
    expect(Buffer.from(secret.slice('whsec_'.length), 'base64')).toHaveLength(32);
  });

  it('returns a different secret on each call', () => {
    expect(generateWebhookSecret()).not.toBe(generateWebhookSecret());
  });
});

describe('signWebhook', () => {
  it('matches the Standard Webhooks spec vector', () => {
    expect(signWebhook(VECTOR)).toBe(VECTOR.signature);
  });

  it('signs a Uint8Array body identically to the equivalent string', () => {
    expect(signWebhook({ ...VECTOR, body: new TextEncoder().encode(VECTOR.body) })).toBe(VECTOR.signature);
  });

  it('dual-signs with several secrets as space-separated signatures', () => {
    const other = generateWebhookSecret();
    const header = signWebhook({ ...VECTOR, secret: [VECTOR.secret, other] });
    const parts = header.split(' ');
    expect(parts).toHaveLength(2);
    expect(parts[0]).toBe(VECTOR.signature);
    expect(parts[1]).toBe(signWebhook({ ...VECTOR, secret: other }));
  });

  it('rejects an invalid secret', () => {
    expect(() => signWebhook({ ...VECTOR, secret: 'not-a-secret' })).toThrow(/Invalid webhook secret/);
    expect(() => signWebhook({ ...VECTOR, secret: 'whsec_c2hvcnQ=' })).toThrow(/Invalid webhook secret/);
    expect(() => signWebhook({ ...VECTOR, secret: [] })).toThrow(/at least one secret/);
  });
});

describe('verifyWebhook', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(VECTOR.timestamp * 1000);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('accepts the spec vector', () => {
    expect(verifyWebhook({ secret: VECTOR.secret, headers: vectorHeaders(), body: VECTOR.body })).toEqual({
      ok: true,
      id: VECTOR.id,
      timestamp: VECTOR.timestamp,
      secret: VECTOR.secret,
    });
  });

  it('reads Headers and mixed-case record headers', () => {
    const headers = new Headers(vectorHeaders() as Record<string, string>);
    expect(verifyWebhook({ secret: VECTOR.secret, headers, body: VECTOR.body }).ok).toBe(true);

    const mixed = {
      'Webhook-Id': VECTOR.id,
      'WEBHOOK-TIMESTAMP': String(VECTOR.timestamp),
      'Webhook-Signature': [VECTOR.signature],
    };
    expect(verifyWebhook({ secret: VECTOR.secret, headers: mixed, body: VECTOR.body }).ok).toBe(true);
  });

  it('accepts a Uint8Array body', () => {
    const body = new TextEncoder().encode(VECTOR.body);
    expect(verifyWebhook({ secret: VECTOR.secret, headers: vectorHeaders(), body }).ok).toBe(true);
  });

  it.each([
    ['body', { body: '{"test": 2432232315}' }],
    ['id', { headers: vectorHeaders({ 'webhook-id': 'msg_other' }) }],
    ['timestamp', { headers: vectorHeaders({ 'webhook-timestamp': String(VECTOR.timestamp + 1) }) }],
    ['secret', { secret: generateWebhookSecret() }],
  ])('rejects a tampered %s with invalid_signature', (_label, override) => {
    const result = verifyWebhook({ secret: VECTOR.secret, headers: vectorHeaders(), body: VECTOR.body, ...override });
    expect(result).toEqual({ ok: false, reason: 'invalid_signature' });
  });

  describe('timestamp tolerance', () => {
    function verifyAt(nowSec: number, toleranceSec?: number) {
      vi.setSystemTime(nowSec * 1000);
      return verifyWebhook({ secret: VECTOR.secret, headers: vectorHeaders(), body: VECTOR.body, toleranceSec });
    }

    it('rejects a timestamp older than 300 seconds', () => {
      expect(verifyAt(VECTOR.timestamp + 301)).toEqual({ ok: false, reason: 'stale_timestamp' });
    });

    it('rejects a timestamp too far in the future', () => {
      expect(verifyAt(VECTOR.timestamp - 301)).toEqual({ ok: false, reason: 'stale_timestamp' });
    });

    it('accepts a timestamp exactly at the 300 second boundary', () => {
      expect(verifyAt(VECTOR.timestamp + 300).ok).toBe(true);
      expect(verifyAt(VECTOR.timestamp - 300).ok).toBe(true);
    });

    it('honours a custom tolerance', () => {
      expect(verifyAt(VECTOR.timestamp + 11, 10)).toEqual({ ok: false, reason: 'stale_timestamp' });
      expect(verifyAt(VECTOR.timestamp + 10, 10).ok).toBe(true);
      expect(verifyAt(VECTOR.timestamp + 3600, 7200).ok).toBe(true);
    });

    it.each(['abc', '1614265330.5', '-1614265330', '1e9'])('rejects non-integer timestamp %s', timestamp => {
      const result = verifyWebhook({
        secret: VECTOR.secret,
        headers: vectorHeaders({ 'webhook-timestamp': timestamp }),
        body: VECTOR.body,
      });
      expect(result).toEqual({ ok: false, reason: 'invalid_timestamp' });
    });
  });

  it.each(['webhook-id', 'webhook-timestamp', 'webhook-signature'])('rejects a missing %s header', header => {
    const result = verifyWebhook({
      secret: VECTOR.secret,
      headers: vectorHeaders({ [header]: undefined }),
      body: VECTOR.body,
    });
    expect(result).toEqual({ ok: false, reason: 'missing_headers' });
  });

  it('accepts when only the second of several signatures is valid', () => {
    const wrong = signWebhook({ ...VECTOR, secret: generateWebhookSecret() });
    const headers = vectorHeaders({ 'webhook-signature': `${wrong} ${VECTOR.signature}` });
    expect(verifyWebhook({ secret: VECTOR.secret, headers, body: VECTOR.body }).ok).toBe(true);
  });

  it('ignores signatures with other version prefixes', () => {
    const v1a = VECTOR.signature.replace('v1,', 'v1a,');
    const headers = vectorHeaders({ 'webhook-signature': v1a });
    expect(verifyWebhook({ secret: VECTOR.secret, headers, body: VECTOR.body })).toEqual({
      ok: false,
      reason: 'invalid_signature',
    });
  });

  it.each(['garbage', 'v1,', 'v1,!!!not-base64!!!', 'v1,c2hvcnQ=', `${VECTOR.signature}AAAA`])(
    'rejects malformed signature %s without throwing',
    signature => {
      const headers = vectorHeaders({ 'webhook-signature': signature });
      expect(verifyWebhook({ secret: VECTOR.secret, headers, body: VECTOR.body })).toEqual({
        ok: false,
        reason: 'invalid_signature',
      });
    },
  );

  it('tries every candidate secret and reports the one that matched', () => {
    const result = verifyWebhook({
      secret: [generateWebhookSecret(), 'not-a-secret', VECTOR.secret],
      headers: vectorHeaders(),
      body: VECTOR.body,
    });
    expect(result).toMatchObject({ ok: true, secret: VECTOR.secret });
  });

  it('surfaces the X-MCP-Subscription-Id header', () => {
    const headers = vectorHeaders({ 'X-MCP-Subscription-Id': 'sub_a3f1c8e2b0d49f7e' });
    expect(verifyWebhook({ secret: VECTOR.secret, headers, body: VECTOR.body })).toMatchObject({
      ok: true,
      subscriptionId: 'sub_a3f1c8e2b0d49f7e',
    });
  });

  it('round-trips a random secret and binary body', () => {
    const secret = generateWebhookSecret();
    const body = new Uint8Array(randomBytes(256));
    const id = 'evt_789';
    const timestamp = Math.floor(Date.now() / 1000);
    const headers = {
      'webhook-id': id,
      'webhook-timestamp': String(timestamp),
      'webhook-signature': signWebhook({ secret, id, timestamp, body }),
    };
    expect(verifyWebhook({ secret, headers, body })).toEqual({ ok: true, id, timestamp, secret });
  });
});

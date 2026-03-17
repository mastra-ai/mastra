import { createHmac } from 'node:crypto';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { verifySlackRequest } from '../verify';

const SIGNING_SECRET = 'test-signing-secret-12345';

function createSignedRequest(body: string, timestamp?: number): Request {
  const ts = timestamp ?? Math.floor(Date.now() / 1000);
  const baseString = `v0:${ts}:${body}`;
  const hmac = createHmac('sha256', SIGNING_SECRET).update(baseString).digest('hex');
  const signature = `v0=${hmac}`;

  return new Request('https://example.com/webhook', {
    method: 'POST',
    headers: {
      'x-slack-request-timestamp': String(ts),
      'x-slack-signature': signature,
      'content-type': 'application/json',
    },
    body,
  });
}

describe('verifySlackRequest', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-01-15T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('verifies a valid request', async () => {
    const body = JSON.stringify({ type: 'event_callback', event: { type: 'message' } });
    const request = createSignedRequest(body);
    const result = await verifySlackRequest(request, SIGNING_SECRET);

    expect(result.verified).toBe(true);
    expect(result.body).toBe(body);
  });

  it('rejects a request with wrong signing secret', async () => {
    const body = JSON.stringify({ type: 'event_callback' });
    const request = createSignedRequest(body);
    const result = await verifySlackRequest(request, 'wrong-secret');

    expect(result.verified).toBe(false);
  });

  it('rejects a request with missing timestamp header', async () => {
    const request = new Request('https://example.com/webhook', {
      method: 'POST',
      headers: {
        'x-slack-signature': 'v0=abc123',
      },
      body: '{}',
    });

    const result = await verifySlackRequest(request, SIGNING_SECRET);
    expect(result.verified).toBe(false);
  });

  it('rejects a request with missing signature header', async () => {
    const request = new Request('https://example.com/webhook', {
      method: 'POST',
      headers: {
        'x-slack-request-timestamp': String(Math.floor(Date.now() / 1000)),
      },
      body: '{}',
    });

    const result = await verifySlackRequest(request, SIGNING_SECRET);
    expect(result.verified).toBe(false);
  });

  it('rejects a request older than 5 minutes', async () => {
    const body = JSON.stringify({ type: 'event_callback' });
    const oldTimestamp = Math.floor(Date.now() / 1000) - 6 * 60; // 6 minutes ago
    const request = createSignedRequest(body, oldTimestamp);

    const result = await verifySlackRequest(request, SIGNING_SECRET);
    expect(result.verified).toBe(false);
  });

  it('accepts a request within the 5 minute window', async () => {
    const body = JSON.stringify({ type: 'event_callback' });
    const recentTimestamp = Math.floor(Date.now() / 1000) - 4 * 60; // 4 minutes ago
    const request = createSignedRequest(body, recentTimestamp);

    const result = await verifySlackRequest(request, SIGNING_SECRET);
    expect(result.verified).toBe(true);
  });
});

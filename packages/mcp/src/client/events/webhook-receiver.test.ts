import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { generateWebhookSecret, signWebhook } from '../../shared/events';
import { WebhookReceiver } from './webhook-receiver';
import type { WebhookBody } from './webhook-receiver';

const SECRET = generateWebhookSecret();
const OTHER = generateWebhookSecret();

function delivery(
  body: unknown,
  { secret = SECRET, id = 'sub_1', webhookId = 'evt_1', timestamp = Math.floor(Date.now() / 1000), method = 'POST' } = {},
) {
  const raw = typeof body === 'string' ? body : JSON.stringify(body);
  return new Request('https://client.example.com/webhooks', {
    method,
    headers: {
      'content-type': 'application/json',
      'webhook-id': webhookId,
      'webhook-timestamp': String(timestamp),
      'webhook-signature': signWebhook({ secret, id: webhookId, timestamp, body: raw }),
      'x-mcp-subscription-id': id,
    },
    ...(method === 'POST' ? { body: raw } : {}),
  });
}

const event = { eventId: 'evt_1', name: 'tasks', timestamp: '2026-01-01T00:00:00.000Z', data: { n: 1 }, cursor: 'c1' };

function route(secret = SECRET) {
  const bodies: WebhookBody[] = [];
  return { secret, bodies, onBody: (body: WebhookBody) => void bodies.push(body) };
}

beforeEach(() => vi.useFakeTimers({ now: new Date('2026-01-01T00:00:00.000Z') }));
afterEach(() => vi.useRealTimers());

describe('WebhookReceiver', () => {
  it('answers a verification handshake signed with a pending secret', async () => {
    const receiver = new WebhookReceiver();
    const release = receiver.expect(SECRET);
    const response = await receiver.handle(delivery({ type: 'verification', challenge: 'nonce-1' }, { id: 'sub_new' }));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ challenge: 'nonce-1' });

    release();
    const after = await receiver.handle(delivery({ type: 'verification', challenge: 'nonce-2' }, { id: 'sub_new' }));
    expect(after.status).toBe(503);
  });

  it('does not answer a handshake signed with an unknown secret', async () => {
    const receiver = new WebhookReceiver();
    receiver.expect(SECRET);
    const response = await receiver.handle(delivery({ type: 'verification', challenge: 'x' }, { secret: OTHER }));
    expect(response.status).toBe(503);
    expect(await response.text()).toBe('');
  });

  it('routes a verified event to the subscription', async () => {
    const receiver = new WebhookReceiver();
    const target = route();
    receiver.register('sub_1', target);
    const response = await receiver.handle(delivery(event));
    expect(response.status).toBe(200);
    expect(target.bodies).toEqual([{ kind: 'event', event }]);
  });

  it('answers 503 for an id that is not routed yet, even when signed with a pending secret', async () => {
    const receiver = new WebhookReceiver();
    expect((await receiver.handle(delivery(event))).status).toBe(503);
    receiver.expect(SECRET);
    expect((await receiver.handle(delivery(event))).status).toBe(503);
  });

  it('rejects bad and stale signatures with 401 before parsing', async () => {
    const receiver = new WebhookReceiver();
    const target = route();
    receiver.register('sub_1', target);
    const parse = vi.spyOn(JSON, 'parse');

    expect((await receiver.handle(delivery(event, { secret: OTHER }))).status).toBe(401);
    expect((await receiver.handle(delivery('{not json', { secret: OTHER }))).status).toBe(401);
    const stale = delivery(event, { timestamp: Math.floor(Date.now() / 1000) - 301 });
    expect((await receiver.handle(stale)).status).toBe(401);
    expect(parse).not.toHaveBeenCalled();
    expect(target.bodies).toEqual([]);
    parse.mockRestore();
  });

  it('rejects a malformed but signed body with 400', async () => {
    const receiver = new WebhookReceiver();
    receiver.register('sub_1', route());
    expect((await receiver.handle(delivery('{not json'))).status).toBe(400);
    expect((await receiver.handle(delivery({ type: 'gap' }))).status).toBe(400);
  });

  it('rejects non-POST requests with 405', async () => {
    const receiver = new WebhookReceiver();
    receiver.register('sub_1', route());
    expect((await receiver.handle(delivery(event, { method: 'GET' }))).status).toBe(405);
  });

  it('picks the route whose secret verifies when ids collide', async () => {
    const receiver = new WebhookReceiver();
    const first = route(SECRET);
    const second = route(OTHER);
    receiver.register('sub_1', first);
    const unregister = receiver.register('sub_1', second);
    await receiver.handle(delivery(event, { secret: OTHER }));
    expect(first.bodies).toEqual([]);
    expect(second.bodies).toHaveLength(1);

    unregister();
    expect((await receiver.handle(delivery(event, { secret: OTHER }))).status).toBe(401);
  });

  it('routes gap and terminated control bodies', async () => {
    const receiver = new WebhookReceiver();
    const target = route();
    receiver.register('sub_1', target);
    const terminated = { type: 'terminated', error: { code: -32027, message: 'gone' } };
    await receiver.handle(delivery({ type: 'gap', cursor: 'c9' }, { webhookId: 'msg_gap_1' }));
    await receiver.handle(delivery(terminated, { webhookId: 'msg_terminated_1' }));
    expect(target.bodies).toEqual([
      { kind: 'control', control: { type: 'gap', cursor: 'c9' } },
      { kind: 'control', control: terminated },
    ]);
  });
});

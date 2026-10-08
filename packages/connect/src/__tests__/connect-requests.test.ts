import { createHmac } from 'node:crypto';

import { Agent } from '@mastra/core/agent';
import { Mastra } from '@mastra/core/mastra';
import { InMemoryStore } from '@mastra/core/storage';
import { createMockModel } from '@mastra/core/test-utils/llm-mock';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

import { tools } from '../tools.js';

const SECRET = 'whsec_test';
const context = { requestId: 'call_1', agentId: 'agent', threadId: 't1', resourceId: 'u1', integration: 'linear' };
const event = {
  key: 'conn_1:call_1:active',
  type: 'connection.active',
  connection: { id: 'conn_1', integrationId: 'linear', status: 'active', accountLabel: 'acme' },
  error: null,
  context: { ...context, trace: { traceId: 'trace_1', spanId: 'span_1' } },
};

function setup(requestConnections = true) {
  const session = { connectionId: 'conn_1', connectUrl: 'https://c.test/s', expiresAt: '2030-01-01T00:00:00Z' };
  const catalog = { integrations: [{ id: 'linear', displayName: 'Linear', capabilities: {} }] };
  const fetchMock = vi.fn(async (input: string | URL | Request, init?: RequestInit) =>
    Response.json(
      init?.method === 'POST' ? session : String(input).endsWith('/v2/integrations') ? catalog : { connections: [] },
    ),
  );
  const resolver = tools({
    projectId: 'proj_1',
    providers: ['linear'],
    client: { accessToken: 'tok', baseUrl: 'https://example.test', fetch: fetchMock as unknown as typeof fetch },
    ...(requestConnections ? { requestConnections: { allow: () => true } } : {}),
  });
  if (!requestConnections) return { resolver, fetchMock };
  const agent = new Agent({ id: 'agent', name: 'a', instructions: 'x', model: createMockModel({ mockText: 'ok' }) });
  const provider = resolver.signalProvider();
  provider.connect(agent);
  const mastra = new Mastra({ agents: { agent }, storage: new InMemoryStore(), logger: false });
  provider.__registerMastra(mastra);
  return { resolver, fetchMock, agent, provider, mastra };
}

function sign(body: string, t = Math.floor(Date.now() / 1000)) {
  return `t=${t},v1=${createHmac('sha256', SECRET).update(`${t}.${body}`).digest('hex')}`;
}

beforeEach(() => {
  vi.stubEnv('MASTRA_CONNECT_WEBHOOK_URL', 'https://app.test/connect/webhook');
  vi.stubEnv('MASTRA_CONNECT_WEBHOOK_SECRET', SECRET);
});
afterEach(() => vi.unstubAllEnvs());

it('adds connect_integration only when requestConnections is set', async () => {
  expect(Object.keys(await setup(false).resolver())).toEqual([]);
  expect(Object.keys(await setup().resolver())).toEqual(['connect_integration']);
});

it('rejects a bad signature and a stale timestamp', async () => {
  const { provider } = setup();
  const body = JSON.stringify(event);
  const bad = await provider!.handleWebhook({ body, headers: { 'x-mastra-signature': sign('{}') } });
  const stale = await provider!.handleWebhook({ body, headers: { 'x-mastra-signature': sign(body, 1_000) } });
  expect([bad.status, stale.status]).toEqual([401, 401]);
});

it('writes the request part and returns pending', async () => {
  const { resolver, mastra, fetchMock } = setup();
  const tool = (await resolver()).connect_integration as unknown as { execute: Function };
  const custom = vi.fn();
  const span = { traceId: 'trace_1', id: 'span_1', update: vi.fn() };
  const result = await tool.execute(
    { integration: 'linear', reason: 'To file the bug.' },
    { mastra, writer: { custom }, tracingContext: { currentSpan: span }, agent: { ...context, toolCallId: 'call_1' } },
  );
  expect(result).toEqual({ status: 'pending' });
  expect(custom.mock.calls[0]![0]).toEqual({
    type: 'data-mastra-connect-request',
    data: {
      ...context,
      displayName: 'Linear',
      reason: 'To file the bug.',
      connectionId: 'conn_1',
      connectUrl: 'https://c.test/s',
      expiresAt: '2030-01-01T00:00:00Z',
      trace: { traceId: 'trace_1', spanId: 'span_1' },
    },
  });
  expect(JSON.parse(fetchMock.mock.calls.at(-1)![1]!.body as string).callback.url).toBe(
    'https://app.test/connect/webhook',
  );
});

it('wakes the thread nested under the tool span and dedupes the key across restarts', async () => {
  const { resolver, agent, provider, mastra } = setup();
  const stream = vi.spyOn(agent!, 'stream');
  const body = JSON.stringify(event);
  expect((await provider!.handleWebhook({ body, headers: { 'x-mastra-signature': sign(body) } })).body).toEqual({
    delivered: true,
  });
  await vi.waitFor(() => expect(stream).toHaveBeenCalled());
  expect(stream.mock.calls[0]![1]!.tracingOptions).toEqual({
    traceId: 'trace_1',
    parentSpanId: 'span_1',
    nestUnderParent: true,
    metadata: { connectionId: 'conn_1', connectRequestId: 'call_1', integration: 'linear', outcome: 'connected' },
  });
  const restarted = resolver.signalProvider();
  restarted.__registerMastra(mastra!);
  expect(await restarted.deliver(event as never)).toBe(false);
});

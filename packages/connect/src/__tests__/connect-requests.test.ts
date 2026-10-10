import { createHmac } from 'node:crypto';

import { Agent } from '@mastra/core/agent';
import { Mastra } from '@mastra/core/mastra';
import { InMemoryStore } from '@mastra/core/storage';
import { createMockModel } from '@mastra/core/test-utils/llm-mock';
import { Hono } from 'hono';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

import { channels as connectChannels } from '../channels.js';
import type { InstalledChannel } from '../connect-requests.js';
import { tools } from '../tools.js';

type InstallHook = (installation: InstalledChannel) => Promise<void>;
const installHooks: InstallHook[] = [];
vi.mock('../registry.js', async importOriginal => {
  const connect = async () => ({ type: 'deep_link', url: 'https://t.me/bot?start=x', installationId: 'inst_1' });
  const create = async ({ onInstall }: { onInstall: InstallHook }) => {
    installHooks.push(onInstall);
    return { provider: { id: 'telegram', getRoutes: () => [], connect } };
  };
  const registry = await importOriginal<typeof import('../registry.js')>();
  return { ...registry, CHANNELS: [{ integrationId: 'telegram', create }] };
});

const SECRET = 'whsec_test';
const context = { requestId: 'call_1', agentId: 'agent', threadId: 't1', resourceId: 'u1', integration: 'linear' };
const event = {
  key: 'conn_1:call_1:active',
  projectId: 'proj_1',
  type: 'connection.active',
  connection: { id: 'conn_1', integrationId: 'linear', status: 'active', accountLabel: 'acme' },
  error: null,
  context: { ...context, trace: { traceId: 'trace_1', spanId: 'span_1' } },
};

async function setup(requestConnections = true, { connections = [] as unknown[], storage = new InMemoryStore() } = {}) {
  const session = { connectionId: 'conn_1', connectUrl: 'https://c.test/s', expiresAt: '2030-01-01T00:00:00Z' };
  const catalog = { integrations: [{ id: 'linear', displayName: 'Linear', capabilities: {} }] };
  const fetchMock = vi.fn(async (input: string | URL | Request, init?: RequestInit) =>
    Response.json(
      init?.method === 'POST' ? session : String(input).endsWith('/v2/integrations') ? catalog : { connections },
    ),
  );
  const client = { accessToken: 'tok', baseUrl: 'https://example.test', fetch: fetchMock as unknown as typeof fetch };
  const resolver = tools({
    projectId: 'proj_1',
    providers: ['linear'],
    client,
    ...(requestConnections ? { requestConnections: { allow: () => true, channels: ['telegram'] } } : {}),
  });
  if (!requestConnections) return { resolver, fetchMock };
  const agent = new Agent({ id: 'agent', name: 'a', instructions: 'x', model: createMockModel({ mockText: 'ok' }) });
  const provider = resolver.signalProvider();
  provider.connect(agent);
  const channels = await connectChannels({ projectId: 'proj_1', providers: ['telegram'], client });
  const install = installHooks.at(-1)!;
  const mastra = new Mastra({ agents: { agent }, storage, channels, logger: false });
  provider.__registerMastra(mastra);
  const thread = { id: 't1', resourceId: 'u1', title: '', createdAt: new Date(), updatedAt: new Date() };
  await (await mastra.getStorage()!.getStore('memory'))!.saveThread({ thread });
  const app = new Hono();
  for (const route of resolver.routes()) app.on(route.method, route.path, route.handler as never);
  return { resolver, fetchMock, agent, provider, mastra, app, install };
}

function sign(body: string, t = Math.floor(Date.now() / 1000)) {
  return `t=${t},v1=${createHmac('sha256', SECRET).update(`${t}.${body}`).digest('hex')}`;
}

function post(app: Hono, payload: unknown, signature?: string) {
  const body = JSON.stringify(payload);
  const headers = { 'x-mastra-signature': signature ?? sign(body) };
  return app.request('/connect/webhook', { method: 'POST', body, headers });
}

async function connectTool(resolver: Awaited<ReturnType<typeof setup>>['resolver']) {
  return (await resolver()).connect_integration as unknown as { execute: Function };
}

beforeEach(() => {
  vi.stubEnv('MASTRA_CONNECT_WEBHOOK_URL', 'https://app.test/connect/webhook');
  vi.stubEnv('MASTRA_CONNECT_WEBHOOK_SECRET', SECRET);
});
afterEach(() => vi.unstubAllEnvs());

it('adds connect_integration only when requestConnections is set', async () => {
  expect(Object.keys(await (await setup(false)).resolver())).toEqual([]);
  expect(Object.keys(await (await setup()).resolver())).toEqual(['connect_integration']);
});

it('verifies the signature before routing by agent', async () => {
  const { app } = await setup();
  const stranger = { ...event, context: { ...event.context, agentId: 'nobody' } };
  const unsigned = await post(app, stranger, sign('{}'));
  const stale = await post(app, event, sign(JSON.stringify(event), 1_000));
  const signed = await post(app, stranger);
  expect([unsigned.status, stale.status, signed.status]).toEqual([401, 401, 404]);
});

it('writes the request part and returns pending', async () => {
  const { resolver, mastra, fetchMock } = await setup();
  const custom = vi.fn();
  const span = { traceId: 'trace_1', id: 'span_1', update: vi.fn() };
  const tool = await connectTool(resolver);
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

it('answers 503 when the wake fails, then wakes under the tool span and dedupes across restarts', async () => {
  const { resolver, agent, app, mastra } = await setup();
  const stream = vi.spyOn(agent!, 'stream').mockRejectedValueOnce(new Error('model unavailable'));
  expect((await post(app!, event)).status).toBe(503);
  const response = await post(app!, event);
  expect([response.status, await response.json()]).toEqual([200, { outcome: 'delivered' }]);
  await vi.waitFor(() => expect(stream).toHaveBeenCalled());
  expect(stream.mock.calls[0]![1]!.tracingOptions).toMatchObject({ parentSpanId: 'span_1', nestUnderParent: true });
  const restarted = resolver.signalProvider();
  restarted.__registerMastra(mastra!);
  expect(await restarted.deliver(event as never)).toBe('duplicate');
});

it('wakes the thread once when the install finishes on another instance', async () => {
  const storage = new InMemoryStore();
  const connections = [{ id: 'conn_tg', integrationId: 'telegram', status: 'active' }];
  const [hostA, hostB] = [await setup(true, { connections, storage }), await setup(true, { connections, storage })];
  const [streamA, streamB] = [vi.spyOn(hostA.agent!, 'stream'), vi.spyOn(hostB.agent!, 'stream')];
  const tool = await connectTool(hostA.resolver);
  const result = await tool.execute(
    { integration: 'telegram', reason: 'To message you there.' },
    { mastra: hostA.mastra, writer: { custom: vi.fn() }, agent: { ...context, toolCallId: 'call_1' } },
  );
  await hostA.resolver.disconnect();
  await hostB.install({ id: 'inst_1', agentId: 'agent' });
  await vi.waitFor(() => expect(streamB).toHaveBeenCalled());
  const signals = streamB.mock.calls.map(([signal]) => signal as { id: string; attributes: { connectionId: string } });
  const wakes = new Set(signals.map(signal => signal.id)).size;
  expect(result).toEqual({ status: 'pending' });
  expect([streamA.mock.calls.length, wakes, signals[0]!.attributes.connectionId]).toEqual([0, 1, 'inst_1']);
});

import { Agent } from '@mastra/core/agent';
import { Mastra } from '@mastra/core/mastra';
import { InMemoryTaskStore } from '@mastra/server/a2a/store';
import { Hono } from 'hono';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MastraServer } from '../index';

describe('A2A method names through the HTTP adapter', () => {
  let app: Hono;
  let agent: Agent;
  let taskStore: InMemoryTaskStore;

  beforeEach(async () => {
    agent = new Agent({
      id: 'test-agent',
      name: 'test-agent',
      instructions: 'Return a greeting',
      model: 'openai/gpt-4o',
    });
    taskStore = new InMemoryTaskStore();
    await taskStore.save({
      agentId: 'test-agent',
      data: {
        id: 'task-1',
        contextId: 'context-1',
        kind: 'task',
        status: { state: 'completed', timestamp: '2026-09-17T00:00:00.000Z' },
        artifacts: [],
        history: [],
      },
    });
    app = new Hono();
    const adapter = new MastraServer({
      app,
      mastra: new Mastra({ agents: { 'test-agent': agent }, logger: false }),
      taskStore,
    });
    await adapter.init();
  });

  afterEach(() => vi.restoreAllMocks());

  function request(method: string, params: unknown, version: string | undefined = '1.0', id: string | number = 0) {
    return app.request('/api/a2a/test-agent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(version ? { 'A2A-Version': version } : {}) },
      body: JSON.stringify({ jsonrpc: '2.0', id, method, params }),
    });
  }

  const messageParams = {
    message: { messageId: 'message-1', role: 'ROLE_USER', parts: [{ text: 'Hello' }] },
    configuration: { returnImmediately: false },
  };

  it('dispatches GetTask and returns a v1 task preserving request ID zero', async () => {
    const response = await request('GetTask', { id: 'task-1' });
    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toContain('application/json');
    expect(await response.json()).toMatchObject({
      jsonrpc: '2.0',
      id: 0,
      result: { id: 'task-1', contextId: 'context-1', status: { state: 'TASK_STATE_COMPLETED' } },
    });
  });

  it.each(['SendMessage', 'message/send'])('dispatches %s with v1 message parameters', async method => {
    const generate = vi.fn().mockResolvedValue({ text: 'Hello from HTTP' });
    vi.spyOn(agent, 'generate').mockImplementation(generate);
    const response = await request(method, messageParams, '1.0', 'send-request');
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      jsonrpc: '2.0',
      id: 'send-request',
      result: {
        task: {
          status: { state: 'TASK_STATE_COMPLETED' },
          artifacts: [{ parts: [{ text: 'Hello from HTTP' }] }],
        },
      },
    });
    expect(generate).toHaveBeenCalledOnce();
  });

  it.each(['SendStreamingMessage', 'message/stream'])('dispatches %s as SSE with v1 events', async method => {
    const stream = vi.fn().mockResolvedValue({
      fullStream: (async function* () {
        yield { type: 'text-delta', textDelta: 'Hello from SSE' };
      })(),
      text: Promise.resolve('Hello from SSE'),
      object: Promise.resolve(undefined),
      toolCalls: Promise.resolve([]),
      toolResults: Promise.resolve([]),
      usage: Promise.resolve(undefined),
      finishReason: Promise.resolve('stop'),
      suspendPayload: Promise.resolve(undefined),
      resumeSchema: Promise.resolve(undefined),
    });
    vi.spyOn(agent, 'stream').mockImplementation(stream);
    const response = await request(method, messageParams, '1.0', 'stream-request');
    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toContain('text/event-stream');
    const events = (await response.text())
      .split('\n')
      .filter(line => line.startsWith('data: '))
      .map(line => JSON.parse(line.slice(6)));
    expect(events.length).toBeGreaterThan(1);
    for (const event of events) {
      expect(event).toMatchObject({ jsonrpc: '2.0', id: 'stream-request' });
      expect(event.error).toBeUndefined();
    }
    expect(events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          result: expect.objectContaining({ task: expect.objectContaining({ id: expect.any(String) }) }),
        }),
        expect.objectContaining({
          result: expect.objectContaining({
            statusUpdate: expect.objectContaining({
              status: expect.objectContaining({ state: 'TASK_STATE_COMPLETED' }),
            }),
          }),
        }),
      ]),
    );
    expect(JSON.stringify(events)).toContain('Hello from SSE');
    expect(stream).toHaveBeenCalledOnce();
  });

  it.each(['SubscribeToTask', 'tasks/resubscribe'])(
    'dispatches %s as SSE and closes for a completed task',
    async method => {
      const response = await request(method, { id: 'task-1' }, '1.0', 'subscription');
      expect(response.status).toBe(200);
      expect(response.headers.get('Content-Type')).toContain('text/event-stream');
      const events = (await response.text())
        .split('\n')
        .filter(line => line.startsWith('data: '))
        .map(line => JSON.parse(line.slice(6)));
      expect(events).toEqual([
        expect.objectContaining({
          jsonrpc: '2.0',
          id: 'subscription',
          result: {
            task: expect.objectContaining({
              id: 'task-1',
              status: expect.objectContaining({ state: 'TASK_STATE_COMPLETED' }),
            }),
          },
        }),
      ]);
    },
  );

  const additionalMethods = [
    { alias: 'ListTasks', legacy: 'tasks/list', params: {} },
    { alias: 'CancelTask', legacy: 'tasks/cancel', params: { id: 'task-1' } },
    {
      alias: 'CreateTaskPushNotificationConfig',
      legacy: 'tasks/pushNotificationConfig/set',
      params: { taskId: 'missing-task', pushNotificationConfig: { url: 'https://example.com/push' } },
    },
    {
      alias: 'GetTaskPushNotificationConfig',
      legacy: 'tasks/pushNotificationConfig/get',
      params: { id: 'task-1', pushNotificationConfigId: 'push-1' },
    },
    { alias: 'ListTaskPushNotificationConfigs', legacy: 'tasks/pushNotificationConfig/list', params: { id: 'task-1' } },
    {
      alias: 'DeleteTaskPushNotificationConfig',
      legacy: 'tasks/pushNotificationConfig/delete',
      params: { id: 'task-1', pushNotificationConfigId: 'push-1' },
    },
    { alias: 'GetExtendedAgentCard', legacy: 'agent/getAuthenticatedExtendedCard', params: undefined },
  ];

  it.each(additionalMethods)('dispatches $alias identically to $legacy', async ({ alias, legacy, params }) => {
    const response = await request(alias, params);
    const control = await request(legacy, params);
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.error?.code).not.toBe(-32601);
    expect(body).toEqual(await control.json());
    for (const version of ['', '0.3']) {
      const rejected = await request(alias, params, version);
      expect(await rejected.json()).toMatchObject({ jsonrpc: '2.0', id: 0, error: { code: -32601 } });
    }
  });

  it.each(['', '0.3'])('rejects a v1 method without v1 negotiation (header %j)', async version => {
    const generate = vi.spyOn(agent, 'generate');
    const response = await request('SendMessage', messageParams, version, 'rejected');
    expect(response.headers.get('Content-Type')).toContain('application/json');
    expect(await response.json()).toMatchObject({ jsonrpc: '2.0', id: 'rejected', error: { code: -32601 } });
    expect(generate).not.toHaveBeenCalled();
  });

  it.each(['', '0.3', '1.0'])('preserves legacy method names with header %j', async version => {
    const response = await request('tasks/get', { id: 'task-1' }, version, 42);
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      jsonrpc: '2.0',
      id: 42,
      result: { id: 'task-1', status: { state: version === '1.0' ? 'TASK_STATE_COMPLETED' : 'completed' } },
    });
  });

  it('returns the protocol version error for an unsupported version', async () => {
    const response = await request('GetTask', { id: 'task-1' }, '2.0', 'unsupported');
    expect(await response.json()).toMatchObject({ jsonrpc: '2.0', id: 'unsupported', error: { code: -32009 } });
  });

  it.each([
    { method: 'UnknownMethod', params: { id: 'task-1' } },
    { method: 'GetTask', params: { id: 123 } },
    { method: 'SendMessage', params: {} },
  ])('rejects invalid HTTP payloads for $method', async ({ method, params }) => {
    const response = await request(method, params);
    expect(response.status).toBe(400);
    expect(response.headers.get('Content-Type')).toContain('application/json');
    expect(await response.json()).toHaveProperty('error');
  });
});

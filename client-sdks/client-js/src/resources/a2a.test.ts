import type { Server } from 'node:http';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import type { AgentCard, MessageSendParams, Task, TaskPushNotificationConfig } from '@mastra/core/a2a';
import { describe, it, beforeEach, afterEach, expect, expectTypeOf } from 'vitest';
import { MastraClientError } from '../types';
import { A2A } from './a2a';
import type { A2AStreamEventData, SendMessageResult } from './a2a';

async function collectStream<T>(stream: AsyncIterable<T>): Promise<T[]> {
  const chunks: T[] = [];

  for await (const chunk of stream) {
    chunks.push(chunk);
  }

  return chunks;
}

describe('A2A', () => {
  let server: Server;
  let serverUrl: string;

  beforeEach(async () => {
    server = createServer();

    await new Promise<void>(resolve => {
      server.listen(0, '127.0.0.1', () => {
        resolve();
      });
    });

    const address = server.address() as AddressInfo;
    serverUrl = `http://127.0.0.1:${address.port}`;
  });

  afterEach(async () => {
    await new Promise<void>((resolve, reject) => {
      server.close(err => (err ? reject(err) : resolve()));
    });
  });

  describe('agent card operations', () => {
    it('getAgentCard fetches the well-known agent card', async () => {
      const mockCard: AgentCard = {
        name: 'Test Agent',
        description: 'A test agent',
        url: `${serverUrl}/api/a2a/test-agent`,
        version: '1.0.0',
        protocolVersion: '0.3.0',
        capabilities: {},
        defaultInputModes: ['text/plain'],
        defaultOutputModes: ['text/plain'],
        skills: [],
      };

      server.on('request', (_req, res) => {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(mockCard));
      });

      const a2a = new A2A({ baseUrl: serverUrl }, 'test-agent');

      await expect(a2a.getAgentCard()).resolves.toEqual(mockCard);
      await expect(a2a.getCard()).resolves.toEqual(mockCard);
    });

    it('getExtendedAgentCard sends the authenticated extended card method', async () => {
      let receivedBody: Record<string, unknown> | undefined;
      const mockResponse = {
        jsonrpc: '2.0',
        id: 'req-1',
        error: {
          code: -32007,
          message: 'Extended agent card is not configured',
        },
      };

      server.on('request', (req, res) => {
        let body = '';
        req.on('data', chunk => {
          body += chunk;
        });
        req.on('end', () => {
          receivedBody = JSON.parse(body);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(mockResponse));
        });
      });

      const a2a = new A2A({ baseUrl: serverUrl }, 'test-agent');

      await expect(a2a.getExtendedAgentCard()).rejects.toMatchObject({
        name: 'MastraA2AError',
        code: -32007,
        message: 'Extended agent card is not configured',
      });
      expect(receivedBody).toMatchObject({
        jsonrpc: '2.0',
        method: 'agent/getAuthenticatedExtendedCard',
      });
      expect(receivedBody).not.toHaveProperty('params');
    });
  });

  describe('sendMessage', () => {
    it('returns the unwrapped message or task result for non-streaming requests', async () => {
      const mockResponse = {
        jsonrpc: '2.0',
        id: 'req-1',
        result: {
          kind: 'task',
          id: 'task-1',
          status: { state: 'completed', message: { text: 'Done!' } },
        },
      };

      server.on('request', (_req, res) => {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(mockResponse));
      });

      const a2a = new A2A({ baseUrl: serverUrl }, 'test-agent');
      const params: MessageSendParams = {
        message: {
          messageId: 'msg-1',
          kind: 'message',
          role: 'user',
          parts: [{ kind: 'text', text: 'Hello' }],
        },
      };

      const response = await a2a.sendMessage(params);
      expectTypeOf(a2a.sendMessage(params)).toEqualTypeOf<Promise<SendMessageResult>>();
      expect(response).toEqual(mockResponse.result);
    });

    it('should include JSON-RPC 2.0 fields in the request body', async () => {
      let receivedBody: Record<string, unknown> | undefined;

      server.on('request', (req, res) => {
        let body = '';
        req.on('data', chunk => {
          body += chunk;
        });
        req.on('end', () => {
          receivedBody = JSON.parse(body);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ jsonrpc: '2.0', id: receivedBody?.id, result: {} }));
        });
      });

      const a2a = new A2A({ baseUrl: serverUrl }, 'test-agent');
      const params: MessageSendParams = {
        message: {
          messageId: 'msg-1',
          kind: 'message',
          role: 'user',
          parts: [{ kind: 'text', text: 'Hello' }],
        },
      };

      await a2a.sendMessage(params);

      expect(receivedBody).toMatchObject({
        jsonrpc: '2.0',
        method: 'message/send',
        params,
      });
      expect(typeof receivedBody?.id).toBe('string');
    });
  });

  describe('streaming methods', () => {
    const params: MessageSendParams = {
      message: {
        messageId: 'msg-1',
        kind: 'message',
        role: 'user',
        parts: [{ kind: 'text', text: 'Hello' }],
      },
    };

    it('sendMessageStream returns a typed async generator', () => {
      const a2a = new A2A({ baseUrl: serverUrl }, 'test-agent');

      expectTypeOf(a2a.sendMessageStream(params)).toEqualTypeOf<AsyncGenerator<A2AStreamEventData, void, undefined>>();
      expectTypeOf(a2a.sendStreamingMessage(params)).toEqualTypeOf<
        AsyncGenerator<A2AStreamEventData, void, undefined>
      >();
    });

    it('sendMessageStream unwraps JSON-RPC SSE events into A2A event data', async () => {
      const streamEvents = [
        { kind: 'task', id: 'task-1', status: { state: 'submitted' } },
        { kind: 'status-update', taskId: 'task-1', status: { state: 'working' }, final: false },
        {
          kind: 'artifact-update',
          taskId: 'task-1',
          artifact: {
            artifactId: 'artifact-1',
            name: 'result',
            parts: [{ kind: 'text', text: 'Done!' }],
          },
          append: false,
          lastChunk: true,
        },
      ];

      server.on('request', (req, res) => {
        let body = '';
        req.on('data', chunk => {
          body += chunk;
        });
        req.on('end', () => {
          const parsedBody = JSON.parse(body);
          expect(parsedBody.method).toBe('message/stream');

          res.writeHead(200, { 'Content-Type': 'text/event-stream' });
          for (const event of streamEvents) {
            res.write(`data: ${JSON.stringify({ jsonrpc: '2.0', result: event })}\n\n`);
          }
          res.end();
        });
      });

      const a2a = new A2A({ baseUrl: serverUrl }, 'test-agent');
      const received = await collectStream(a2a.sendMessageStream(params));

      expect(received).toHaveLength(3);
      expect(received.map(event => event.kind)).toEqual(['task', 'status-update', 'artifact-update']);
      expect(received[2]).toMatchObject({
        kind: 'artifact-update',
        artifact: {
          parts: [{ kind: 'text', text: 'Done!' }],
        },
      });
    });

    it('deprecated sendStreamingMessage also yields typed stream events', async () => {
      const streamEvents = [
        { kind: 'task', id: 'task-1', status: { state: 'submitted' } },
        { kind: 'status-update', taskId: 'task-1', status: { state: 'completed' }, final: true },
      ];

      server.on('request', (_req, res) => {
        res.writeHead(200, { 'Content-Type': 'text/event-stream' });
        for (const event of streamEvents) {
          res.write(`${JSON.stringify({ jsonrpc: '2.0', result: event })}\x1E`);
        }
        res.end();
      });

      const a2a = new A2A({ baseUrl: serverUrl }, 'test-agent');
      const received = await collectStream(a2a.sendStreamingMessage(params));

      expect(received).toHaveLength(2);
      expect(received[0]).toMatchObject({ kind: 'task' });
      expect(received[1]).toMatchObject({ kind: 'status-update', final: true });
    });

    it('throws a MastraClientError when the stream emits a JSON-RPC error', async () => {
      server.on('request', (_req, res) => {
        res.writeHead(200, { 'Content-Type': 'text/event-stream' });
        res.write(
          `data: ${JSON.stringify({
            jsonrpc: '2.0',
            error: { code: -32001, message: 'Task not found' },
          })}\n\n`,
        );
        res.end();
      });

      const a2a = new A2A({ baseUrl: serverUrl }, 'test-agent');

      await expect(collectStream(a2a.sendMessageStream(params))).rejects.toBeInstanceOf(MastraClientError);
    });
  });

  describe('task operations', () => {
    it('cancelTask returns the unwrapped Task type', () => {
      const a2a = new A2A({ baseUrl: serverUrl }, 'test-agent');
      expectTypeOf(a2a.cancelTask({ id: 'task-1' })).toEqualTypeOf<Promise<Task>>();
    });

    it('cancelTask sends the tasks/cancel JSON-RPC method', async () => {
      let receivedBody: Record<string, unknown> | undefined;

      server.on('request', (req, res) => {
        let body = '';
        req.on('data', chunk => {
          body += chunk;
        });
        req.on('end', () => {
          receivedBody = JSON.parse(body);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ jsonrpc: '2.0', id: receivedBody?.id, result: { kind: 'task', id: 'task-1' } }));
        });
      });

      const a2a = new A2A({ baseUrl: serverUrl }, 'test-agent');
      const response = await a2a.cancelTask({ id: 'task-1' });

      expect(receivedBody).toMatchObject({
        method: 'tasks/cancel',
        params: { id: 'task-1' },
      });
      expect(response).toEqual({ kind: 'task', id: 'task-1' });
    });

    it('getTask returns the unwrapped Task result', async () => {
      server.on('request', (_req, res) => {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(
          JSON.stringify({
            jsonrpc: '2.0',
            id: 'req-1',
            result: { kind: 'task', id: 'task-1', status: { state: 'working' } },
          }),
        );
      });

      const a2a = new A2A({ baseUrl: serverUrl }, 'test-agent');
      const task = await a2a.getTask({ id: 'task-1' });

      expectTypeOf(a2a.getTask({ id: 'task-1' })).toEqualTypeOf<Promise<Task>>();
      expect(task).toEqual({ kind: 'task', id: 'task-1', status: { state: 'working' } });
    });

    it('resubscribeTask returns typed stream events and uses tasks/resubscribe', async () => {
      let receivedBody: Record<string, unknown> | undefined;

      server.on('request', (req, res) => {
        let body = '';
        req.on('data', chunk => {
          body += chunk;
        });
        req.on('end', () => {
          receivedBody = JSON.parse(body);
          res.writeHead(200, { 'Content-Type': 'text/event-stream' });
          res.write(
            `data: ${JSON.stringify({
              jsonrpc: '2.0',
              result: { kind: 'status-update', taskId: 'task-1', status: { state: 'working' }, final: false },
            })}\n\n`,
          );
          res.end();
        });
      });

      const a2a = new A2A({ baseUrl: serverUrl }, 'test-agent');
      const response = await collectStream(a2a.resubscribeTask({ id: 'task-1' }));

      expectTypeOf(a2a.resubscribeTask({ id: 'task-1' })).toEqualTypeOf<
        AsyncGenerator<A2AStreamEventData, void, undefined>
      >();
      expect(receivedBody).toMatchObject({
        method: 'tasks/resubscribe',
        params: { id: 'task-1' },
      });
      expect(response).toEqual([
        { kind: 'status-update', taskId: 'task-1', status: { state: 'working' }, final: false },
      ]);
    });

    it('supports push notification config methods including get', async () => {
      const receivedBodies: Record<string, unknown>[] = [];
      const responses = [
        {
          jsonrpc: '2.0',
          id: '1',
          result: { taskId: 'task-1', pushNotificationConfig: { url: 'https://example.com/get' } },
        },
        {
          jsonrpc: '2.0',
          id: '2',
          result: [{ taskId: 'task-1', pushNotificationConfig: { url: 'https://example.com/list' } }],
        },
        { jsonrpc: '2.0', id: '3', result: {} },
        {
          jsonrpc: '2.0',
          id: '4',
          result: { taskId: 'task-1', pushNotificationConfig: { url: 'https://example.com/set' } },
        },
      ];

      server.on('request', (req, res) => {
        let body = '';
        req.on('data', chunk => {
          body += chunk;
        });
        req.on('end', () => {
          receivedBodies.push(JSON.parse(body));
          const response = responses[receivedBodies.length - 1];
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(response));
        });
      });

      const a2a = new A2A({ baseUrl: serverUrl }, 'test-agent');

      const getResponse = await a2a.getTaskPushNotificationConfig({ id: 'task-1' });
      const listResponse = await a2a.listTaskPushNotificationConfig({ id: 'task-1' });
      const deleteResponse = await a2a.deleteTaskPushNotificationConfig({
        id: 'task-1',
        pushNotificationConfigId: 'push-1',
      });
      const setResponse = await a2a.setTaskPushNotificationConfig({
        taskId: 'task-1',
        pushNotificationConfig: {
          url: 'https://example.com/push',
        },
      });

      expectTypeOf(getResponse).toEqualTypeOf<TaskPushNotificationConfig>();
      expectTypeOf(listResponse).toEqualTypeOf<TaskPushNotificationConfig[]>();
      expectTypeOf(deleteResponse).toEqualTypeOf<void>();
      expectTypeOf(setResponse).toEqualTypeOf<TaskPushNotificationConfig>();

      expect(receivedBodies.map(body => body.method)).toEqual([
        'tasks/pushNotificationConfig/get',
        'tasks/pushNotificationConfig/list',
        'tasks/pushNotificationConfig/delete',
        'tasks/pushNotificationConfig/set',
      ]);
      expect(receivedBodies[0]?.params).toEqual({ id: 'task-1' });
      expect(receivedBodies[1]?.params).toEqual({ id: 'task-1' });
      expect(receivedBodies[2]?.params).toEqual({ id: 'task-1', pushNotificationConfigId: 'push-1' });
      expect(receivedBodies[3]?.params).toEqual({
        taskId: 'task-1',
        pushNotificationConfig: { url: 'https://example.com/push' },
      });

      expect(getResponse).toEqual({ taskId: 'task-1', pushNotificationConfig: { url: 'https://example.com/get' } });
      expect(listResponse).toEqual([{ taskId: 'task-1', pushNotificationConfig: { url: 'https://example.com/list' } }]);
      expect(deleteResponse).toBeUndefined();
      expect(setResponse).toEqual({ taskId: 'task-1', pushNotificationConfig: { url: 'https://example.com/set' } });
    });

    it('throws a protocol-aware error for JSON-RPC task errors', async () => {
      server.on('request', (_req, res) => {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(
          JSON.stringify({ jsonrpc: '2.0', id: '1', error: { code: -32001, message: 'Task not found: task-1' } }),
        );
      });

      const a2a = new A2A({ baseUrl: serverUrl }, 'test-agent');

      await expect(a2a.getTask({ id: 'task-1' })).rejects.toMatchObject({
        name: 'MastraA2AError',
        code: -32001,
        message: 'Task not found: task-1',
      });
    });

    it('throws a protocol-aware error for unsupported push notification methods', async () => {
      server.on('request', (_req, res) => {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(
          JSON.stringify({
            jsonrpc: '2.0',
            id: '1',
            error: { code: -32003, message: 'Push Notification is not supported' },
          }),
        );
      });

      const a2a = new A2A({ baseUrl: serverUrl }, 'test-agent');

      await expect(a2a.getTaskPushNotificationConfig({ id: 'task-1' })).rejects.toMatchObject({
        name: 'MastraA2AError',
        code: -32003,
        message: 'Push Notification is not supported',
      });
    });
  });
});

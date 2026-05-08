import { generateKeyPairSync } from 'node:crypto';
import type { Server } from 'node:http';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import type {
  AgentCard,
  GetTaskResponse,
  MessageSendParams,
  SendMessageResponse,
  Task,
  TaskPushNotificationConfig,
} from '@mastra/core/a2a';
import canonicalize from 'canonicalize';
import { CompactSign, exportJWK } from 'jose';
import { describe, it, beforeEach, afterEach, expect, expectTypeOf } from 'vitest';
import { MastraClientError } from '../types';
import { A2A } from './a2a';
import type { A2AStreamEventData } from './a2a';

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
    async function createSignedAgentCard(card: AgentCard) {
      const { privateKey, publicKey } = generateKeyPairSync('ec', {
        namedCurve: 'P-256',
      });
      const canonicalPayload = canonicalize(card);

      if (!canonicalPayload) {
        throw new Error('Failed to canonicalize test Agent Card');
      }

      const compactJws = await new CompactSign(new TextEncoder().encode(canonicalPayload))
        .setProtectedHeader({
          alg: 'ES256',
          kid: 'test-key',
          jku: 'https://example.com/.well-known/jwks.json',
        })
        .sign(privateKey);

      const [protectedHeader, , signature] = compactJws.split('.');
      if (!protectedHeader || !signature) {
        throw new Error('Failed to create compact JWS for test Agent Card');
      }

      return {
        card: {
          ...card,
          signatures: [
            {
              protected: protectedHeader,
              signature,
            },
          ],
        } satisfies AgentCard,
        publicJwk: await exportJWK(publicKey),
      };
    }

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

    it('verifies a signed agent card when verifySignature is configured', async () => {
      const baseCard: AgentCard = {
        name: 'Test Agent',
        description: 'A signed test agent',
        url: `${serverUrl}/api/a2a/test-agent`,
        version: '1.0.0',
        protocolVersion: '0.3.0',
        capabilities: {},
        defaultInputModes: ['text/plain'],
        defaultOutputModes: ['text/plain'],
        skills: [],
      };
      const { card, publicJwk } = await createSignedAgentCard(baseCard);
      let keyProviderInput:
        | {
            kid?: string;
            jku?: string;
            alg?: string;
          }
        | undefined;

      server.on('request', (_req, res) => {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(card));
      });

      const a2a = new A2A({ baseUrl: serverUrl }, 'test-agent');
      const receivedCard = await a2a.getAgentCard({
        verifySignature: {
          keyProvider: input => {
            keyProviderInput = {
              kid: input.kid,
              jku: input.jku,
              alg: input.alg,
            };
            return publicJwk;
          },
          algorithms: ['ES256'],
        },
      });

      expect(receivedCard).toEqual(card);
      expect(keyProviderInput).toEqual({
        kid: 'test-key',
        jku: 'https://example.com/.well-known/jwks.json',
        alg: 'ES256',
      });
    });

    it('returns unsigned cards unchanged when verifySignature is configured', async () => {
      const mockCard: AgentCard = {
        name: 'Test Agent',
        description: 'An unsigned test agent',
        url: `${serverUrl}/api/a2a/test-agent`,
        version: '1.0.0',
        protocolVersion: '0.3.0',
        capabilities: {},
        defaultInputModes: ['text/plain'],
        defaultOutputModes: ['text/plain'],
        skills: [],
      };
      let keyProviderCalled = false;

      server.on('request', (_req, res) => {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(mockCard));
      });

      const a2a = new A2A({ baseUrl: serverUrl }, 'test-agent');
      const receivedCard = await a2a.getAgentCard({
        verifySignature: {
          keyProvider: () => {
            keyProviderCalled = true;
            return null;
          },
        },
      });

      expect(receivedCard).toEqual(mockCard);
      expect(keyProviderCalled).toBe(false);
    });

    it('throws when a signed agent card cannot be verified', async () => {
      const baseCard: AgentCard = {
        name: 'Test Agent',
        description: 'An invalid signed test agent',
        url: `${serverUrl}/api/a2a/test-agent`,
        version: '1.0.0',
        protocolVersion: '0.3.0',
        capabilities: {},
        defaultInputModes: ['text/plain'],
        defaultOutputModes: ['text/plain'],
        skills: [],
      };
      const { card, publicJwk } = await createSignedAgentCard(baseCard);
      const invalidCard: AgentCard = {
        ...card,
        signatures: card.signatures?.map((signature, index) =>
          index === 0
            ? {
                ...signature,
                signature: `${signature.signature.slice(0, -1)}${signature.signature.at(-1) === 'A' ? 'B' : 'A'}`,
              }
            : signature,
        ),
      };

      server.on('request', (_req, res) => {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(invalidCard));
      });

      const a2a = new A2A({ baseUrl: serverUrl }, 'test-agent');

      await expect(
        a2a.getAgentCard({
          verifySignature: {
            keyProvider: () => publicJwk,
            algorithms: ['ES256'],
          },
        }),
      ).rejects.toThrow('A2A Agent Card signature verification failed');
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
    it('returns the full JSON-RPC envelope (backward-compatible contract)', async () => {
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
      expectTypeOf<ReturnType<A2A['sendMessage']>>().toEqualTypeOf<Promise<SendMessageResponse>>();
      expect(response).toEqual(mockResponse);
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
      expectTypeOf<ReturnType<A2A['sendMessageStream']>>().toEqualTypeOf<
        AsyncGenerator<A2AStreamEventData, void, undefined>
      >();
      expectTypeOf<ReturnType<A2A['sendStreamingMessage']>>().toEqualTypeOf<Promise<Response>>();
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

    it('deprecated sendStreamingMessage returns a raw Response for backward compatibility', async () => {
      server.on('request', (_req, res) => {
        res.writeHead(200, { 'Content-Type': 'text/event-stream' });
        res.write(`data: ${JSON.stringify({ jsonrpc: '2.0', result: { kind: 'task', id: 'task-1' } })}\n\n`);
        res.end();
      });

      const a2a = new A2A({ baseUrl: serverUrl }, 'test-agent');
      const response = await a2a.sendStreamingMessage(params);

      expect(response).toBeInstanceOf(Response);
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

    it('throws a MastraClientError when the stream response has no body', async () => {
      server.on('request', (_req, res) => {
        res.writeHead(204);
        res.end();
      });

      const a2a = new A2A({ baseUrl: serverUrl }, 'test-agent');

      await expect(collectStream(a2a.sendMessageStream(params))).rejects.toMatchObject({
        name: 'MastraClientError',
        status: 204,
      });
    });
  });

  describe('task operations', () => {
    it('cancelTask returns the full JSON-RPC envelope (backward-compatible contract)', () => {
      expectTypeOf<ReturnType<A2A['cancelTask']>>().toEqualTypeOf<Promise<Task>>();
    });

    it('cancelTask sends the tasks/cancel JSON-RPC method', async () => {
      let receivedBody: Record<string, unknown> | undefined;
      const mockEnvelope = { jsonrpc: '2.0', id: 'req-1', result: { kind: 'task', id: 'task-1' } };

      server.on('request', (req, res) => {
        let body = '';
        req.on('data', chunk => {
          body += chunk;
        });
        req.on('end', () => {
          receivedBody = JSON.parse(body);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(mockEnvelope));
        });
      });

      const a2a = new A2A({ baseUrl: serverUrl }, 'test-agent');
      const response = await a2a.cancelTask({ id: 'task-1' });

      expect(receivedBody).toMatchObject({
        method: 'tasks/cancel',
        params: { id: 'task-1' },
      });
      expect(response).toMatchObject({ result: { kind: 'task', id: 'task-1' } });
    });

    it('getTask returns the full JSON-RPC envelope (backward-compatible contract)', async () => {
      const mockEnvelope = {
        jsonrpc: '2.0',
        id: 'req-1',
        result: { kind: 'task', id: 'task-1', status: { state: 'working' } },
      };

      server.on('request', (_req, res) => {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(mockEnvelope));
      });

      const a2a = new A2A({ baseUrl: serverUrl }, 'test-agent');
      const task = await a2a.getTask({ id: 'task-1' });

      expectTypeOf<ReturnType<A2A['getTask']>>().toEqualTypeOf<Promise<GetTaskResponse>>();
      expect(task).toEqual(mockEnvelope);
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

      expectTypeOf<ReturnType<A2A['resubscribeTask']>>().toEqualTypeOf<
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

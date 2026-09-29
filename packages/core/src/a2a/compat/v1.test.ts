import { describe, expect, it } from 'vitest';
import { v1Compat } from './v1';

describe('v1Compat', () => {
  it('adds the v1 header and creates spec-compliant requests', () => {
    expect(v1Compat.headers).toEqual({ 'A2A-Version': '1.0' });
    expect(v1Compat.methods).toEqual({
      sendMessage: 'SendMessage',
      streamMessage: 'SendStreamingMessage',
      getTask: 'GetTask',
      resubscribeTask: 'SubscribeToTask',
    });
    expect(v1Compat.createSendMessageParams({ prompt: 'hello', taskId: 'task-1' })).toMatchObject({
      message: {
        role: 'ROLE_USER',
        parts: [{ text: 'hello' }],
        taskId: 'task-1',
      },
    });
    expect(v1Compat.createGetTaskParams('task-1')).toEqual({ id: 'task-1' });
    expect(v1Compat.createResubscribeParams('task-1')).toEqual({ id: 'task-1' });
  });

  it('normalizes a v1 agent card and selects its JSON-RPC interface', () => {
    expect(
      v1Compat.decodeAgentCard({
        name: 'Remote Agent',
        description: 'A remote agent',
        supportedInterfaces: [
          { url: 'https://remote.example.com/grpc', protocolBinding: 'GRPC', protocolVersion: '1.0' },
          { url: 'https://remote.example.com/a2a-v0', protocolBinding: 'JSONRPC', protocolVersion: '0.3' },
          { url: 'https://remote.example.com/a2a', protocolBinding: 'JSONRPC', protocolVersion: '1.0' },
        ],
        version: '1.0',
        capabilities: { streaming: true },
        defaultInputModes: ['text/plain'],
        defaultOutputModes: ['text/plain'],
        skills: [],
      }),
    ).toMatchObject({
      name: 'Remote Agent',
      url: 'https://remote.example.com/a2a',
      preferredTransport: 'JSONRPC',
      protocolVersion: '1.0',
    });

    expect(() =>
      v1Compat.decodeAgentCard({
        name: 'Remote Agent',
        description: 'A remote agent',
        supportedInterfaces: [
          { url: 'https://remote.example.com/grpc', protocolBinding: 'GRPC', protocolVersion: '1.0' },
        ],
        version: '1.0',
        capabilities: {},
        defaultInputModes: [],
        defaultOutputModes: [],
        skills: [],
      }),
    ).toThrow('Remote A2A v1.0 agent card does not advertise a JSON-RPC interface.');
  });

  it('normalizes v1 response and stream payloads', () => {
    expect(
      v1Compat.decodeSendMessageResult({
        message: { messageId: 'message-1', role: 'ROLE_AGENT', parts: [{ text: 'done' }] },
      }),
    ).toMatchObject({
      kind: 'message',
      messageId: 'message-1',
      role: 'agent',
      parts: [{ kind: 'text', text: 'done' }],
    });

    expect(
      v1Compat.decodeStreamResult({
        statusUpdate: {
          taskId: 'task-1',
          contextId: 'context-1',
          status: { state: 'TASK_STATE_COMPLETED' },
        },
      }),
    ).toMatchObject({
      kind: 'status-update',
      taskId: 'task-1',
      contextId: 'context-1',
      status: { state: 'completed' },
    });
  });

  it('rejects empty v1 payloads', () => {
    expect(() => v1Compat.decodeSendMessageResult({})).toThrow(
      'Remote A2A v1.0 agent returned an empty message response.',
    );
    expect(() => v1Compat.decodeStreamResult({})).toThrow('Remote A2A v1.0 agent returned an empty stream payload.');
  });
});

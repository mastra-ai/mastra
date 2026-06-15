import { describe, expect, it } from 'vitest';

import { agentExecutionBodySchema } from './a2a';

describe('a2a schemas', () => {
  it('accepts A2A vNext methods and params', () => {
    expect(
      agentExecutionBodySchema.safeParse({
        jsonrpc: '2.0',
        id: 'req-1',
        method: 'message/send',
        params: {
          message: {
            kind: 'message',
            messageId: 'message-1',
            role: 'user',
            parts: [{ kind: 'text', text: 'hi' }],
          },
          configuration: {
            acceptedOutputModes: ['text/plain'],
            blocking: true,
          },
        },
      }).success,
    ).toBe(true);

    expect(
      agentExecutionBodySchema.safeParse({
        jsonrpc: '2.0',
        id: 'req-2',
        method: 'tasks/resubscribe',
        params: { id: 'task-1' },
      }).success,
    ).toBe(true);

    expect(
      agentExecutionBodySchema.safeParse({
        jsonrpc: '2.0',
        id: 'req-3',
        method: 'tasks/pushNotificationConfig/set',
        params: {
          taskId: 'task-1',
          pushNotificationConfig: {
            url: 'https://example.com/push',
          },
        },
      }).success,
    ).toBe(true);

    expect(
      agentExecutionBodySchema.safeParse({
        jsonrpc: '2.0',
        id: 'req-4',
        method: 'tasks/pushNotificationConfig/get',
        params: { id: 'task-1', pushNotificationConfigId: 'push-1' },
      }).success,
    ).toBe(true);

    expect(
      agentExecutionBodySchema.safeParse({
        jsonrpc: '2.0',
        id: 'req-5',
        method: 'tasks/pushNotificationConfig/list',
        params: { id: 'task-1' },
      }).success,
    ).toBe(true);

    expect(
      agentExecutionBodySchema.safeParse({
        jsonrpc: '2.0',
        id: 'req-6',
        method: 'tasks/pushNotificationConfig/delete',
        params: { id: 'task-1', pushNotificationConfigId: 'push-1' },
      }).success,
    ).toBe(true);

    expect(
      agentExecutionBodySchema.safeParse({
        jsonrpc: '2.0',
        id: 'req-7',
        method: 'agent/getAuthenticatedExtendedCard',
      }).success,
    ).toBe(true);
  });

  it('rejects the legacy taskPushNotificationConfig field name', () => {
    const result = agentExecutionBodySchema.safeParse({
      jsonrpc: '2.0',
      id: 'req-1',
      method: 'tasks/pushNotificationConfig/set',
      params: {
        taskId: 'task-1',
        taskPushNotificationConfig: {
          url: 'https://example.com/push',
        },
      },
    });

    expect(result.success).toBe(false);
  });
});

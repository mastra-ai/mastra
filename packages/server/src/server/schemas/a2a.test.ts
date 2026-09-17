import { describe, expect, it } from 'vitest';

import { a2aV1MethodMap, agentExecutionBodySchema } from './a2a';

describe('a2a schemas', () => {
  const methodCases = [
    {
      alias: 'SendMessage',
      legacy: 'message/send',
      params: { message: { messageId: 'message-1', role: 'ROLE_USER', parts: [{ text: 'hi' }] } },
    },
    {
      alias: 'SendStreamingMessage',
      legacy: 'message/stream',
      params: { message: { messageId: 'message-1', role: 'ROLE_USER', parts: [{ text: 'hi' }] } },
    },
    { alias: 'GetTask', legacy: 'tasks/get', params: { id: 'task-1' } },
    { alias: 'ListTasks', legacy: 'tasks/list', params: { pageSize: 10 } },
    { alias: 'CancelTask', legacy: 'tasks/cancel', params: { id: 'task-1' } },
    { alias: 'SubscribeToTask', legacy: 'tasks/resubscribe', params: { id: 'task-1' } },
    {
      alias: 'CreateTaskPushNotificationConfig',
      legacy: 'tasks/pushNotificationConfig/set',
      params: { taskId: 'task-1', pushNotificationConfig: { url: 'https://example.com/push' } },
      aliasParams: { taskId: 'task-1', id: 'push-1', url: 'https://example.com/push' },
    },
    {
      alias: 'GetTaskPushNotificationConfig',
      legacy: 'tasks/pushNotificationConfig/get',
      params: { id: 'task-1', pushNotificationConfigId: 'push-1' },
      aliasParams: { taskId: 'task-1', id: 'push-1' },
    },
    {
      alias: 'ListTaskPushNotificationConfigs',
      legacy: 'tasks/pushNotificationConfig/list',
      params: { id: 'task-1' },
      aliasParams: { taskId: 'task-1', pageSize: 10, pageToken: '0' },
    },
    {
      alias: 'DeleteTaskPushNotificationConfig',
      legacy: 'tasks/pushNotificationConfig/delete',
      params: { id: 'task-1', pushNotificationConfigId: 'push-1' },
      aliasParams: { taskId: 'task-1', id: 'push-1' },
    },
    { alias: 'GetExtendedAgentCard', legacy: 'agent/getAuthenticatedExtendedCard', params: undefined },
  ] as const;

  it.each(methodCases)(
    'accepts $alias and $legacy without changing their spelling',
    ({ alias, legacy, params, ...testCase }) => {
      expect(a2aV1MethodMap[alias]).toBe(legacy);
      const aliasParams = 'aliasParams' in testCase ? testCase.aliasParams : params;

      const parsedAlias = agentExecutionBodySchema.parse({
        jsonrpc: '2.0',
        id: 'req-1',
        method: alias,
        params: aliasParams,
      });
      expect(parsedAlias.method).toBe(alias);

      const parsedLegacy = agentExecutionBodySchema.parse({ jsonrpc: '2.0', id: 'req-1', method: legacy, params });
      expect(parsedLegacy.method).toBe(legacy);
    },
  );

  it.each(methodCases.filter(({ params }) => params !== undefined))(
    'rejects malformed params for $alias and $legacy',
    ({ alias, legacy }) => {
      for (const method of [alias, legacy]) {
        expect(
          agentExecutionBodySchema.safeParse({ jsonrpc: '2.0', id: 'req-1', method, params: { id: 1, pageSize: 0 } })
            .success,
        ).toBe(false);
      }
    },
  );

  it.each(methodCases)('rejects incorrect casing for $alias', ({ alias, params }) => {
    expect(
      agentExecutionBodySchema.safeParse({ jsonrpc: '2.0', id: 'req-1', method: alias.toLowerCase(), params }).success,
    ).toBe(false);
  });

  it.each(['UnknownMethod', 'ListTaskPushNotificationConfig', 'tasks/unknown'])('rejects unknown method %s', method => {
    expect(agentExecutionBodySchema.safeParse({ jsonrpc: '2.0', id: 'req-1', method, params: {} }).success).toBe(false);
  });

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

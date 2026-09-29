import { randomUUID } from 'node:crypto';
import type { AgentCard, Message, Task } from '@a2a-js/sdk-v0_3';
import { MastraA2AError } from '../error';
import type { A2AProtocolCompat, A2AStreamEventData, SendMessageInput } from './types';

function isTask(value: Message | Task | A2AStreamEventData): value is Task {
  return typeof value === 'object' && value !== null && 'status' in value && 'id' in value && 'kind' in value;
}

export const v0_3Compat: A2AProtocolCompat = {
  headers: {},
  methods: {
    sendMessage: 'message/send',
    streamMessage: 'message/stream',
    getTask: 'tasks/get',
    resubscribeTask: 'tasks/resubscribe',
  },
  decodeAgentCard: value => value as AgentCard,
  createSendMessageParams: ({ prompt, data, contextId, taskId }: SendMessageInput) => ({
    message: {
      role: 'user',
      kind: 'message',
      messageId: randomUUID(),
      parts: [{ kind: 'text', text: prompt }, ...(data ? [{ kind: 'data' as const, data }] : [])],
      ...(contextId ? { contextId } : {}),
      ...(taskId ? { taskId } : {}),
    },
  }),
  decodeSendMessageResult: value => value as Message | Task,
  createGetTaskParams: taskId => ({ id: taskId }),
  decodeGetTaskResult: value => {
    const result = value as A2AStreamEventData;
    if (!isTask(result)) {
      throw MastraA2AError.invalidAgentResponse('Remote A2A agent returned a non-task response for tasks/get.');
    }
    return result;
  },
  createResubscribeParams: taskId => ({ id: taskId }),
  decodeStreamResult: value => value as A2AStreamEventData,
};

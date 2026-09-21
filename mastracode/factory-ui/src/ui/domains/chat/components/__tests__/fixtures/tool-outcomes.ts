import type { MessageEntry } from '../../../services/transcript';

export const settledTools: MessageEntry = {
  kind: 'message',
  id: 'settled-tools',
  message: {
    id: 'settled-tools',
    role: 'assistant',
    createdAt: new Date('2026-09-16T10:00:00.000Z'),
    content: {
      format: 2,
      parts: [
        {
          type: 'tool-invocation',
          toolInvocation: { state: 'result', toolCallId: 'empty', toolName: 'view', args: {}, result: undefined },
        },
        {
          type: 'tool-invocation',
          toolInvocation: { state: 'result', toolCallId: 'false', toolName: 'view', args: {}, result: false },
        },
        {
          type: 'tool-invocation',
          toolInvocation: {
            state: 'output-denied',
            toolCallId: 'denied',
            toolName: 'write_file',
            args: {},
            errorText: 'Permission denied',
          },
        },
      ],
    },
  },
};

export const runningTools: MessageEntry = {
  ...settledTools,
  message: {
    ...settledTools.message,
    content: {
      ...settledTools.message.content,
      parts: [
        ...settledTools.message.content.parts.slice(0, 2),
        {
          type: 'tool-invocation',
          toolInvocation: { state: 'call', toolCallId: 'live', toolName: 'view', args: {} },
        },
      ],
    },
  },
  runtimeTools: {
    live: {
      toolCallId: 'live',
      toolName: 'view',
      argsText: '',
      output: '',
      status: 'running',
      result: 'Partial output',
    },
  },
};

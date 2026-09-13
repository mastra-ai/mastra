import type { ListMemoryThreadMessagesResponse } from '@mastra/client-js';

export const failedParentMessages: ListMemoryThreadMessagesResponse = {
  messages: [
    {
      id: 'parent-message',
      role: 'assistant',
      createdAt: new Date('2026-09-08T12:00:00Z'),
      threadId: 'parent-thread',
      resourceId: 'resource',
      content: {
        format: 2,
        parts: [
          {
            type: 'tool-invocation',
            toolInvocation: {
              toolCallId: 'failed-delegation',
              toolName: 'agent-head',
              args: {},
              state: 'output-error',
              errorText: '[Agent:sup] - Failed agent tool execution for head',
              result: { subAgentThreadId: 'child-thread', subAgentResourceId: 'resource' },
            },
          },
        ],
      },
    },
  ],
};

export const partialChildMessages: ListMemoryThreadMessagesResponse = {
  messages: [
    {
      id: 'child-message',
      role: 'assistant',
      createdAt: new Date('2026-09-08T12:00:00Z'),
      threadId: 'child-thread',
      resourceId: 'resource',
      content: { format: 2, parts: [{ type: 'text', text: 'Partial enrichment recovered from memory' }] },
    },
  ],
};

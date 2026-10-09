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

export const resumedChildMessages: ListMemoryThreadMessagesResponse = {
  messages: [
    {
      id: 'child-before-resume',
      role: 'assistant',
      createdAt: new Date('2026-09-08T12:00:00Z'),
      threadId: 'child-thread',
      resourceId: 'resource',
      content: {
        format: 2,
        parts: [
          { type: 'text', text: 'Checking the lookup' },
          {
            type: 'tool-invocation',
            toolInvocation: {
              toolCallId: 'approved-lookup',
              toolName: 'approvedLookup',
              args: {},
              state: 'result',
              result: { approved: true },
            },
          },
        ],
      },
    },
    {
      id: 'child-resume-input',
      role: 'user',
      createdAt: new Date('2026-09-08T12:00:01Z'),
      threadId: 'child-thread',
      resourceId: 'resource',
      content: { format: 2, parts: [{ type: 'text', text: 'Resume the approved lookup' }] },
    },
    {
      id: 'child-after-resume',
      role: 'assistant',
      createdAt: new Date('2026-09-08T12:00:02Z'),
      threadId: 'child-thread',
      resourceId: 'resource',
      content: {
        format: 2,
        parts: [
          { type: 'text', text: 'Checking the lookup' },
          { type: 'text', text: 'RESUMED PARTIAL: approved lookup completed.' },
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

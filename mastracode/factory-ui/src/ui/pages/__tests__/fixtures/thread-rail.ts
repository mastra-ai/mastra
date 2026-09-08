import type { MastraDBMessage } from '@mastra/client-js';

const createdAt = new Date('2026-08-03T09:00:00.000Z');

export const assistantOnlyThreadMessages: MastraDBMessage[] = [
  {
    id: 'assistant-only',
    role: 'assistant',
    createdAt,
    content: {
      format: 2,
      parts: [{ type: 'text', text: 'There are no user turns in this thread.' }],
    },
  },
];

export const threadRailMessages: MastraDBMessage[] = [
  {
    id: 'user-plan',
    role: 'user',
    createdAt,
    content: {
      format: 2,
      parts: [
        { type: 'text', text: 'Review the implementation plan' },
        {
          type: 'file',
          mimeType: 'text/markdown',
          data: 'https://files.example.com/plan.md',
        },
      ],
    },
  },
  {
    id: 'assistant-review',
    role: 'assistant',
    createdAt,
    content: {
      format: 2,
      parts: [{ type: 'text', text: 'The implementation is ready to review.' }],
    },
  },
  {
    id: 'user-checks',
    role: 'user',
    createdAt,
    content: {
      format: 2,
      parts: [{ type: 'text', text: 'Run the focused checks' }],
    },
  },
];

const echoedUserMessage: MastraDBMessage = {
  id: 'user-plan-echo',
  role: 'user',
  createdAt,
  content: {
    format: 2,
    parts: [{ type: 'data-user-message', data: { contents: 'Review the implementation plan' } }],
  },
};

export const threadRailMessagesWithEcho: MastraDBMessage[] = [
  ...threadRailMessages.slice(0, 1),
  echoedUserMessage,
  ...threadRailMessages.slice(1),
];

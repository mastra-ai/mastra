import type { FilePart } from '@mastra/react';
import type { ToolCallGroupStep } from '@/ds/components/ai/tool-call';

export type ChatFile = FilePart & { filename: string };
export type Phase = 'complete' | 'streaming' | 'stopped' | 'question' | 'approval' | 'declined' | 'error';
export type Scenario = Phase | 'empty' | 'long';

export interface Turn {
  id: string;
  prompt: string;
  files: ChatFile[];
  phase: Phase;
  text: string;
  answer?: string;
  review?: boolean;
}

export const reply = `The composer now keeps attachments beside the draft and sends them with the message.

- **Keyboard:** Enter sends; Shift + Enter adds a line.
- **Attachments:** previews stay available in the conversation.
- **Streaming:** Stop keeps the partial reply, and the next message starts a new turn.

\`\`\`tsx
<ComposerInput aria-label="Message" placeholder="Ask a follow-up…" />
\`\`\`

The conversation is ready for another review.`;

export const reviewFiles: ChatFile[] = [
  {
    type: 'file',
    filename: 'review-notes.txt',
    mimeType: 'text/plain',
    data: 'Keep attachments with the message.\nSupport keyboard navigation.\nRésumé: café, 日本語, 👋',
  },
  {
    type: 'file',
    filename: 'composer-layout.svg',
    mimeType: 'image/svg+xml',
    data: `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="480" height="240" viewBox="0 0 480 240"><rect width="480" height="240" rx="20" fill="#18181b"/><rect x="24" y="24" width="280" height="16" rx="8" fill="#a1a1aa"/><rect x="24" y="56" width="210" height="16" rx="8" fill="#71717a"/><rect x="24" y="112" width="432" height="104" rx="16" fill="#27272a"/><rect x="40" y="128" width="112" height="24" rx="8" fill="#52525b"/><rect x="40" y="176" width="200" height="12" rx="6" fill="#71717a"/><circle cx="424" cy="184" r="16" fill="#a3e8c0"/></svg>')}`,
  },
];

export const reviewTools = [
  {
    toolName: 'read_file',
    args: { path: 'src/chat/composer.tsx' },
    status: 'idle',
    output: 'Enter currently adds a newline.',
  },
  {
    toolName: 'grep',
    args: { pattern: 'onKeyDown', path: 'src/chat' },
    status: 'idle',
    output: 'composer.tsx:42: onKeyDown',
  },
  { toolName: 'execute_command', args: { command: 'pnpm test composer' }, status: 'idle', output: '6 tests passed.' },
] satisfies (ToolCallGroupStep & { output: string })[];

export const editArgs = {
  path: 'src/chat/composer.tsx',
  old_string: 'if (event.key === "Enter") return;',
  new_string: 'if (event.key === "Enter" && !event.shiftKey) submit();',
};

export const plan = `1. Keep file previews next to the draft.
2. Send text and attachments together.
3. Verify keyboard, streaming, and narrow layouts.`;

export function createInitialTurns(scenario: Scenario): Turn[] {
  if (scenario === 'empty') return [];
  const phase = scenario === 'long' ? 'complete' : scenario;
  let initialText = '';
  if (phase === 'complete') initialText = reply;
  if (phase === 'stopped') initialText = reply.slice(0, 100);
  const review: Turn = {
    id: 'review',
    prompt: 'Review the chat composer using these notes and the attached layout. Show your plan before making changes.',
    files: reviewFiles,
    phase,
    text: initialText,
    answer: phase === 'question' ? undefined : 'Keyboard access',
    review: true,
  };
  if (scenario !== 'long') return [review];
  return [
    ...Array.from(
      { length: 12 },
      (_, index): Turn => ({
        id: `earlier-${index}`,
        prompt: `Review ${index + 1}: how should the conversation handle a longer history?`,
        files: [],
        phase: 'complete',
        text: 'Keep earlier messages readable while a reply arrives. The timeline can return to this turn, and the jump-to-latest button returns to the composer.',
      }),
    ),
    review,
  ];
}

// @vitest-environment node
import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { TimelineEntry } from '../../services/transcript';
import { TranscriptEntries } from '../transcript-entries';

const noop = () => {};

const reply: TimelineEntry = {
  kind: 'message',
  id: 'assistant-1',
  message: {
    id: 'assistant-1',
    role: 'assistant',
    createdAt: new Date('2026-07-15T10:00:00.000Z'),
    content: { format: 2, parts: [{ type: 'text', text: 'The queue is migrated.' }] },
  },
};

const replyAfterReading: TimelineEntry = {
  kind: 'message',
  id: 'assistant-2',
  message: {
    id: 'assistant-2',
    role: 'assistant',
    createdAt: new Date('2026-07-15T10:00:00.000Z'),
    content: {
      format: 2,
      parts: [
        {
          type: 'tool-invocation',
          toolInvocation: {
            state: 'result',
            toolCallId: 'call-read',
            toolName: 'read_file',
            args: { path: 'src/queue.ts' },
            result: 'export const queue = [];',
          },
        },
        { type: 'text', text: 'The queue is an empty array.' },
      ],
    },
  },
};

describe('a transcript rendered on the server', () => {
  it('renders a finished reply into the first HTML a reader gets', () => {
    const html = renderToString(<TranscriptEntries entries={[reply]} onApprove={noop} onRespond={noop} />);

    expect(html).toContain('The queue is migrated.');
  });

  it('renders a reply that read files first into the first HTML a reader gets', () => {
    const html = renderToString(<TranscriptEntries entries={[replyAfterReading]} onApprove={noop} onRespond={noop} />);

    expect(html).toContain('The queue is an empty array.');
  });
});

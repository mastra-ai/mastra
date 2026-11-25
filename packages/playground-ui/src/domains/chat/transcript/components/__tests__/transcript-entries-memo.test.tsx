// @vitest-environment jsdom
import type { MastraDBMessage } from '@mastra/core/agent-controller';
import { render } from '@testing-library/react';
import type { ReactNode } from 'react';

import { describe, expect, it, vi } from 'vitest';
import type { TimelineEntry } from '../../services/transcript';
import { TranscriptEntries } from '../transcript-entries';

const drawn: string[] = [];

vi.mock('@/ds/components/MarkdownRenderer', async importOriginal => ({
  ...(await importOriginal<typeof import('@/ds/components/MarkdownRenderer')>()),
  MarkdownRenderer: ({ children }: { children: ReactNode }) => {
    drawn.push(String(children));
    return <div>{children}</div>;
  },
}));

const noop = () => {};

function assistant(
  id: string,
  text: string,
  streaming?: boolean,
  tools: MastraDBMessage['content']['parts'] = [],
): TimelineEntry {
  const parts: MastraDBMessage['content']['parts'] = [{ type: 'text', text }, ...tools];
  return {
    kind: 'message',
    id,
    streaming,
    message: { id, role: 'assistant', createdAt: new Date('2026-07-15T10:00:00.000Z'), content: { format: 2, parts } },
  };
}

describe('transcript entry rendering', () => {
  it('redraws only the reply a delta touched, not the settled ones above it', () => {
    const settled = assistant('assistant-1', 'the first answer');
    const { rerender } = render(
      <TranscriptEntries entries={[settled, assistant('assistant-2', 'writ')]} onApprove={noop} onRespond={noop} />,
    );

    drawn.length = 0;

    rerender(
      <TranscriptEntries entries={[settled, assistant('assistant-2', 'writing')]} onApprove={noop} onRespond={noop} />,
    );

    expect(drawn).toEqual(['writing']);
  });

  it('leaves a settled step that hosts a line of tool work alone while the next reply streams', () => {
    const settled = assistant('assistant-1', 'the first answer', false, [
      {
        type: 'tool-invocation',
        toolInvocation: { state: 'result', toolCallId: 'call-1', toolName: 'view', args: {}, result: 'ok' },
      },
    ]);
    const { rerender } = render(
      <TranscriptEntries
        entries={[settled, assistant('assistant-2', 'writ')]}
        running
        onApprove={noop}
        onRespond={noop}
      />,
    );

    drawn.length = 0;

    rerender(
      <TranscriptEntries
        entries={[settled, assistant('assistant-2', 'writing')]}
        running
        onApprove={noop}
        onRespond={noop}
      />,
    );

    expect(drawn).toEqual(['writing']);
  });
});

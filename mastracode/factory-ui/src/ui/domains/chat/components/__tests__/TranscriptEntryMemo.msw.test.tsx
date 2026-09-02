import type { MastraDBMessage } from '@mastra/core/agent-controller';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { renderWithProviders } from '../../../../../../e2e/ui/render';
import type { TimelineEntry } from '../../services/transcript';
import { TranscriptEntries } from '../Transcript';

const drawn: string[] = [];

vi.mock('@mastra/playground-ui/components/MarkdownRenderer', async importOriginal => ({
  ...(await importOriginal<typeof import('@mastra/playground-ui/components/MarkdownRenderer')>()),
  MarkdownRenderer: ({ children }: { children: ReactNode }) => {
    drawn.push(String(children));
    return <div>{children}</div>;
  },
}));

const noop = () => {};

function assistant(id: string, text: string, streaming?: boolean): TimelineEntry {
  const parts: MastraDBMessage['content']['parts'] = [{ type: 'text', text }];
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
    const { rerender } = renderWithProviders(
      <TranscriptEntries entries={[settled, assistant('assistant-2', 'writ')]} onApprove={noop} onRespond={noop} />,
    );

    drawn.length = 0;

    rerender(
      <TranscriptEntries entries={[settled, assistant('assistant-2', 'writing')]} onApprove={noop} onRespond={noop} />,
    );

    expect(drawn).toEqual(['writing']);
  });
});

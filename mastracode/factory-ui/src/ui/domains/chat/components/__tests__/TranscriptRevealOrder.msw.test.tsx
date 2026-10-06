import type { MastraDBMessage } from '@mastra/core/agent-controller';
import { act, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { renderWithProviders } from '../../../../../../e2e/ui/render';
import type { TimelineEntry } from '../../services/transcript';
import { TranscriptEntries } from '../Transcript';

const PROSE = Array.from({ length: 80 }, (_, index) => `word${index}`).join(' ');

const reply: TimelineEntry = {
  kind: 'message',
  id: 'assistant-1',
  streaming: true,
  message: {
    id: 'assistant-1',
    role: 'assistant',
    createdAt: new Date('2026-07-15T10:00:00.000Z'),
    content: {
      format: 2,
      parts: [
        { type: 'text', text: PROSE },
        {
          type: 'tool-invocation',
          toolInvocation: {
            state: 'call',
            toolCallId: 'call-1',
            toolName: 'execute_command',
            args: { command: 'pnpm build' },
          },
        },
      ] satisfies MastraDBMessage['content']['parts'],
    },
  },
};

afterEach(() => {
  vi.useRealTimers();
});

describe('a reply that calls a tool mid-sentence', () => {
  it('lays the row down after the words it was written after, not on top of them', () => {
    vi.useFakeTimers();
    renderWithProviders(
      <MemoryRouter>
        <TranscriptEntries entries={[reply]} onApprove={() => {}} onRespond={() => {}} />
      </MemoryRouter>,
    );

    expect(screen.queryByText('pnpm build')).toBeNull();

    act(() => void vi.advanceTimersByTime(8000));

    expect(screen.getByText('pnpm build')).toBeInTheDocument();
  });
});

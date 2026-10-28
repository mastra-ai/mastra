import type { MastraDBMessage } from '@mastra/core/agent-controller';
import { act, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { renderWithProviders } from '../../../../../../e2e/ui/render';
import type { TimelineEntry } from '../../services/transcript';
import { TranscriptEntries } from '../Transcript';

function runningTool(toolCallId: string): MastraDBMessage['content']['parts'][number] {
  return {
    type: 'tool-invocation',
    toolInvocation: { state: 'call', toolCallId, toolName: 'view', args: { path: `src/${toolCallId}.ts` } },
  };
}

const burst: TimelineEntry = {
  kind: 'message',
  id: 'assistant-1',
  streaming: true,
  message: {
    id: 'assistant-1',
    role: 'assistant',
    createdAt: new Date('2026-07-15T10:00:00.000Z'),
    content: { format: 2, parts: [runningTool('call-1'), runningTool('call-2'), runningTool('call-3')] },
  },
};

afterEach(() => {
  vi.useRealTimers();
});

describe('parallel tool calls landing at once', () => {
  it('opens one busy line on the first call and keeps it as the rest land', () => {
    vi.useFakeTimers();
    renderWithProviders(
      <MemoryRouter>
        <TranscriptEntries entries={[burst]} running onApprove={() => {}} onRespond={() => {}} />
      </MemoryRouter>,
    );

    expect(document.querySelector('[data-slot="activity-stretch"]')).toBeNull();

    act(() => void vi.advanceTimersByTime(600));

    const line = screen.getByRole('group', { name: 'Reading src/call-1.ts' });
    expect(line).toHaveAttribute('aria-busy', 'true');
    expect(screen.queryAllByRole('group', { name: 'Tool: view' })).toHaveLength(0);

    act(() => void vi.advanceTimersByTime(4000));

    expect(screen.getByRole('group', { name: 'Reading src/call-3.ts' })).toBe(line);
    expect(line).toHaveAttribute('aria-busy', 'true');
    expect(screen.queryAllByRole('group', { name: 'Tool: view' })).toHaveLength(0);
  });
});

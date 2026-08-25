import type { MastraDBMessage } from '@mastra/core/agent-controller';
import { act, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { renderWithProviders } from '../../../../../../e2e/ui/render';
import type { TimelineEntry } from '../../services/transcript';
import { TranscriptEntries } from '../Transcript';

function assistant(parts: MastraDBMessage['content']['parts'], streaming?: boolean): TimelineEntry {
  return {
    kind: 'message',
    id: 'assistant-1',
    streaming,
    message: {
      id: 'assistant-1',
      role: 'assistant',
      createdAt: new Date('2026-07-15T10:00:00.000Z'),
      content: { format: 2, parts },
    },
  };
}

function renderEntries(entries: TimelineEntry[]) {
  return renderWithProviders(<TranscriptEntries entries={entries} onApprove={() => {}} onRespond={() => {}} />);
}

afterEach(() => {
  vi.useRealTimers();
});

describe('assistant prose', () => {
  it('reads a reply cut into parts as one markdown document', () => {
    const { container } = renderEntries([
      assistant([
        { type: 'text', text: '- **Human-in-the' },
        { type: 'text', text: '-loop**: suspend a run\n' },
      ]),
    ]);

    expect(container.querySelectorAll('.mastra-markdown')).toHaveLength(1);
    expect(screen.getByRole('listitem').textContent).toBe('Human-in-the-loop: suspend a run');
    expect(screen.getByText('Human-in-the-loop').tagName).toBe('STRONG');
  });

  it('keeps words on screen still when the reasoning before them fills its slot', () => {
    vi.useFakeTimers();
    const parts = (reasoning: string): MastraDBMessage['content']['parts'] => [
      { type: 'reasoning', reasoning, details: [] },
      { type: 'text', text: 'Let me look at the core package now.' },
    ];
    const { container, rerender } = renderEntries([assistant(parts(''), true)]);

    act(() => void vi.advanceTimersByTime(4000));
    const prose = () =>
      [...container.querySelectorAll('.mastra-markdown')].find(node => node.textContent?.includes('core package'));
    const settled = prose();
    expect(container.textContent).toContain('Let me look at the core package now.');

    rerender(
      <TranscriptEntries
        entries={[assistant(parts('Need the core first.'), true)]}
        onApprove={() => {}}
        onRespond={() => {}}
      />,
    );

    expect(container.textContent).toContain('Let me look at the core package now.');
    expect(prose()).toBe(settled);
    expect(container.textContent).toContain('Need the core first.');
  });

  it('paces a streaming reply from one place, not one per part', () => {
    vi.useFakeTimers();
    const { container } = renderEntries([
      assistant(
        [
          { type: 'text', text: 'first half ' },
          { type: 'text', text: 'second half' },
        ],
        true,
      ),
    ]);

    act(() => void vi.advanceTimersByTime(500));

    expect(container.querySelectorAll('.mastra-markdown')).toHaveLength(1);
    expect(container.textContent).toContain('first half second half');
  });
});

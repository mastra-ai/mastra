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

  it('paces a thinking passage word by word instead of landing it whole', () => {
    vi.useFakeTimers();
    const thought = Array.from({ length: 30 }, (_, index) => `thought${index + 1}`).join(' ');
    const { container } = renderEntries([assistant([{ type: 'reasoning', reasoning: thought, details: [] }], true)]);

    expect(container.textContent).not.toContain('thought5');

    act(() => void vi.advanceTimersByTime(700));

    expect(container.textContent).toContain('thought5');
    expect(container.textContent).not.toContain('thought30');

    act(() => void vi.advanceTimersByTime(4000));

    expect(container.textContent).toContain('thought30');
  });

  it('keeps the thinking on screen still while the prose after it streams', () => {
    vi.useFakeTimers();
    const parts = (text: string): MastraDBMessage['content']['parts'] => [
      { type: 'reasoning', reasoning: 'Need the core first.', details: [] },
      { type: 'text', text },
    ];
    const { container, rerender } = renderEntries([assistant(parts('Let me look at'), true)]);

    act(() => void vi.advanceTimersByTime(4000));
    const thinking = () =>
      [...container.querySelectorAll('.mastra-markdown')].find(node => node.textContent?.includes('Need the core'));
    const settled = thinking();
    expect(container.textContent).toContain('Need the core first.');

    rerender(
      <TranscriptEntries
        entries={[assistant(parts('Let me look at the core package now.'), true)]}
        onApprove={() => {}}
        onRespond={() => {}}
      />,
    );
    act(() => void vi.advanceTimersByTime(4000));

    expect(thinking()).toBe(settled);
    expect(container.textContent).toContain('Let me look at the core package now.');
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

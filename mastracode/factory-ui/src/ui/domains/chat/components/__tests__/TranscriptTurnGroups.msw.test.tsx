import type { MastraDBMessage } from '@mastra/core/agent-controller';
import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { renderWithProviders } from '../../../../../../e2e/ui/render';
import type { TimelineEntry } from '../../services/transcript';
import { TranscriptEntries } from '../Transcript';

const CREATED_AT = new Date('2026-07-15T10:00:00.000Z');

function textEntry(id: string, role: 'user' | 'assistant', text: string): TimelineEntry {
  const message: MastraDBMessage = {
    id,
    role,
    createdAt: CREATED_AT,
    content: { format: 2, parts: [{ type: 'text', text }] },
  };
  return { kind: 'message', id, message };
}

const entries = [
  textEntry('user-1', 'user', 'first question'),
  textEntry('assistant-1', 'assistant', 'first answer'),
  textEntry('user-2', 'user', 'second question'),
];

describe('TranscriptEntries turn groups', () => {
  it('reserves room under the live turn only while a reply is coming', () => {
    const { rerender } = renderWithProviders(
      <TranscriptEntries
        entries={entries}
        awaitingReply
        onApprove={() => {}}
        onRespond={() => {}}
        tail={<div data-testid="tail" />}
      />,
    );

    const liveGroup = screen.getByTestId('tail').parentElement;
    expect(liveGroup).toHaveClass('min-h-[50cqh]');
    expect(liveGroup).toBeInstanceOf(HTMLElement);
    if (liveGroup) expect(within(liveGroup).getByText('second question')).toBeInTheDocument();
    expect(screen.getByText('first question').closest('.min-h-\\[50cqh\\]')).toBeNull();

    rerender(
      <TranscriptEntries
        entries={entries}
        onApprove={() => {}}
        onRespond={() => {}}
        tail={<div data-testid="tail" />}
      />,
    );
    expect(screen.getByTestId('tail').parentElement).not.toHaveClass('min-h-[50cqh]');
  });

  it('still shows the tail while the transcript is empty', () => {
    renderWithProviders(
      <TranscriptEntries
        entries={[]}
        awaitingReply
        onApprove={() => {}}
        onRespond={() => {}}
        tail={<div data-testid="tail" />}
      />,
    );

    expect(screen.getByTestId('tail')).toBeInTheDocument();
  });
});

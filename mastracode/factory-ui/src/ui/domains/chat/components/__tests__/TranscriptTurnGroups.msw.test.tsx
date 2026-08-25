import type { MastraDBMessage } from '@mastra/core/agent-controller';
import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { renderWithProviders } from '../../../../../../e2e/ui/render';
import { createInitialTranscript, transcriptReducer } from '../../services/transcript';
import type { TimelineEntry } from '../../services/transcript';
import { TranscriptEntries } from '../Transcript';

const CREATED_AT = new Date('2026-07-15T10:00:00.000Z');
const ROOM_CLASS = 'turn-room-open';
const ROOM_SELECTOR = `.${ROOM_CLASS}`;

function textEntry(id: string, role: 'user' | 'assistant', text: string): TimelineEntry {
  const message: MastraDBMessage = {
    id,
    role,
    createdAt: CREATED_AT,
    content: { format: 2, parts: [{ type: 'text', text }] },
  };
  return { kind: 'message', id, message };
}

function gapEntry(id: string): TimelineEntry {
  const message: MastraDBMessage = {
    id,
    role: 'signal',
    createdAt: CREATED_AT,
    content: {
      format: 2,
      parts: [{ type: 'text', text: '24 minutes later — 07/15/2026, 10:00 AM GMT+2' }],
      metadata: {
        signal: {
          id,
          type: 'reactive',
          tagName: 'system-reminder',
          createdAt: CREATED_AT.toISOString(),
          attributes: { type: 'temporal-gap' },
        },
      },
    },
  };
  return { kind: 'message', id, message };
}

/** The run's own copy of what you typed: a user row carrying a data part, which draws nothing. */
function echoEntry(id: string, text: string): TimelineEntry {
  const message: MastraDBMessage = {
    id,
    role: 'user',
    createdAt: CREATED_AT,
    content: { format: 2, parts: [{ type: 'data-user-message', data: { contents: text } }] },
  };
  return { kind: 'message', id, message };
}

function steerSignal(id: string, text: string): MastraDBMessage {
  return {
    id,
    role: 'signal',
    createdAt: CREATED_AT,
    content: {
      format: 2,
      parts: [{ type: 'text', text }],
      metadata: {
        signal: {
          id,
          type: 'user',
          tagName: 'user',
          contents: text,
          createdAt: CREATED_AT.toISOString(),
          attributes: { delivery: 'while-active' },
        },
      },
    },
  };
}

const entries = [
  textEntry('user-1', 'user', 'first question'),
  textEntry('assistant-1', 'assistant', 'first answer'),
  textEntry('user-2', 'user', 'second question'),
];

describe('TranscriptEntries turn groups', () => {
  it('keeps the reserved room on the live turn and hands it to the next turn', () => {
    const { rerender } = renderWithProviders(
      <TranscriptEntries
        entries={entries}
        onApprove={() => {}}
        onRespond={() => {}}
        running
        tail={<div data-testid="tail" />}
      />,
    );

    const liveGroup = screen.getByTestId('tail').parentElement;
    expect(liveGroup).toHaveClass(ROOM_CLASS);
    expect(liveGroup).toBeInstanceOf(HTMLElement);
    if (liveGroup) expect(within(liveGroup).getByText('second question')).toBeInTheDocument();
    expect(screen.getByText('first question').closest(ROOM_SELECTOR)).toBeNull();

    rerender(
      <TranscriptEntries
        entries={[
          ...entries,
          textEntry('assistant-2', 'assistant', 'second answer'),
          textEntry('user-3', 'user', 'third question'),
        ]}
        onApprove={() => {}}
        onRespond={() => {}}
        running
        tail={<div data-testid="tail" />}
      />,
    );
    expect(screen.getByTestId('tail').parentElement).toHaveClass(ROOM_CLASS);
    // Closes as the new turn opens instead of vanishing under the reader.
    const handedOver = screen.getByText('second question').closest('.turn-room');
    expect(handedOver).not.toBeNull();
    expect(handedOver).not.toHaveClass(ROOM_CLASS);
    // One room, whatever the turn count: two would stack into a double gap.
    expect(document.querySelectorAll(ROOM_SELECTOR)).toHaveLength(1);
  });

  it('releases the room through a transition once the agent stops', () => {
    const { rerender } = renderWithProviders(
      <TranscriptEntries
        entries={entries}
        onApprove={() => {}}
        onRespond={() => {}}
        running
        tail={<div data-testid="tail" />}
      />,
    );

    rerender(
      <TranscriptEntries
        entries={entries}
        onApprove={() => {}}
        onRespond={() => {}}
        tail={<div data-testid="tail" />}
      />,
    );

    const liveGroup = screen.getByTestId('tail').parentElement;
    expect(liveGroup).not.toHaveClass(ROOM_CLASS);
    // Kept: it carries the transition the room closes on.
    expect(liveGroup).toHaveClass('turn-room');
  });

  it('keeps the room on the message you sent when the run echoes it back undrawn', () => {
    const settledTurn = [
      textEntry('user-0', 'user', 'earlier question'),
      textEntry('assistant-0', 'assistant', 'earlier answer'),
    ];
    const { rerender } = renderWithProviders(
      <TranscriptEntries entries={[...settledTurn, entries[0]]} onApprove={() => {}} onRespond={() => {}} running />,
    );
    const room = screen.getByText('first question').closest(ROOM_SELECTOR);
    expect(room).toBeInstanceOf(HTMLElement);

    rerender(
      <TranscriptEntries
        entries={[...settledTurn, entries[0], echoEntry('echo-1', 'first question'), entries[1]]}
        onApprove={() => {}}
        onRespond={() => {}}
        running
      />,
    );

    // The same node, so the room does not close and reopen under the reply.
    expect(screen.getByText('first question').closest(ROOM_SELECTOR)).toBe(room);
    expect(screen.getByText('first answer').closest(ROOM_SELECTOR)).toBe(room);
    expect(document.querySelectorAll(ROOM_SELECTOR)).toHaveLength(1);
  });

  it('gives the first turn of a fresh thread no room to scroll into', () => {
    renderWithProviders(<TranscriptEntries entries={[entries[0]]} onApprove={() => {}} onRespond={() => {}} running />);

    // It opens at the top already: room under it would only put empty scroll below.
    expect(screen.getByText('first question').closest(ROOM_SELECTOR)).toBeNull();
    expect(screen.getByText('first question').closest('.turn-room')).not.toBeNull();
  });

  it('keeps the same room node when a pending steer is confirmed', () => {
    let state = createInitialTranscript({ messages: [], threadId: 'thread-1' });
    state = transcriptReducer(state, {
      type: 'localUser',
      text: 'change direction',
      steer: true,
    });
    const { rerender } = renderWithProviders(
      <TranscriptEntries
        entries={state.entries}
        onApprove={() => {}}
        onRespond={() => {}}
        running
        tail={<div data-testid="steering-tail" />}
      />,
    );
    const room = screen.getByTestId('steering-tail').parentElement;
    expect(room).toBeInstanceOf(HTMLElement);

    state = transcriptReducer(state, {
      type: 'event',
      event: { type: 'message_start', message: steerSignal('signal-steer', 'change direction') },
    });
    rerender(
      <TranscriptEntries
        entries={state.entries}
        onApprove={() => {}}
        onRespond={() => {}}
        running
        tail={<div data-testid="steering-tail" />}
      />,
    );

    expect(screen.getByTestId('steering-tail').parentElement).toBe(room);
    expect(state.entries[0]).toMatchObject({ message: { id: 'signal-steer' } });
  });

  it('lets a steer slide in under the stream without opening room', () => {
    let state = createInitialTranscript({ messages: [], threadId: 'thread-1' });
    state = transcriptReducer(state, { type: 'localUser', text: 'first question' });
    state = transcriptReducer(state, { type: 'localUser', text: 'change direction', steer: true });

    renderWithProviders(
      <TranscriptEntries
        entries={state.entries}
        onApprove={() => {}}
        onRespond={() => {}}
        running
        tail={<div data-testid="tail" />}
      />,
    );

    expect(screen.getByText('change direction')).toBeInTheDocument();
    expect(screen.getByTestId('tail').parentElement).not.toHaveClass(ROOM_CLASS);
  });

  it('takes the gap that introduces a turn into that turn, where the room absorbs it', () => {
    renderWithProviders(
      <TranscriptEntries
        entries={[entries[0], entries[1], gapEntry('gap-1'), entries[2]]}
        onApprove={() => {}}
        onRespond={() => {}}
        running
      />,
    );

    const room = screen.getByText('second question').closest<HTMLElement>(ROOM_SELECTOR);
    expect(room).toBeInstanceOf(HTMLElement);
    if (room) expect(within(room).getByRole('separator')).toBeInTheDocument();
  });

  it('gives no room to a group no user turn opens', () => {
    renderWithProviders(
      <TranscriptEntries
        entries={[textEntry('assistant-only', 'assistant', 'orphan answer')]}
        onApprove={() => {}}
        onRespond={() => {}}
        running
      />,
    );

    expect(screen.getByText('orphan answer').closest(ROOM_SELECTOR)).toBeNull();
  });

  it('still shows the tail while the transcript is empty', () => {
    renderWithProviders(
      <TranscriptEntries entries={[]} onApprove={() => {}} onRespond={() => {}} tail={<div data-testid="tail" />} />,
    );

    expect(screen.getByTestId('tail')).toBeInTheDocument();
  });
});

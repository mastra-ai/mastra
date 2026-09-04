import type { MastraDBMessage } from '@mastra/core/agent-controller';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { renderWithProviders } from '../../../../../../e2e/ui/render';
import type { TimelineEntry } from '../../services/transcript';
import { TranscriptEntries } from '../Transcript';

const CREATED_AT = new Date('2026-07-15T10:00:00.000Z');

function messageEntry(
  id: string,
  role: 'user' | 'assistant',
  parts: MastraDBMessage['content']['parts'],
  streaming?: boolean,
): TimelineEntry {
  return {
    kind: 'message',
    id,
    streaming,
    message: { id, role, createdAt: CREATED_AT, content: { format: 2, parts } },
  };
}

function renderEntries(entries: TimelineEntry[]) {
  return renderWithProviders(<TranscriptEntries entries={entries} onApprove={() => {}} onRespond={() => {}} />);
}

describe('message meta', () => {
  it('stamps every message that carries prose with its time', () => {
    const { container } = renderEntries([
      messageEntry('user-1', 'user', [{ type: 'text', text: 'ship it' }]),
      messageEntry('assistant-1', 'assistant', [{ type: 'text', text: 'shipped' }]),
    ]);

    const stamps = [...container.querySelectorAll('time')];
    expect(stamps.map(stamp => stamp.getAttribute('datetime'))).toEqual([
      CREATED_AT.toISOString(),
      CREATED_AT.toISOString(),
    ]);
    expect(screen.getAllByRole('button', { name: 'Copy message' })).toHaveLength(2);
  });

  it('copies the message text, not the tool traffic around it', async () => {
    const user = userEvent.setup();
    renderEntries([
      messageEntry('assistant-1', 'assistant', [
        { type: 'text', text: 'reading the file' },
        {
          type: 'tool-invocation',
          toolInvocation: { state: 'result', toolCallId: 'call-1', toolName: 'read', args: {}, result: 'contents' },
        },
        { type: 'text', text: 'done' },
      ]),
    ]);

    await user.click(screen.getByRole('button', { name: 'Copy message' }));

    expect(await navigator.clipboard.readText()).toBe('reading the file\n\ndone');
  });

  it('stamps a reply once however many messages the server cut it into', () => {
    const { container } = renderEntries([
      messageEntry('user-1', 'user', [{ type: 'text', text: 'ship it' }]),
      messageEntry('assistant-1', 'assistant', [{ type: 'text', text: 'reading the file' }]),
      messageEntry('assistant-2', 'assistant', [{ type: 'text', text: 'shipped' }]),
    ]);

    expect(container.querySelectorAll('time')).toHaveLength(2);
    expect(screen.getAllByRole('button', { name: 'Copy message' })).toHaveLength(2);
  });

  it('copies the whole reply from the message that closes it', async () => {
    const user = userEvent.setup();
    renderEntries([
      messageEntry('assistant-1', 'assistant', [{ type: 'text', text: 'reading the file' }]),
      messageEntry('assistant-2', 'assistant', [{ type: 'text', text: 'shipped' }]),
    ]);

    await user.click(screen.getByRole('button', { name: 'Copy message' }));

    expect(await navigator.clipboard.readText()).toBe('reading the file\n\nshipped');
  });

  it('waits for the reply to finish before offering to copy it', () => {
    const { container } = renderEntries([
      messageEntry('assistant-1', 'assistant', [{ type: 'text', text: 'still writ' }], true),
    ]);

    expect(container.querySelector('time')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Copy message' })).toBeNull();
  });

  it('stamps the reply only when the run stops answering', () => {
    const entries = [
      messageEntry('user-1', 'user', [{ type: 'text', text: 'ship it' }]),
      messageEntry('assistant-1', 'assistant', [{ type: 'text', text: 'reading the file' }]),
    ];
    const { container, rerender } = renderWithProviders(
      <TranscriptEntries entries={entries} onApprove={() => {}} onRespond={() => {}} running />,
    );

    // The user's own message is finished; the reply between steps is not.
    expect(container.querySelectorAll('time')).toHaveLength(1);

    rerender(<TranscriptEntries entries={entries} onApprove={() => {}} onRespond={() => {}} />);

    expect(container.querySelectorAll('time')).toHaveLength(2);
  });

  it('leaves a message with nothing to copy unstamped', () => {
    const { container } = renderEntries([
      messageEntry('assistant-1', 'assistant', [
        {
          type: 'tool-invocation',
          toolInvocation: { state: 'result', toolCallId: 'call-1', toolName: 'read', args: {}, result: 'contents' },
        },
      ]),
    ]);

    expect(container.querySelector('time')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Copy message' })).toBeNull();
  });
});

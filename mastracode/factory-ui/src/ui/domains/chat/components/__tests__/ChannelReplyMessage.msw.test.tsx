import type { MastraDBMessage } from '@mastra/core/agent-controller';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { renderWithProviders } from '../../../../../../e2e/ui/render';
import type { TimelineEntry } from '../../services/transcript';
import { TranscriptEntries } from '../Transcript';
import { replyText } from '../ChannelReplyMessage';

const CREATED_AT = new Date('2026-10-21T10:00:00.000Z');

function replyEntry(toolInvocation: Record<string, unknown>, after: unknown[] = []): TimelineEntry {
  const message = {
    id: 'msg-reply',
    role: 'assistant',
    createdAt: CREATED_AT,
    content: {
      format: 2,
      parts: [
        {
          type: 'tool-invocation',
          toolInvocation: { toolCallId: 'call-1', toolName: 'reply_in_thread', ...toolInvocation },
        },
        ...after,
      ],
      metadata: { modelId: 'claude-opus-4-6', provider: 'anthropic.messages' },
    },
  } as unknown as MastraDBMessage;
  return { kind: 'message', id: message.id, message };
}

function renderEntries(entries: TimelineEntry[]) {
  return renderWithProviders(<TranscriptEntries entries={entries} onApprove={() => {}} onRespond={() => {}} />);
}

describe('reply_in_thread in the transcript', () => {
  it('shows the posted reply as rendered markdown, not a JSON tool card', () => {
    renderEntries([
      replyEntry({
        state: 'result',
        args: { text: '*Friday Deploy*\n\nThe canary sings, the metrics hold.' },
        result: { posted: true },
      }),
    ]);

    const reply = screen.getByRole('group', { name: 'Reply in Slack thread' });
    expect(within(reply).getByText('Friday Deploy').tagName).toBe('EM');
    expect(within(reply).getByText(/The canary sings/)).toBeInTheDocument();
    // No raw args or result JSON.
    expect(screen.queryByText(/"text"/)).not.toBeInTheDocument();
    expect(screen.queryByText(/"posted"/)).not.toBeInTheDocument();
  });

  it('ends the turn like any reply: model, Sent to Slack, copy and time, copying what was posted', async () => {
    const user = userEvent.setup();
    const { container } = renderEntries([
      replyEntry(
        { state: 'result', args: { text: 'Hello world' }, result: { posted: true } },
        // The model's own closing text never reached Slack and is not the reply.
        [{ type: 'text', text: 'I posted hello world in the thread.' }],
      ),
    ]);

    expect(screen.getByText(/^Claude Opus 4\.6/)).toBeInTheDocument();
    expect(screen.getByText('Sent to Slack')).toBeInTheDocument();
    expect(container.querySelector('time')?.getAttribute('datetime')).toBe(CREATED_AT.toISOString());

    await user.click(screen.getByRole('button', { name: 'Copy message' }));
    expect(await navigator.clipboard.readText()).toBe('Hello world');
  });

  it('marks a reply still being written, and one that failed, on the post itself', () => {
    renderEntries([replyEntry({ state: 'call', args: { text: 'Hello wor' } })]);
    expect(screen.getByText('Sending to Slack…')).toBeInTheDocument();
    expect(screen.queryByText('Sent to Slack')).not.toBeInTheDocument();
  });
});

describe('replyText', () => {
  it('reads the parsed args once the call is complete', () => {
    expect(replyText({ text: 'Done.' }, '{"text":"Do')).toBe('Done.');
  });

  it('decodes the reply from args JSON that is still streaming in', () => {
    expect(replyText(undefined, '{"text": "Line one\\nline \\"two')).toBe('Line one\nline "two');
    expect(replyText(undefined, '{"text": "cut \\')).toBe('cut ');
    expect(replyText(undefined, '{"te')).toBeUndefined();
  });
});

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
  it('draws nothing for a zero-width-space closing message after the reply', () => {
    const { container } = renderEntries([
      replyEntry({ state: 'result', args: { text: 'hello world' }, result: { posted: true } }, [
        { type: 'text', text: '\u200b' },
      ]),
    ]);

    expect(screen.getByText('hello world')).toBeTruthy();
    expect(container.textContent).not.toContain('\u200b');
  });

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

  it('keeps a Slack post apart from the text only the web UI sees', async () => {
    const user = userEvent.setup();
    const { container } = renderEntries([
      replyEntry({ state: 'result', args: { text: 'Hello world' }, result: { posted: true } }, [
        { type: 'text', text: 'I posted hello world in the thread.' },
      ]),
    ]);

    // The post says where it went; the agent's own text and the turn footer don't.
    const post = screen.getByRole('group', { name: 'Reply in Slack thread' });
    expect(within(post).getByText('Hello world')).toBeInTheDocument();
    expect(within(post).getByText('Sent to Slack')).toBeInTheDocument();
    expect(screen.getAllByText('Sent to Slack')).toHaveLength(1);
    expect(within(post).queryByText(/I posted hello world/)).not.toBeInTheDocument();

    expect(screen.getByText(/^Claude Opus 4\.6/)).toBeInTheDocument();
    expect(container.querySelector('time')?.getAttribute('datetime')).toBe(CREATED_AT.toISOString());
    await user.click(screen.getByRole('button', { name: 'Copy message' }));
    expect(await navigator.clipboard.readText()).toBe('I posted hello world in the thread.');
  });

  it('copies what was posted when the turn only posted to Slack', async () => {
    const user = userEvent.setup();
    renderEntries([replyEntry({ state: 'result', args: { text: 'Hello world' }, result: { posted: true } })]);

    expect(screen.getByText(/^Claude Opus 4\.6/)).toBeInTheDocument();
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

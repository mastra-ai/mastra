import type { AgentControllerEvent, MastraDBMessage } from '@mastra/core/agent-controller';
import type { ReplyOwner } from '../../services/reply-owner';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { renderWithProviders } from '../../../../../../e2e/ui/render';
import { initialTranscript, transcriptReducer } from '../../services/transcript';
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

  it('leaves a message with nothing to copy unstamped, though its tool row still keeps its own clock', () => {
    const { container } = renderEntries([
      messageEntry('assistant-1', 'assistant', [
        {
          type: 'tool-invocation',
          toolInvocation: { state: 'result', toolCallId: 'call-1', toolName: 'read', args: {}, result: 'contents' },
        },
      ]),
    ]);

    expect(screen.queryByRole('button', { name: 'Copy message' })).toBeNull();
    const times = container.querySelectorAll('time');
    expect(times).toHaveLength(1);
    expect(screen.getByRole('group', { name: 'Tool: read' })).toContainElement(times[0]);
  });

  it('names the model that closed a live reply, not one an earlier step ran on', () => {
    const liveStep = (id: string, text: string, modelId: string): AgentControllerEvent[] => [
      {
        type: 'message_start',
        message: {
          id,
          role: 'assistant',
          createdAt: CREATED_AT,
          content: { format: 2, parts: [{ type: 'text', text }], metadata: { modelId } },
        },
      },
      { type: 'message_end', id },
    ];
    const { entries } = [
      ...liveStep('assistant-1', 'reading the file', 'gpt-5'),
      ...liveStep('assistant-2', 'shipped', 'claude-opus-4-6'),
    ].reduce((state, event) => transcriptReducer(state, { type: 'event', event }), initialTranscript);

    renderEntries(entries);

    expect(screen.getAllByText('Claude Opus 4.6')).toHaveLength(1);
    expect(screen.queryByText('GPT-5')).toBeNull();
  });

  const ward = { id: 'ward', name: 'Ward Peeters' };
  const claudeSubscription = { anthropic: { type: 'oauth', subscription: 'Claude Pro/Max' } } as const;
  const opus = { modelId: 'claude-opus-4-6', provider: 'anthropic.messages' };
  const gpt = { modelId: 'gpt-5', provider: 'openai.responses' };
  const grok = { modelId: 'grok-4', provider: 'xai.chat' };
  const kimi = { modelId: 'kimi-k2-thinking', provider: 'kimi-for-coding.messages' };
  const ownerCases: Array<{
    owner: ReplyOwner;
    viewerId: string;
    model: { modelId: string; provider: string };
    label: string;
  }> = [
    {
      owner: { ...ward, credentials: claudeSubscription },
      viewerId: 'damien',
      model: opus,
      label: 'Claude Opus 4.6 · Ward Peeters’s Claude Pro/Max',
    },
    {
      owner: { ...ward, credentials: claudeSubscription },
      viewerId: 'ward',
      model: opus,
      label: 'Claude Opus 4.6 · Your Claude Pro/Max',
    },
    {
      owner: { id: 'ward', credentials: { openai: { type: 'api_key' } } },
      viewerId: 'damien',
      model: gpt,
      label: 'GPT-5 · Personal OpenAI API key',
    },
    {
      owner: { credentials: { xai: { type: 'oauth', subscription: 'SuperGrok/X Premium+' } } },
      viewerId: 'damien',
      model: grok,
      label: 'Grok 4 · Organization SuperGrok/X Premium+',
    },
    {
      owner: { ...ward, credentials: { 'kimi-code-plan-cn': { type: 'api_key' } } },
      viewerId: 'ward',
      model: kimi,
      label: 'Kimi K2 Thinking · Your Kimi API key',
    },
    {
      owner: { ...ward, credentials: { openai: { type: 'api_key' } } },
      viewerId: 'damien',
      model: opus,
      label: 'Claude Opus 4.6',
    },
  ];
  it.each(ownerCases)(
    'labels a $model.provider reply for viewer $viewerId as “$label”',
    ({ owner, viewerId, model, label }) => {
      const reply: TimelineEntry = {
        kind: 'message',
        id: 'assistant-1',
        message: {
          id: 'assistant-1',
          role: 'assistant',
          createdAt: CREATED_AT,
          content: { format: 2, parts: [{ type: 'text', text: 'shipped' }], metadata: model },
        },
      };

      renderWithProviders(
        <TranscriptEntries
          entries={[reply]}
          viewerId={viewerId}
          owner={owner}
          onApprove={() => {}}
          onRespond={() => {}}
        />,
      );

      expect(screen.getByText(label, { exact: true })).toBeVisible();
    },
  );
});

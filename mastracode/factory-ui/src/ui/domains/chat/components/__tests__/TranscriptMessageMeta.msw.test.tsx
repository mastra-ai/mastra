import type { AgentControllerEvent, MastraDBMessage } from '@mastra/core/agent-controller';
import type { ThreadOwner } from '../../services/reply-credential';
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
  metadata?: MastraDBMessage['content']['metadata'],
): TimelineEntry {
  return {
    kind: 'message',
    id,
    streaming,
    message: { id, role, createdAt: CREATED_AT, content: { format: 2, parts, metadata } },
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

  it('names the thinking level a finished reply ran at', async () => {
    const user = userEvent.setup();
    renderEntries([
      messageEntry('assistant-1', 'assistant', [{ type: 'text', text: 'shipped' }], false, {
        modelId: 'gpt-5',
        thinkingLevel: 'xhigh',
      }),
    ]);

    const level = screen.getByRole('img', { name: 'Thinking: Extra high' });
    await user.hover(level);

    expect(await screen.findByRole('tooltip', { name: 'Thinking: Extra high' })).toBeInTheDocument();
  });

  it('names an off thinking level too', () => {
    renderEntries([
      messageEntry('assistant-1', 'assistant', [{ type: 'text', text: 'shipped' }], false, {
        modelId: 'gpt-5',
        thinkingLevel: 'off',
      }),
    ]);

    expect(screen.getByRole('img', { name: 'Thinking: Off' })).toBeInTheDocument();
  });

  it('shows only the model for a reply stamped before thinking levels were recorded', () => {
    renderEntries([
      messageEntry('assistant-1', 'assistant', [{ type: 'text', text: 'shipped' }], false, { modelId: 'gpt-5' }),
    ]);

    expect(screen.getByText('GPT-5')).toBeInTheDocument();
    expect(screen.queryByRole('img', { name: /^Thinking:/ })).toBeNull();
  });

  const ward = { id: 'ward', name: 'Ward Peeters' };
  const opus = { modelId: 'claude-opus-4-6', provider: 'anthropic.messages' };
  const ownerCases: Array<{
    case: string;
    owner?: ThreadOwner;
    viewerId: string;
    metadata: Record<string, unknown>;
    label: string;
  }> = [
    {
      case: 'the thread owner’s credential to a teammate',
      owner: ward,
      viewerId: 'damien',
      metadata: { ...opus, credentialLabel: 'Claude Pro/Max', credentialOwnerId: 'ward' },
      label: 'Claude Opus 4.6 · Ward Peeters’s Claude Pro/Max',
    },
    {
      case: 'the viewer’s own credential',
      owner: ward,
      viewerId: 'ward',
      metadata: { ...opus, credentialLabel: 'Claude Pro/Max', credentialOwnerId: 'ward' },
      label: 'Claude Opus 4.6 · Your Claude Pro/Max',
    },
    {
      case: 'a personal credential whose owner is not named',
      viewerId: 'damien',
      metadata: { modelId: 'gpt-5', credentialLabel: 'OpenAI API key', credentialOwnerId: 'ward' },
      label: 'GPT-5 · Personal OpenAI API key',
    },
    {
      case: 'the organization’s credential',
      owner: ward,
      viewerId: 'damien',
      metadata: { modelId: 'grok-4', credentialLabel: 'SuperGrok/X Premium+' },
      label: 'Grok 4 · Organization SuperGrok/X Premium+',
    },
    {
      case: 'a reply stamped before credentials were recorded',
      owner: ward,
      viewerId: 'damien',
      metadata: opus,
      label: 'Claude Opus 4.6',
    },
  ];
  it.each(ownerCases)('labels a reply answered by $case as “$label”', ({ owner, viewerId, metadata, label }) => {
    const reply: TimelineEntry = {
      kind: 'message',
      id: 'assistant-1',
      message: {
        id: 'assistant-1',
        role: 'assistant',
        createdAt: CREATED_AT,
        content: { format: 2, parts: [{ type: 'text', text: 'shipped' }], metadata },
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
  });
});

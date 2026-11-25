// @vitest-environment jsdom
import type { MastraDBMessage } from '@mastra/core/agent-controller';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { TimelineEntry } from '../../services/transcript';
import { TranscriptSlotsProvider } from '../slots';
import type { TranscriptSlots } from '../slots';
import { TranscriptEntries } from '../transcript-entries';

afterEach(cleanup);

const noop = () => {};

function drawWithoutSlots(entries: TimelineEntry[], onApprove = noop) {
  return render(<TranscriptEntries entries={entries} onApprove={onApprove} onRespond={noop} />);
}

function assistantCalling(
  id: string,
  toolCallId: string,
  toolName: string,
  args: Record<string, unknown>,
): TimelineEntry {
  const parts: MastraDBMessage['content']['parts'] = [
    { type: 'tool-invocation', toolInvocation: { state: 'call', toolCallId, toolName, args } },
  ];
  return {
    kind: 'message',
    id,
    message: { id, role: 'assistant', createdAt: new Date('2026-07-15T10:00:00.000Z'), content: { format: 2, parts } },
  };
}

describe('a transcript drawn by a host that plugs in no slots', () => {
  it('shows a failed run as an error notice carrying what the provider said', () => {
    drawWithoutSlots([
      {
        kind: 'notice',
        id: 'notice-1',
        level: 'error',
        text: 'The run failed.',
        error: { name: 'APICallError', message: 'Rate limit reached for this model' },
      },
    ]);

    expect(screen.getByText('Rate limit reached for this model')).toBeTruthy();
  });

  it('shows a notification and a notification summary as plain notices', () => {
    drawWithoutSlots([
      { kind: 'notification', id: 'notification-1', message: 'The deploy finished' },
      {
        kind: 'notification_summary',
        id: 'summary-1',
        message: '3 sessions need you',
        pending: 3,
        bySource: {},
        byPriority: {},
        notificationIds: [],
      },
    ]);

    expect(screen.getByText('The deploy finished')).toBeTruthy();
    expect(screen.getByText('3 sessions need you')).toBeTruthy();
    expect(screen.queryByRole('link')).toBeNull();
  });

  it('lets the reader approve or decline a tool call with the built-in card', () => {
    const onApprove = vi.fn();
    drawWithoutSlots(
      [
        {
          kind: 'approval',
          id: 'approval-1',
          toolCallId: 'call-write',
          toolName: 'write_file',
          args: { path: 'a.ts' },
        },
      ],
      onApprove,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Approve write_file' }));
    fireEvent.click(screen.getByRole('button', { name: 'Decline write_file' }));

    expect(onApprove.mock.calls).toEqual([
      ['call-write', true, 'approval-1'],
      ['call-write', false, 'approval-1'],
    ]);
  });

  it('marks a question the agent is waiting on, without offering a way to answer it', () => {
    drawWithoutSlots([
      {
        kind: 'suspension',
        id: 'suspension-1',
        toolCallId: 'call-ask',
        toolName: 'ask_user',
        args: {},
        suspendPayload: { question: 'Which branch should I deploy?', options: ['main', 'next'] },
      },
    ]);

    const row = screen.getByRole('group', { name: 'Waiting for input: Ask user' });
    expect(within(row).getByText('Which branch should I deploy?')).toBeTruthy();
    expect(within(row).getByText('Waiting for input')).toBeTruthy();
    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.queryByRole('textbox')).toBeNull();
    expect(screen.queryByRole('radio')).toBeNull();
  });

  it('marks a pending access request with the path it asks for, next to the call that made it', () => {
    drawWithoutSlots([
      assistantCalling('assistant-1', 'call-access', 'request_access', { path: '/srv/shared', reason: 'Read logs' }),
      {
        kind: 'suspension',
        id: 'suspension-2',
        toolCallId: 'call-access',
        toolName: 'request_access',
        args: { path: '/srv/shared', reason: 'Read logs' },
        suspendPayload: { kind: 'sandbox_access_request', path: '/srv/shared', reason: 'Read logs' },
      },
    ]);

    const row = screen.getByRole('group', { name: 'Waiting for input: Request access' });
    expect(within(row).getByText('/srv/shared')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /allow|deny/i })).toBeNull();
  });

  it('names a delegated subagent once, on the tool call that started it', () => {
    drawWithoutSlots([
      assistantCalling('assistant-1', 'call-delegate', 'subagent', { agentType: 'explore', task: 'Map the auth flow' }),
      {
        kind: 'subagent',
        id: 'subagent-call-delegate',
        toolCallId: 'call-delegate',
        agentType: 'explore',
        task: 'Map the auth flow',
        modelId: 'anthropic/claude-sonnet',
        done: false,
      },
    ]);

    expect(screen.getByRole('group', { name: 'Delegated explore' })).toBeTruthy();
    expect(screen.getAllByText('explore')).toHaveLength(1);
  });

  it('draws a plan handoff as a plain tool row, with no way to approve or revise the plan', () => {
    drawWithoutSlots([
      assistantCalling('assistant-1', 'call-plan', 'submit_plan', { path: '.plans/migrate-queue.md' }),
    ]);

    const row = screen.getByRole('group', { name: 'Tool: submit_plan' });
    expect(within(row).getByText('Submit plan')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /approve|reject|revise/i })).toBeNull();
  });

  it('marks a plan the agent is waiting on a review for', () => {
    drawWithoutSlots([
      assistantCalling('assistant-1', 'call-plan', 'submit_plan', { path: '.plans/migrate-queue.md' }),
      {
        kind: 'suspension',
        id: 'suspension-plan',
        toolCallId: 'call-plan',
        toolName: 'submit_plan',
        args: { path: '.plans/migrate-queue.md' },
        suspendPayload: { path: '.plans/migrate-queue.md' },
      },
    ]);

    expect(screen.getByRole('group', { name: 'Waiting for input: Submit plan' })).toBeTruthy();
  });

  it('lets the reader answer a question inside the message that asks it, without a second waiting row', () => {
    drawWithoutSlots([
      assistantCalling('assistant-1', 'call-ask', 'ask_user', { question: 'Which branch should I deploy?' }),
      {
        kind: 'suspension',
        id: 'suspension-ask',
        toolCallId: 'call-ask',
        toolName: 'ask_user',
        args: { question: 'Which branch should I deploy?' },
        suspendPayload: { question: 'Which branch should I deploy?' },
      },
    ]);

    expect(screen.getByRole('textbox', { name: 'Which branch should I deploy?' })).toBeTruthy();
    expect(screen.queryByRole('group', { name: /^Waiting for input/ })).toBeNull();
  });
});

describe('a transcript drawn by a host that draws its own data parts', () => {
  const slots: TranscriptSlots = {
    DataPart: {
      draws: part => part.type === 'data-model-switch',
      Component: ({ part }) => <p>{part.type}</p>,
    },
  };

  function drawReply(parts: MastraDBMessage['content']['parts']) {
    return render(
      <TranscriptSlotsProvider slots={slots}>
        <TranscriptEntries
          entries={[
            {
              kind: 'message',
              id: 'assistant-1',
              message: {
                id: 'assistant-1',
                role: 'assistant',
                createdAt: new Date('2026-07-15T10:00:00.000Z'),
                content: { format: 2, parts },
              },
            },
          ]}
          onApprove={noop}
          onRespond={noop}
        />
      </TranscriptSlotsProvider>,
    );
  }

  it('shows the parts the host claims, in place, and keeps every other data part hidden', () => {
    drawReply([
      { type: 'data-model-switch', data: {} },
      { type: 'data-usage', data: {} },
      { type: 'text', text: 'Reviewed on the fallback' },
    ]);

    expect(screen.getByText('data-model-switch')).toBeTruthy();
    expect(screen.queryByText('data-usage')).toBeNull();
    expect(screen.getByText('Reviewed on the fallback')).toBeTruthy();
  });

  it('copies the reply with a paragraph break where a part the host draws splits it', async () => {
    const user = userEvent.setup();
    drawReply([
      { type: 'text', text: 'First.' },
      { type: 'data-model-switch', data: {} },
      { type: 'text', text: 'Second.' },
    ]);

    await user.click(screen.getByRole('button', { name: 'Copy message' }));

    expect(await navigator.clipboard.readText()).toBe('First.\n\nSecond.');
  });
});

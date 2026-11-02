import type { MastraDBMessage } from '@mastra/core/agent-controller';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';

import { renderWithProviders } from '../../../../../../e2e/ui/render';
import { createInitialTranscript, initialTranscript, transcriptReducer } from '../../services/transcript';
import type { TimelineEntry } from '../../services/transcript';
import { TranscriptEntries } from '../Transcript';
import { runningTools, settledTools } from './fixtures/tool-outcomes';

const CREATED_AT = new Date('2026-09-16T10:00:00.000Z');

function assistant(id: string, parts: MastraDBMessage['content']['parts']): MastraDBMessage {
  return { id, role: 'assistant', createdAt: CREATED_AT, content: { format: 2, parts } };
}

type MessagePart = MastraDBMessage['content']['parts'][number];

function ran(toolCallId: string, toolName: string, args: unknown, result: string): MessagePart {
  return { type: 'tool-invocation', toolInvocation: { state: 'result', toolCallId, toolName, args, result } };
}

function exited(toolCallId: string, exit: { exitCode: number; success: boolean; killed?: boolean }): MessagePart {
  return { type: 'data-sandbox-exit', data: { ...exit, toolCallId } };
}

const gitStatus = ran(
  'git',
  'execute_command',
  { command: 'git status' },
  'fatal: not a git repository\n\nExit code: 128',
);
const gitStatusExit = exited('git', { exitCode: 128, success: false });

function renderEntries(entries: TimelineEntry[]) {
  renderWithProviders(
    <MemoryRouter>
      <TranscriptEntries entries={entries} onApprove={() => {}} onRespond={() => {}} />
    </MemoryRouter>,
  );
}

describe('Transcript tool outcomes', () => {
  describe('when persisted calls have settled', () => {
    it('counts empty and false results as successful and keeps denied calls failed', async () => {
      renderWithProviders(
        <MemoryRouter>
          <TranscriptEntries entries={[settledTools]} onApprove={() => {}} onRespond={() => {}} />
        </MemoryRouter>,
      );

      const line = screen.getByRole('group', { name: 'Read files, wrote a file' });
      expect(within(line).getByText('1 failed')).toBeVisible();
      await userEvent.click(within(line).getByRole('button'));
      const denied = screen.getByRole('group', { name: 'Tool: write_file' });
      await userEvent.click(within(denied).getByRole('button'));
      expect(within(denied).getByText('Permission denied')).toBeVisible();
    });
  });

  describe('when one call has only a partial result', () => {
    it('keeps the line busy, with no outcome, until the call settles', () => {
      renderWithProviders(
        <MemoryRouter>
          <TranscriptEntries entries={[runningTools]} running onApprove={() => {}} onRespond={() => {}} />
        </MemoryRouter>,
      );

      const line = screen.getByRole('group', { name: 'Reading' });
      expect(line).toHaveAttribute('aria-busy', 'true');
      expect(within(line).queryByText(/failed|incomplete/)).not.toBeInTheDocument();
    });
  });

  describe('when a command exits with a failure code', () => {
    it.each([
      ['with the call', [assistant('step', [gitStatus, gitStatusExit])]],
      ['in a later message', [assistant('step', [gitStatus]), assistant('sealed', [gitStatusExit])]],
    ])('reads as failed once the thread reloads, its exit saved %s', (_, messages) => {
      renderEntries(createInitialTranscript({ messages }).entries);

      const line = screen.getByRole('group', { name: 'Ran git status' });
      expect(within(line).getByRole('img', { name: 'Failed' })).toBeVisible();
    });

    it('reads as failed from the exit its stream reported, even though the call itself reports no error', () => {
      const events = [
        { type: 'message_start', message: assistant('turn', []) },
        { type: 'tool_start', toolCallId: 'git', toolName: 'execute_command', args: { command: 'git status' } },
        { type: 'command_exit', toolCallId: 'git', exitCode: 128, success: false },
        {
          type: 'tool_end',
          toolCallId: 'git',
          result: 'fatal: not a git repository\n\nExit code: 128',
          isError: false,
        },
        { type: 'message_end', id: 'turn' },
      ] as const;
      const state = events.reduce(
        (next, event) => transcriptReducer(next, { type: 'event', event }),
        initialTranscript,
      );
      renderEntries(state.entries);

      const line = screen.getByRole('group', { name: 'Ran git status' });
      expect(within(line).getByRole('img', { name: 'Failed' })).toBeVisible();
    });

    const survivingStart = {
      type: 'tool_start',
      toolCallId: 'git',
      toolName: 'execute_command',
      args: { command: 'git status' },
    } as const;
    const survivingEnd = {
      type: 'tool_end',
      toolCallId: 'git',
      result: 'fatal: not a git repository\n\nExit code: 128',
      isError: false,
    } as const;

    it.each([
      ['its exit', survivingStart, [assistant('step', [gitStatus, gitStatusExit])]],
      ['its start and its exit', survivingEnd, [assistant('step', [gitStatus, gitStatusExit])]],
      [
        'its start and its exit, saved in a later message',
        survivingEnd,
        [assistant('step', [gitStatus]), assistant('sealed', [gitStatusExit])],
      ],
    ] as const)(
      'reads as failed when the stream dropped %s, once the refetched thread brings it in',
      (_, survived, messages) => {
        const events = [
          { type: 'message_start', message: assistant('turn', []) },
          survived,
          { type: 'message_end', id: 'turn' },
        ] as const;
        const streamed = events.reduce(
          (next, event) => transcriptReducer(next, { type: 'event', event }),
          initialTranscript,
        );
        const refetched = transcriptReducer(streamed, { type: 'mergeWindow', messages: [...messages] });
        renderEntries(refetched.entries);

        const line = screen.getByRole('group', { name: 'Ran git status' });
        expect(within(line).getByRole('img', { name: 'Failed' })).toBeVisible();
      },
    );

    it('keeps a clean exit, and a process it killed, successful', () => {
      const { entries } = createInitialTranscript({
        messages: [
          assistant('list', [
            ran('ls', 'mastra_workspace_execute_command', { command: 'ls' }, 'README.md'),
            exited('ls', { exitCode: 0, success: true }),
          ]),
          assistant('stop', [
            ran('kill', 'kill_process', { pid: 4242 }, 'Process 4242 has been killed.'),
            exited('kill', { exitCode: 137, success: false, killed: true }),
          ]),
        ],
      });
      renderEntries(entries);

      expect(screen.queryByRole('img', { name: 'Failed' })).not.toBeInTheDocument();
    });
  });
});

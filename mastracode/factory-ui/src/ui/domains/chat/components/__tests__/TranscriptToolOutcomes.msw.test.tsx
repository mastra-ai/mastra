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

function ranCommand(toolCallId: string, toolName: string, result: string): MastraDBMessage {
  return assistant(`call-${toolCallId}`, [
    {
      type: 'tool-invocation',
      toolInvocation: { state: 'result', toolCallId, toolName, args: { command: 'git status' }, result },
    },
  ]);
}

function sandboxExit(toolCallId: string, exitCode: number): MastraDBMessage {
  return assistant(`exit-${toolCallId}`, [
    {
      type: 'data-sandbox-exit',
      data: { exitCode, success: exitCode === 0, killed: false, timedOut: false, toolCallId },
    },
  ]);
}

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
    it('reads as failed once the thread reloads, from the exit its sandbox reported', () => {
      const { entries } = createInitialTranscript({
        messages: [
          ranCommand('git', 'execute_command', 'fatal: not a git repository\n\nExit code: 1'),
          sandboxExit('git', 1),
        ],
      });
      renderEntries(entries);

      const line = screen.getByRole('group', { name: 'Ran git status' });
      expect(within(line).getByRole('img', { name: 'Failed' })).toBeVisible();
    });

    it('reads as failed while the run streams it, even though the call itself reports no error', () => {
      const events = [
        { type: 'message_start', message: assistant('turn', []) },
        { type: 'tool_start', toolCallId: 'git', toolName: 'execute_command', args: { command: 'git status' } },
        { type: 'command_exit', toolCallId: 'git', exitCode: 1, success: false },
        { type: 'tool_end', toolCallId: 'git', result: 'fatal: not a git repository\n\nExit code: 1', isError: false },
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

    it('keeps a clean exit, and a process it killed, successful', () => {
      const { entries } = createInitialTranscript({
        messages: [
          ranCommand('ls', 'mastra_workspace_execute_command', 'README.md'),
          sandboxExit('ls', 0),
          ranCommand('kill', 'kill_process', 'Process 4242 killed'),
          sandboxExit('kill', 137),
        ],
      });
      renderEntries(entries);

      expect(screen.queryByRole('img', { name: 'Failed' })).not.toBeInTheDocument();
    });
  });
});

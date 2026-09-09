// @vitest-environment jsdom

import type { AgentControllerEvent } from '@mastra/client-js';
import { screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { releaseSession, renderThread, stubPreparingSession } from './composer-session-test-fixture';

/**
 * A client that connects mid-run gets the controller's display state as the first SSE frame.
 * The transcript must draw the in-flight tool and the pending question from that snapshot
 * alone — before any tool_start / tool_suspended event arrives.
 */
describe('Transcript late join', () => {
  it('draws the running tool and pending question from the first display_state_changed frame', async () => {
    const session = stubPreparingSession({ materialized: true, autoAgentEnd: false });
    const { client } = renderThread();
    await releaseSession(session.finishWorkspace, client);

    await session.emit({
      type: 'display_state_changed',
      displayState: {
        isRunning: true,
        currentMessage: null,
        queuedFollowUps: 0,
        tokenUsage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
        activeTools: {
          'call-1': { name: 'execute_command', args: { command: 'pnpm build' }, status: 'running' },
          'call-2': { name: 'ask_user', args: { question: 'Which file should I edit?' }, status: 'running' },
        },
        toolInputBuffers: {},
        pendingApproval: null,
        pendingSuspensions: {
          'call-2': {
            toolCallId: 'call-2',
            toolName: 'ask_user',
            args: { question: 'Which file should I edit?' },
            suspendPayload: { question: 'Which file should I edit?' },
          },
        },
        activeSubagents: {},
        bufferingMessages: false,
        bufferingObservations: false,
        modifiedFiles: {},
        tasks: [],
        previousTasks: [],
      },
    } as unknown as AgentControllerEvent);

    // Entries reveal with a staggered arrival animation, so give them room to land.
    const runningRow = await screen.findByRole('group', { name: 'Tool: execute_command' }, { timeout: 5000 });
    expect(runningRow).toHaveAttribute('aria-busy', 'true');
    expect(within(runningRow).getByText('pnpm build')).toBeInTheDocument();

    const question = await screen.findByRole('group', { name: 'Question from the agent' }, { timeout: 5000 });
    expect(within(question).getByText('Which file should I edit?')).toBeInTheDocument();
    expect(within(question).getByRole('textbox')).toBeInTheDocument();

    // The call resolved elsewhere (another tab answered): tool_end closes the card and drops the prompt.
    await session.emit({ type: 'tool_end', toolCallId: 'call-2', toolName: 'ask_user', result: 'a.ts', isError: false });
    await session.emit({
      type: 'tool_end',
      toolCallId: 'call-1',
      toolName: 'execute_command',
      result: 'done',
      isError: false,
    });

    await waitFor(
      () => {
        // The answerable prompt card is gone; only the settled ask_user row with its answer remains.
        const cards = screen.getAllByRole('group', { name: 'Question from the agent' });
        expect(cards).toHaveLength(1);
        expect(within(cards[0]!).queryByRole('textbox')).not.toBeInTheDocument();
        expect(within(cards[0]!).getByText('a.ts')).toBeInTheDocument();
        expect(screen.getByRole('group', { name: 'Tool: execute_command' })).toHaveAttribute('aria-busy', 'false');
      },
      { timeout: 5000 },
    );
    expect(screen.getAllByRole('group', { name: 'Tool: execute_command' })).toHaveLength(1);
  });
});

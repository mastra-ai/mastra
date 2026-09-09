// @vitest-environment jsdom

import type { KnownAgentControllerEvent, MastraDBMessage } from '@mastra/client-js';
import { defaultDisplayState } from '@mastra/core/agent-controller';
import { screen, waitFor } from '@testing-library/react';
import { expect, it } from 'vitest';

import { releaseSession, renderThread, stubPreparingSession } from './composer-session-test-fixture';

it('restores the prompt and reply from the session snapshot before any new tool result', async () => {
  const session = stubPreparingSession({ materialized: true, autoAgentEnd: false });
  const { client } = renderThread();
  await releaseSession(session.finishWorkspace, client);
  const prompt: MastraDBMessage = {
    id: 'prompt',
    role: 'signal',
    createdAt: new Date(),
    content: {
      format: 2,
      parts: [{ type: 'data-user-message', data: { id: 'prompt', type: 'user', contents: 'Review this PR' } }],
      metadata: { signal: { id: 'prompt', type: 'user' } },
    },
  };
  const reply: MastraDBMessage = {
    id: 'reply',
    role: 'assistant',
    createdAt: new Date(),
    content: { format: 2, parts: [{ type: 'text', text: 'Checking out the PR.' }] },
  };
  const snapshot: Extract<KnownAgentControllerEvent, { type: 'display_state_changed' }> = {
    type: 'display_state_changed',
    displayState: {
      ...defaultDisplayState(),
      isRunning: true,
      currentMessage: reply,
      messages: [
        { message: prompt, streaming: false },
        { message: reply, streaming: true },
      ],
      activeTools: { checkout: { name: 'execute_command', args: { command: 'sleep 30' }, status: 'running' } },
      toolInputBuffers: {},
      pendingSuspensions: {},
      activeSubagents: {},
      modifiedFiles: {},
    },
  };
  await session.emit(snapshot);
  expect(await screen.findByText('Review this PR')).toBeVisible();
  const replyText = (_: string, element: Element | null) =>
    element?.tagName === 'P' && element.textContent === 'Checking out the PR.';
  expect(await screen.findByText(replyText, {}, { timeout: 5000 })).toBeVisible();
  expect(await screen.findByRole('group', { name: 'Tool: execute_command' })).toHaveAttribute('aria-busy', 'true');
  await session.emit(snapshot);
  expect(screen.getAllByText('Review this PR')).toHaveLength(1);
  expect(screen.getAllByText(replyText)).toHaveLength(1);
  await session.emit({
    ...snapshot,
    displayState: {
      ...snapshot.displayState,
      isRunning: false,
      messages: [
        { message: prompt, streaming: false },
        { message: reply, streaming: false },
      ],
      activeTools: {
        checkout: { name: 'execute_command', args: { command: 'sleep 30' }, status: 'completed', result: 'done' },
      },
    },
  });
  await waitFor(() => expect(screen.getAllByRole('button', { name: 'Copy message' })).toHaveLength(2));
});

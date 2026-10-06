import type { AgentControllerEvent } from '@mastra/client-js';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { waitForMutationsIdle } from '../../../../../../e2e/ui/render';
import { renderThread, stubPreparingSession } from './composer-session-test-fixture';

const REPLY_ID = 'assistant-1';

const replyStart = {
  type: 'message_start',
  message: {
    id: REPLY_ID,
    role: 'assistant',
    createdAt: new Date('2026-10-06T09:27:13.000Z'),
    content: {
      format: 2,
      parts: [
        { type: 'reasoning', reasoning: '', details: [] },
        { type: 'text', text: 'Need to build playground-ui first.' },
      ],
    },
  },
} satisfies AgentControllerEvent;

const reasoningDelta = {
  type: 'message_update',
  id: REPLY_ID,
  event: { type: 'reasoning-delta', index: 0, delta: 'Building only the playground-ui package.' },
} satisfies AgentControllerEvent;

async function startReasoningReply() {
  const session = stubPreparingSession({ autoAgentEnd: false });
  const user = userEvent.setup();
  const { client } = renderThread();
  session.finishWorkspace();
  await waitForMutationsIdle(client);

  const composer = () => screen.getByRole('textbox', { name: 'Message' });
  await waitFor(() => expect(composer()).toBeEnabled());
  await user.type(composer(), 'review the pull request');
  await user.keyboard('{Enter}');

  await session.emit({ type: 'agent_start' });
  await session.emit(replyStart);
  await session.emit(reasoningDelta);
  return session;
}

const reasoningRow = () => screen.getByRole('group', { name: 'Reasoning' });

describe('Reasoning in a stopped run', () => {
  it('Given a reply reasoning in a live run, Then the Reasoning row shimmers', async () => {
    await startReasoningReply();

    await waitFor(() => expect(reasoningRow()).toHaveAttribute('aria-busy', 'true'), { timeout: 3000 });
  });

  it('Given a reply reasoning in a live run, When the stream drops before the reply ends and the session reports the run stopped, Then the Reasoning row stops shimmering', async () => {
    const session = await startReasoningReply();
    await waitFor(() => expect(reasoningRow()).toHaveAttribute('aria-busy', 'true'), { timeout: 3000 });
    expect(screen.getByRole('button', { name: 'Abort' })).toBeInTheDocument();

    await session.dropStream();

    await waitFor(() => expect(screen.queryByRole('button', { name: 'Abort' })).not.toBeInTheDocument(), {
      timeout: 5000,
    });
    expect(reasoningRow()).not.toHaveAttribute('aria-busy', 'true');
  });
});

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
    content: { format: 2, parts: [{ type: 'reasoning', reasoning: '', details: [] }] },
  },
} satisfies AgentControllerEvent;

const reasoningDelta = {
  type: 'message_update',
  id: REPLY_ID,
  event: { type: 'reasoning-delta', index: 0, delta: 'Building only the playground-ui package.' },
} satisfies AgentControllerEvent;

const replyEnd = { type: 'message_end', id: REPLY_ID } satisfies AgentControllerEvent;

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
  await waitFor(() => expect(reasoningRow()).toHaveAttribute('aria-busy', 'true'), { timeout: 3000 });
  return session;
}

const reasoningRow = () => screen.getByRole('group', { name: 'Reasoning' });

describe('Reasoning in a stopped run', () => {
  it('Given a reply still reasoning in a live run, Then the Reasoning row shimmers and the run can be aborted', async () => {
    await startReasoningReply();

    expect(screen.getByRole('button', { name: 'Abort' })).toBeInTheDocument();
  });

  it('Given a reply still reasoning, When the stream drops and the run ends before it reconnects, Then the run reads as stopped and the Reasoning row stops shimmering', async () => {
    const session = await startReasoningReply();

    await session.dropStream([replyEnd, { type: 'agent_end' }]);

    await waitFor(() => expect(screen.queryByRole('button', { name: 'Abort' })).not.toBeInTheDocument(), {
      timeout: 5000,
    });
    expect(reasoningRow()).not.toHaveAttribute('aria-busy', 'true');
  });
});

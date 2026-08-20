import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { waitForMutationsIdle } from '../../../../../../e2e/ui/render';
import { releaseSession, renderThread, stubPreparingSession } from './composer-session-test-fixture';

const MESSAGE = 'Use the platform token, then continue';

describe('Composer steering', () => {
  it('queues the message without interrupting the active run and confirms its delivery', async () => {
    const session = stubPreparingSession({ autoAgentEnd: false });
    const user = userEvent.setup();
    const { client } = renderThread();
    await releaseSession(session.finishWorkspace, client);
    await session.emit({ type: 'agent_start' });

    const composer = await screen.findByRole('textbox', { name: 'Message' });
    await waitFor(() => expect(composer).toHaveAttribute('placeholder', 'Steer the agent…'));
    await user.type(composer, MESSAGE);
    await user.keyboard('{Enter}');

    await waitFor(() => expect(session.delivered).toEqual([MESSAGE]));
    await waitForMutationsIdle(client);
    expect(session.steerAttempts).toBe(0);
    expect(screen.getByText('Steering…')).toBeInTheDocument();
    expect(screen.getAllByText(MESSAGE)).toHaveLength(1);

    const createdAt = new Date('2026-08-20T10:00:00.000Z');
    await session.emit({
      type: 'message_start',
      message: {
        id: 'signal-steer',
        role: 'signal',
        createdAt,
        content: {
          format: 2,
          parts: [{ type: 'text', text: MESSAGE }],
          metadata: {
            signal: {
              id: 'signal-steer',
              type: 'user',
              tagName: 'user',
              contents: MESSAGE,
              createdAt: createdAt.toISOString(),
              attributes: { delivery: 'while-active' },
            },
          },
        },
      },
    });

    expect(await screen.findByText('Steered message')).toBeInTheDocument();
    expect(screen.queryByText('Steering…')).not.toBeInTheDocument();
    expect(screen.getAllByText(MESSAGE)).toHaveLength(1);
  });

  it('marks a rejected steering message as not sent', async () => {
    const session = stubPreparingSession({ autoAgentEnd: false, failDispatch: true });
    const user = userEvent.setup();
    const { client } = renderThread();
    await releaseSession(session.finishWorkspace, client);
    await session.emit({ type: 'agent_start' });

    const composer = await screen.findByRole('textbox', { name: 'Message' });
    await waitFor(() => expect(composer).toHaveAttribute('placeholder', 'Steer the agent…'));
    await user.type(composer, MESSAGE);
    await user.keyboard('{Enter}');

    expect(await screen.findByText('Not sent')).toBeInTheDocument();
    await waitForMutationsIdle(client);
    expect(screen.queryByText('Steering…')).not.toBeInTheDocument();
    expect(screen.getAllByText(MESSAGE)).toHaveLength(1);
    expect(screen.getByText(/Sandbox is gone/)).toBeInTheDocument();
    expect(session.delivered).toEqual([]);
    expect(session.steerAttempts).toBe(0);
  });
});

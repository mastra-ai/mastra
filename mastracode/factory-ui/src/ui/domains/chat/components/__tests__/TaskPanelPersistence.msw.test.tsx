import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { releaseSession, renderThread, SESSION_ID, stubPreparingSession } from './composer-session-test-fixture';

describe('TaskPanel persistence', () => {
  describe('when a chat with durable tasks is reopened', () => {
    it('restores the current task list from the session snapshot', async () => {
      const session = stubPreparingSession({
        tasks: [
          {
            id: 'investigate',
            content: 'Investigate the bug',
            status: 'completed',
            activeForm: 'Investigating the bug',
          },
          { id: 'fix', content: 'Fix the bug', status: 'in_progress', activeForm: 'Fixing the bug' },
        ],
      });
      const { client } = renderThread();
      await releaseSession(session.finishWorkspace, client);

      expect(await screen.findByText('Fixing the bug')).toBeInTheDocument();

      await userEvent.click(screen.getByRole('link', { name: 'go-away' }));
      await userEvent.click(screen.getByRole('link', { name: 'go-thread' }));

      expect(await screen.findByText('Fixing the bug')).toBeInTheDocument();
    });
  });

  it('reconciles current tasks from a reconnect snapshot without replaying task events', async () => {
    const session = stubPreparingSession({
      tasks: [{ id: 'old', content: 'Old task', status: 'pending', activeForm: 'Working on old task' }],
    });
    const { client } = renderThread();
    await releaseSession(session.finishWorkspace, client);
    await screen.findByRole('region', { name: 'Current tasks' });

    await session.emit({
      type: 'display_state_changed',
      displayState: {
        threadId: SESSION_ID,
        tasks: [{ id: 'new', content: 'New task', status: 'in_progress', activeForm: 'Working on new task' }],
      },
    });

    expect(await screen.findByText('Working on new task')).toBeInTheDocument();
    expect(screen.queryByText('Old task')).not.toBeInTheDocument();

    await session.emit({ type: 'display_state_changed', displayState: { threadId: SESSION_ID, tasks: [] } });
    await waitFor(() => expect(screen.queryByRole('region', { name: 'Current tasks' })).not.toBeInTheDocument());
  });
});

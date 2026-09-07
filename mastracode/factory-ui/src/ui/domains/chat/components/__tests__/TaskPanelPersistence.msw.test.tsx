import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { releaseSession, renderThread, stubPreparingSession } from './composer-session-test-fixture';

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
});

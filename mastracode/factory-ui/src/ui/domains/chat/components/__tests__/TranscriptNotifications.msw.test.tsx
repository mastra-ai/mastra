import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { renderWithProviders } from '../../../../../../e2e/ui/render';
import type { TimelineEntry } from '../../services/transcript';
import { TranscriptEntries } from '../Transcript';

function renderEntries(entries: TimelineEntry[]) {
  return renderWithProviders(<TranscriptEntries entries={entries} onApprove={() => {}} onRespond={() => {}} />);
}

describe('Transcript notifications', () => {
  describe('when a merged pull request notification has a repository target', () => {
    it('reveals its complete message and GitHub link', async () => {
      const message =
        'The pull request was merged after the review finished. The composer and attachment changes are ready for verification.';
      renderEntries([
        {
          kind: 'notification',
          id: 'merged',
          source: 'github',
          notifKind: 'pull-request-merged',
          message,
          metadata: { repository: 'mastra-ai/mastra', pullRequestNumber: 24263 },
        },
      ]);

      const notification = screen.getByRole('group', { name: 'Notification: github' });
      expect(notification).toHaveAttribute('data-notification-state', 'merged');
      expect(within(notification).queryByRole('link')).not.toBeInTheDocument();
      await userEvent.click(within(notification).getByRole('button'));
      expect(within(notification).getByText(message)).toBeVisible();
      const link = within(notification).getByRole('link', { name: `Open notification target: ${message}` });
      expect(link).toHaveAttribute('href', 'https://github.com/mastra-ai/mastra/pull/24263');
      expect(link).toHaveAttribute('rel', 'noreferrer');
    });
  });

  describe('when a notification has an unsupported target URL', () => {
    it('keeps the message available without exposing the URL', async () => {
      renderEntries([
        {
          kind: 'notification',
          id: 'invalid-target',
          source: 'github',
          message: 'A work item was updated.',
          metadata: { targetUrl: 'javascript:alert(1)' },
        },
      ]);

      const notification = within(screen.getByRole('group', { name: 'Notification: github' }));
      await userEvent.click(notification.getByRole('button'));
      expect(notification.queryByRole('link')).not.toBeInTheDocument();
      expect(notification.getAllByText('A work item was updated.')).toHaveLength(2);
    });
  });

  describe('when pending notifications are summarized', () => {
    it('keeps the summary expandable in the transcript', async () => {
      renderEntries([
        {
          kind: 'notification_summary',
          id: 'summary',
          message: '2 pull requests and 1 issue need attention.',
          pending: 3,
          bySource: { github: 3 },
          byPriority: { high: 3 },
          notificationIds: ['1', '2', '3'],
        },
      ]);

      const notification = within(screen.getByRole('group', { name: 'Notification: Notification summary' }));
      const trigger = notification.getByRole('button');
      await userEvent.click(trigger);
      expect(trigger).toHaveAttribute('aria-expanded', 'true');
      expect(notification.getAllByText('2 pull requests and 1 issue need attention.')).toHaveLength(2);
    });
  });
});

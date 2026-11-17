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
      const link = within(notification).getByRole('link', { name: /^Open on GitHub: The pull request was merged/ });
      expect(link).toHaveAttribute('href', 'https://github.com/mastra-ai/mastra/pull/24263');
      expect(link).toHaveAttribute('rel', 'noreferrer');
    });
  });

  describe('when a notification has an unsupported target URL', () => {
    it('keeps the message on its line without exposing the URL', () => {
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
      expect(notification.queryByRole('link')).not.toBeInTheDocument();
      expect(notification.getByText('A work item was updated.')).toBeVisible();
      expect(notification.queryByRole('button')).not.toBeInTheDocument();
    });
  });

  describe('when pending notifications are summarized', () => {
    it('says how many are new and names their source', () => {
      renderEntries([
        {
          kind: 'notification_summary',
          id: 'summary',
          message: 'factory-session: 1',
          pending: 1,
          bySource: { 'factory-session': 1 },
          byPriority: { low: 1 },
          notificationIds: ['1'],
        },
      ]);

      const summary = screen.getByRole('group', { name: 'Notification summary' });
      expect(summary).toHaveAttribute('data-notification-state', 'summary');
      expect(within(summary).getByText('Notifications')).toBeVisible();
      expect(within(summary).getByText('1 new')).toBeVisible();
      expect(within(summary).getByText('Factory session')).toBeVisible();
      expect(within(summary).queryByText('factory-session: 1')).not.toBeInTheDocument();
      expect(within(summary).queryByRole('button')).not.toBeInTheDocument();
    });

    it('counts each source when several are pending, including ones it has no name for', () => {
      renderEntries([
        {
          kind: 'notification_summary',
          id: 'summary',
          message: 'github: 3, my-webhook: 1',
          pending: 4,
          bySource: { github: 3, 'my-webhook': 1 },
          byPriority: { high: 3, low: 1 },
          notificationIds: ['1', '2', '3', '4'],
        },
      ]);

      const summary = within(screen.getByRole('group', { name: 'Notification summary' }));
      expect(summary.getByText('4 new')).toBeVisible();
      expect(summary.getByText('GitHub 3')).toBeVisible();
      expect(summary.getByText('My webhook 1')).toBeVisible();
    });

    it('falls back to the summary text when it carries no counts', () => {
      renderEntries([
        {
          kind: 'notification_summary',
          id: 'summary',
          message: 'No pending notifications',
          pending: 0,
          bySource: {},
          byPriority: {},
          notificationIds: [],
        },
      ]);

      const summary = within(screen.getByRole('group', { name: 'Notification summary' }));
      expect(summary.getByText('No pending notifications')).toBeVisible();
    });

    it('names a source that collides with a built-in object key from its id', () => {
      renderEntries([
        {
          kind: 'notification_summary',
          id: 'summary',
          message: '__proto__: 1',
          pending: 1,
          bySource: JSON.parse('{"__proto__": 1}') as Record<string, number>,
          byPriority: { low: 1 },
          notificationIds: ['1'],
        },
      ]);

      const summary = within(screen.getByRole('group', { name: 'Notification summary' }));
      expect(summary.getByText('1 new')).toBeVisible();
      expect(summary.getByText('Proto')).toBeVisible();
    });
  });
});

// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { NotificationActivity } from './notification-activity';

afterEach(cleanup);

describe('NotificationActivity', () => {
  describe('when a short message has a link', () => {
    it('keeps the full message available in the expanded body', () => {
      const message = 'The production deployment failed. Please check the logs.';
      render(
        <NotificationActivity
          label="github"
          message={message}
          link={{ href: 'https://github.com/mastra-ai/mastra', label: 'Open on GitHub' }}
        />,
      );

      fireEvent.click(screen.getByRole('button', { name: /github/ }));

      const link = screen.getByRole('link', { name: `Open notification target: ${message}` });
      if (!link.parentElement) throw new Error('Notification body is missing');
      expect(within(link.parentElement).getByText(message)).toBeTruthy();
    });
  });

  describe('when a short message has no link', () => {
    it('shows the message without a redundant disclosure', () => {
      render(<NotificationActivity label="github" message="Deployment finished." />);

      expect(screen.getByText('Deployment finished.')).toBeTruthy();
      expect(screen.queryByRole('button')).toBeNull();
    });
  });
});

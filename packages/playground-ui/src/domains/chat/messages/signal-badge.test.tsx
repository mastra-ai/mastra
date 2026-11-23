// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { SignalBadge } from './signal-badge';

afterEach(() => cleanup());

describe('SignalBadge', () => {
  describe('when the value is not signal data', () => {
    it.each([null, 'text', 42, { type: 'unknown' }, { type: 'user' }])('renders nothing for %j', value => {
      const { container } = render(<SignalBadge signal={value} />);

      expect(container.innerHTML).toBe('');
    });
  });

  describe('when the signal is a notification', () => {
    it('renders the notification notice', () => {
      render(
        <SignalBadge
          signal={{
            type: 'notification',
            contents: 'Build failed on main',
            metadata: { notification: { source: 'ci', kind: 'failure', priority: 'high' } },
          }}
        />,
      );

      expect(screen.getByText('Build failed on main')).not.toBeNull();
      expect(screen.getByText(/ci/)).not.toBeNull();
    });
  });

  describe('when the signal is a state signal', () => {
    it('shows the state id, mode and text contents', () => {
      render(
        <SignalBadge
          signal={{
            type: 'state',
            contents: [{ type: 'text', text: 'Branch: main' }],
            metadata: { state: { id: 'git', mode: 'watch' } },
          }}
        />,
      );

      expect(screen.getByText('git')).not.toBeNull();
      expect(screen.getByText('watch')).not.toBeNull();
      expect(screen.getByText('Branch: main')).not.toBeNull();
    });

    it('falls back to attributes and then to a generic label', () => {
      const { rerender } = render(<SignalBadge signal={{ type: 'state', attributes: { id: 'from-attr' } }} />);
      expect(screen.getByText('from-attr')).not.toBeNull();

      rerender(<SignalBadge signal={{ type: 'state' }} />);
      expect(screen.getByText('State signal')).not.toBeNull();
    });

    it('hides task-list signals because the task panel renders them', () => {
      const tasks = [{ id: '1', content: 'Do it', status: 'pending', activeForm: 'Doing it' }];
      const { container } = render(
        <SignalBadge signal={{ type: 'state', id: 'tasks', metadata: { value: { tasks } } }} />,
      );

      expect(container.innerHTML).toBe('');
    });

    it('still renders a task-named signal whose payload is not a task list', () => {
      render(
        <SignalBadge
          signal={{ type: 'state', tagName: 'current-task-list', metadata: { value: { tasks: 'nope' } } }}
        />,
      );

      expect(screen.getByText('State signal')).not.toBeNull();
    });
  });

  describe('when the signal is reactive', () => {
    it('shows the tag name and text contents', () => {
      render(<SignalBadge signal={{ type: 'reactive', tagName: 'deploy-status', contents: 'Deployed v2' }} />);

      expect(screen.getByText('deploy-status')).not.toBeNull();
      expect(screen.getByText('Deployed v2')).not.toBeNull();
    });

    it('falls back to a generic Signal label without a tag name', () => {
      render(<SignalBadge signal={{ type: 'reactive' }} />);

      expect(screen.getByText('Signal')).not.toBeNull();
    });
  });
});

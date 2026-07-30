// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TaskList } from './task-list';
import type { TaskListItem } from './task-list';

const mixedTasks: TaskListItem[] = [
  { id: 'done', content: 'Inspect code', status: 'completed', activeForm: 'Inspecting code' },
  { id: 'active', content: 'Add tests', status: 'in_progress', activeForm: 'Adding tests' },
  { id: 'pending', content: 'Build package', status: 'pending', activeForm: 'Building package' },
];

const completedTasks: TaskListItem[] = mixedTasks.map(task => ({ ...task, status: 'completed' }));

afterEach(cleanup);

describe('TaskList', () => {
  beforeEach(() => {
    Element.prototype.scrollIntoView = vi.fn();
  });

  describe('when tasks have mixed statuses', () => {
    it('renders the completion count', () => {
      render(<TaskList tasks={mixedTasks} />);

      expect(screen.getByText('1/3 completed')).toBeTruthy();
    });

    it('renders progress for the completed tasks', () => {
      render(<TaskList tasks={mixedTasks} />);

      expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBe('1');
      expect(screen.getByRole('progressbar').getAttribute('aria-valuemax')).toBe('3');
    });

    it('renders the active form instead of the task content', () => {
      render(<TaskList tasks={mixedTasks} />);

      expect(screen.getByText('Adding tests')).toBeTruthy();
      expect(screen.queryByText('Add tests')).toBeNull();
    });

    it('renders an accessible label for each task status', () => {
      render(<TaskList tasks={mixedTasks} />);

      expect(screen.getByLabelText('Completed')).toBeTruthy();
      expect(screen.getByLabelText('In progress')).toBeTruthy();
      expect(screen.getByLabelText('Pending')).toBeTruthy();
    });

    it('scrolls the active task into view only when its identity changes', () => {
      const { rerender } = render(<TaskList tasks={mixedTasks} />);
      expect(Element.prototype.scrollIntoView).toHaveBeenCalledOnce();

      rerender(<TaskList tasks={[...mixedTasks]} />);
      expect(Element.prototype.scrollIntoView).toHaveBeenCalledOnce();

      rerender(
        <TaskList
          tasks={mixedTasks.map(task =>
            task.id === 'active'
              ? { ...task, status: 'completed' }
              : task.id === 'pending'
                ? { ...task, status: 'in_progress' }
                : task,
          )}
        />,
      );
      expect(Element.prototype.scrollIntoView).toHaveBeenCalledTimes(2);
    });
  });

  describe('when the task list is empty', () => {
    it('hides the list by default', () => {
      const { container } = render(<TaskList tasks={[]} />);

      expect(container.firstChild).toBeNull();
    });
  });

  describe('when every task is completed', () => {
    it('hides the list by default', () => {
      const { container } = render(<TaskList tasks={completedTasks} />);

      expect(container.firstChild).toBeNull();
    });
  });

  describe('when empty lists are configured to remain visible', () => {
    it('renders an empty completion count', () => {
      render(<TaskList tasks={[]} hideWhenEmpty={false} />);

      expect(screen.getByText('0/0 completed')).toBeTruthy();
    });
  });

  describe('when completed lists are configured to remain visible', () => {
    it('renders the completed task count', () => {
      render(<TaskList tasks={completedTasks} hideWhenComplete={false} />);

      expect(screen.getByText('3/3 completed')).toBeTruthy();
    });
  });
});

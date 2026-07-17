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

afterEach(cleanup);

describe('TaskList', () => {
  beforeEach(() => {
    Element.prototype.scrollIntoView = vi.fn();
  });

  describe('when tasks have mixed statuses', () => {
    it('renders completion count, progress, status labels, and the active form', () => {
      render(<TaskList tasks={mixedTasks} />);

      expect(screen.getByText('1/3 completed')).toBeTruthy();
      expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBe('1');
      expect(screen.getByRole('progressbar').getAttribute('aria-valuemax')).toBe('3');
      expect(screen.getByText('Adding tests')).toBeTruthy();
      expect(screen.queryByText('Add tests')).toBeNull();
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

  describe('when there are no visible tasks', () => {
    it('hides empty and completed lists by default', () => {
      const { rerender, container } = render(<TaskList tasks={[]} />);
      expect(container.firstChild).toBeNull();

      rerender(<TaskList tasks={mixedTasks.map(task => ({ ...task, status: 'completed' }))} />);
      expect(container.firstChild).toBeNull();
    });

    it('can explicitly render empty and completed lists', () => {
      const { rerender } = render(<TaskList tasks={[]} hideWhenEmpty={false} />);
      expect(screen.getByText('0/0 completed')).toBeTruthy();
      expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBe('0');

      rerender(
        <TaskList tasks={mixedTasks.map(task => ({ ...task, status: 'completed' }))} hideWhenComplete={false} />,
      );
      expect(screen.getByText('3/3 completed')).toBeTruthy();
    });
  });
});

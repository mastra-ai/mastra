// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
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
    it('renders progress for the completed tasks', () => {
      render(<TaskList tasks={mixedTasks} />);

      expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBe('1');
      expect(screen.getByRole('progressbar').getAttribute('aria-valuemax')).toBe('3');
    });

    it('renders one progress bar per task, colored by status', () => {
      render(<TaskList tasks={mixedTasks} />);

      const bars = Array.from(screen.getByRole('progressbar').children).map(bar => bar.className);
      expect(bars).toHaveLength(3);
      expect(bars[0]).toContain('bg-positive1');
      expect(bars[1]).toContain('bg-warning1');
      expect(bars[2]).toContain('bg-surface6');
    });

    it('reveals the exact count on hover', async () => {
      render(<TaskList tasks={mixedTasks} />);

      fireEvent.mouseEnter(screen.getByRole('progressbar'));

      expect((await screen.findByRole('tooltip')).textContent).toBe('1/3 completed');
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

    it('marks each task with an icon of its own', () => {
      render(<TaskList tasks={mixedTasks} />);

      for (const label of ['Completed', 'In progress', 'Pending']) {
        expect(screen.getByLabelText(label).querySelector('svg')).toBeTruthy();
      }

      const icons = ['Completed', 'In progress', 'Pending'].map(
        label => screen.getByLabelText(label).querySelector('svg')?.getAttribute('class') ?? '',
      );
      expect(new Set(icons).size).toBe(3);
    });

    it('strikes a completed task through and leans on the one in progress', () => {
      render(<TaskList tasks={mixedTasks} />);

      const labelOf = (status: string) => screen.getByLabelText(status).nextElementSibling as HTMLElement;

      expect(labelOf('Completed').classList.contains('line-through')).toBe(true);
      expect(labelOf('In progress').classList.contains('font-medium')).toBe(true);
      expect(labelOf('Pending').classList.contains('line-through')).toBe(false);
      expect(labelOf('Pending').classList.contains('font-medium')).toBe(false);
    });

    it('brings the active task no further into view than it needs', () => {
      render(<TaskList tasks={mixedTasks} />);

      expect(Element.prototype.scrollIntoView).toHaveBeenCalledWith({ block: 'nearest' });
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

  describe('when the list is collapsed', () => {
    const collapse = () => fireEvent.click(screen.getByRole('button'));

    it('hides the tasks while keeping the progress bars', () => {
      render(<TaskList tasks={mixedTasks} />);
      collapse();

      expect(screen.queryByText('Inspect code')).toBeNull();
      expect(screen.queryByText('Build package')).toBeNull();
      expect(screen.getByRole('progressbar').children).toHaveLength(3);
      expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBe('1');
    });

    it('summarizes the active task in place of the title', () => {
      render(<TaskList tasks={mixedTasks} />);
      collapse();

      expect(screen.getByText('Adding tests')).toBeTruthy();
      expect(screen.getByLabelText('In progress')).toBeTruthy();
      expect(screen.queryByText('Tasks')).toBeNull();
    });

    it('summarizes the next pending task when nothing is in progress', () => {
      render(<TaskList tasks={mixedTasks.map(task => ({ ...task, status: 'pending' }))} />);
      collapse();

      expect(screen.getByText('Inspect code')).toBeTruthy();
      expect(screen.queryByText('Add tests')).toBeNull();
    });

    it('keeps the title when every task is completed', () => {
      render(<TaskList tasks={completedTasks} hideWhenComplete={false} />);
      collapse();

      expect(screen.getByText('Tasks')).toBeTruthy();
    });

    it('restores the tasks when expanded again', () => {
      render(<TaskList tasks={mixedTasks} defaultOpen={false} />);
      expect(screen.queryByText('Inspect code')).toBeNull();

      fireEvent.click(screen.getByRole('button'));

      expect(screen.getByText('Inspect code')).toBeTruthy();
      expect(Element.prototype.scrollIntoView).toHaveBeenCalled();
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
    it('renders no progress bar', () => {
      render(<TaskList tasks={[]} hideWhenEmpty={false} />);

      expect(screen.getByRole('progressbar').children).toHaveLength(0);
    });
  });

  describe('when completed lists are configured to remain visible', () => {
    it('renders every bar as completed', () => {
      render(<TaskList tasks={completedTasks} hideWhenComplete={false} />);

      expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBe('3');
    });
  });
});

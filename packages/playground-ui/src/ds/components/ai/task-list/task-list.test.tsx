// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TaskList } from './task-list';
import type { TaskListItem } from './task-list';

const mixedTasks: TaskListItem[] = [
  { id: 'done', content: 'Inspect code', status: 'completed', activeForm: 'Inspecting code' },
  { id: 'active', content: 'Add tests', status: 'in_progress', activeForm: 'Adding tests' },
  { id: 'pending', content: 'Build package', status: 'pending', activeForm: 'Building package' },
];

const completedTasks: TaskListItem[] = mixedTasks.map(task => ({ ...task, status: 'completed' }));

const longTasks: TaskListItem[] = Array.from({ length: 6 }, (_, index) => ({
  id: `task-${index}`,
  content: `Task ${index}`,
  activeForm: `Doing task ${index}`,
  status: index < 5 ? 'completed' : 'in_progress',
}));

const collapse = () => fireEvent.click(screen.getByRole('button', { name: 'Collapse tasks' }));
const expand = () => fireEvent.click(screen.getByRole('button', { name: 'Show all tasks' }));
const visibleRows = () => within(screen.getByRole('list')).getAllByRole('listitem');

const originalScrollTo = Element.prototype.scrollTo;

afterEach(() => {
  Element.prototype.scrollTo = originalScrollTo;
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('TaskList', () => {
  beforeEach(() => {
    Element.prototype.scrollTo = vi.fn();
    vi.stubGlobal('requestAnimationFrame', (step: FrameRequestCallback) => {
      step(performance.now() + 1000);
      return 0;
    });
  });

  describe('when expanded', () => {
    it('shows every task and no progress bars', () => {
      render(<TaskList tasks={mixedTasks} />);

      expect(visibleRows()).toHaveLength(3);
      expect(screen.queryByRole('progressbar')).toBeNull();
      expect(screen.getByRole('button', { name: 'Collapse tasks' }).getAttribute('aria-expanded')).toBe('true');
    });

    it('reads out the active form instead of the task content', () => {
      render(<TaskList tasks={mixedTasks} />);
      const list = within(screen.getByRole('list'));

      expect(list.getByText('Adding tests').closest('[aria-hidden="true"]')).toBeNull();
      expect(list.getByText('Add tests').closest('[aria-hidden="true"]')).not.toBeNull();
    });

    it('renders an accessible label for each task status', () => {
      render(<TaskList tasks={mixedTasks} />);
      const list = within(screen.getByRole('list'));

      expect(list.getByLabelText('Completed')).toBeTruthy();
      expect(list.getByLabelText('In progress')).toBeTruthy();
      expect(list.getByLabelText('Pending')).toBeTruthy();
    });

    it('scrolls the list just far enough to reveal the active task', () => {
      render(<TaskList tasks={longTasks} />);

      expect(Element.prototype.scrollTo).toHaveBeenLastCalledWith({ top: 42 });
    });

    it('scrolls again only when the active task changes', () => {
      const firstTaskActive: TaskListItem[] = longTasks.map((task, index) => ({
        ...task,
        status: index === 0 ? 'in_progress' : 'pending',
      }));
      const { rerender } = render(<TaskList tasks={firstTaskActive} />);
      expect(Element.prototype.scrollTo).toHaveBeenCalledOnce();

      rerender(<TaskList tasks={[...firstTaskActive]} />);
      expect(Element.prototype.scrollTo).toHaveBeenCalledOnce();

      rerender(<TaskList tasks={longTasks} />);
      expect(Element.prototype.scrollTo).toHaveBeenLastCalledWith({ top: 42 });
    });
  });

  describe('when collapsed', () => {
    it('shows only the active task, with the progress bars', () => {
      render(<TaskList tasks={mixedTasks} />);
      collapse();

      expect(visibleRows()).toHaveLength(1);
      expect(visibleRows()[0]?.textContent).toContain('Adding tests');
      expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBe('1');
      expect(screen.getByRole('progressbar').children).toHaveLength(3);
    });

    it('scrolls the active task into the one-row window', () => {
      render(<TaskList tasks={longTasks} defaultOpen={false} />);

      expect(Element.prototype.scrollTo).toHaveBeenLastCalledWith({ top: 140 });
    });

    it('slides the active task into the one-row window when collapsing', () => {
      render(<TaskList tasks={longTasks} />);
      collapse();

      expect(Element.prototype.scrollTo).toHaveBeenLastCalledWith({ top: 140 });
    });

    it('shows the next pending task when nothing is in progress', () => {
      render(<TaskList tasks={mixedTasks.map(task => ({ ...task, status: 'pending' }))} defaultOpen={false} />);

      expect(visibleRows()[0]?.textContent).toContain('Inspect code');
    });

    it('shows the last task when every task is completed', () => {
      render(<TaskList tasks={completedTasks} hideWhenComplete={false} defaultOpen={false} />);

      expect(visibleRows()[0]?.textContent).toContain('Build package');
      expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBe('3');
    });

    it('reveals the exact count on hover', async () => {
      render(<TaskList tasks={mixedTasks} defaultOpen={false} />);

      fireEvent.mouseEnter(screen.getByRole('progressbar'));

      expect((await screen.findByRole('tooltip')).textContent).toBe('1/3 completed');
    });

    it('expands when the collapsed card itself is clicked', () => {
      render(<TaskList tasks={mixedTasks} defaultOpen={false} />);

      fireEvent.click(screen.getByText('Adding tests'));

      expect(visibleRows()).toHaveLength(3);
    });

    it('shows every task again when expanded', () => {
      render(<TaskList tasks={mixedTasks} defaultOpen={false} />);
      expand();

      expect(visibleRows()).toHaveLength(3);
      expect(screen.getByRole('button', { name: 'Collapse tasks' }).getAttribute('aria-expanded')).toBe('true');
    });
  });

  describe('when the task list is empty', () => {
    it('renders nothing', () => {
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
});

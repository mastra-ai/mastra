import type { AgentControllerThreadInfo } from '@mastra/client-js';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { renderWithProviders } from '../../../e2e/web-ui/render';
import type { Project } from './domains/workspaces';
import { Sidebar } from './Sidebar';

const project: Project = {
  id: 'p-alpha',
  name: 'Alpha',
  path: '/projects/alpha',
  resourceId: 'res-alpha',
  createdAt: 1,
};

const threadOne: AgentControllerThreadInfo = {
  id: 'thread-one',
  title: 'First thread',
  resourceId: 'res-alpha',
  createdAt: '2026-06-01T00:00:00.000Z',
  updatedAt: '2026-06-02T00:00:00.000Z',
};

const threadTwo: AgentControllerThreadInfo = {
  id: 'thread-two',
  title: 'Second thread',
  resourceId: 'res-alpha',
  createdAt: '2026-06-03T00:00:00.000Z',
  updatedAt: '2026-06-04T00:00:00.000Z',
};

function baseProps() {
  return {
    projects: [project],
    activeProjectId: project.id,
    onManageProjects: vi.fn(),
    onOpenSettings: vi.fn(),
    threads: [threadOne, threadTwo],
    activeThreadId: threadOne.id,
    onSwitchThread: vi.fn(),
    onCreateThread: vi.fn(),
    onDeleteThread: vi.fn(),
    onRenameThread: vi.fn(),
    onCloneThread: vi.fn(),
  };
}

describe('Sidebar', () => {
  describe('when a project with threads is active', () => {
    it('lists each thread by title', () => {
      renderWithProviders(<Sidebar {...baseProps()} />);

      expect(screen.getByText('First thread')).toBeInTheDocument();
      expect(screen.getByText('Second thread')).toBeInTheDocument();
    });

    it('switches threads when a thread is clicked', async () => {
      const props = baseProps();
      renderWithProviders(<Sidebar {...props} />);

      await userEvent.click(screen.getByText('Second thread'));

      expect(props.onSwitchThread).toHaveBeenCalledWith('thread-two');
    });

    it('creates a thread when the new-thread control is clicked', async () => {
      const props = baseProps();
      renderWithProviders(<Sidebar {...props} />);

      await userEvent.click(screen.getByRole('button', { name: 'New thread' }));

      expect(props.onCreateThread).toHaveBeenCalled();
    });
  });

  describe('when opening a thread action menu', () => {
    it('clones the thread', async () => {
      const props = baseProps();
      renderWithProviders(<Sidebar {...props} />);

      const row = screen.getByText('Second thread').closest('[role="listitem"]') as HTMLElement;
      await userEvent.click(within(row).getByRole('button', { name: 'Thread actions' }));
      await userEvent.click(screen.getByRole('menuitem', { name: 'Clone' }));

      expect(props.onCloneThread).toHaveBeenCalledWith('thread-two');
    });

    it('deletes the thread', async () => {
      const props = baseProps();
      renderWithProviders(<Sidebar {...props} />);

      const row = screen.getByText('Second thread').closest('[role="listitem"]') as HTMLElement;
      await userEvent.click(within(row).getByRole('button', { name: 'Thread actions' }));
      await userEvent.click(screen.getByRole('menuitem', { name: 'Delete' }));

      expect(props.onDeleteThread).toHaveBeenCalledWith('thread-two');
    });

    it('renames the thread on Enter', async () => {
      const props = baseProps();
      renderWithProviders(<Sidebar {...props} />);

      const row = screen.getByText('Second thread').closest('[role="listitem"]') as HTMLElement;
      await userEvent.click(within(row).getByRole('button', { name: 'Thread actions' }));
      await userEvent.click(screen.getByRole('menuitem', { name: 'Rename' }));

      const input = screen.getByRole('textbox', { name: 'Thread title' });
      await userEvent.clear(input);
      await userEvent.type(input, 'Renamed{Enter}');

      expect(props.onRenameThread).toHaveBeenCalledWith('thread-two', 'Renamed');
    });
  });

  describe('when no project is active', () => {
    it('hides the threads section', () => {
      renderWithProviders(<Sidebar {...baseProps()} activeProjectId={null} />);

      expect(screen.queryByText('First thread')).not.toBeInTheDocument();
    });
  });
});

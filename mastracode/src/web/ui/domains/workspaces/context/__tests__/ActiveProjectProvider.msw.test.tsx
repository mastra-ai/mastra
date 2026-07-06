/**
 * BDD coverage for `ActiveProjectProvider` (`domains/workspaces/context`).
 *
 * The provider exposes the existing `useActiveProject()` hook through context
 * so project selection is consumed via `useActiveProjectContext()` instead of
 * being prop-drilled from the chat composition root.
 */
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';

import { renderWithProviders } from '../../../../../../../e2e/web-ui/render';
import type { Project } from '../../services/projects';
import { ActiveProjectProvider, useActiveProjectContext } from '../ActiveProjectProvider';

const PROJECT: Project = {
  id: 'project-test',
  name: 'MastraCode Test',
  path: '/tmp/mastracode-test',
  resourceId: 'resource-test',
  createdAt: 1,
};

afterEach(() => {
  localStorage.clear();
});

function seedProject(project: Project = PROJECT) {
  localStorage.setItem('mastracode-projects', JSON.stringify([project]));
  localStorage.setItem('mastracode-active-project', project.id);
}

function Probe() {
  const { projects, activeProject, activeProjectId, resourceId, sessionEnabled, selectProject } =
    useActiveProjectContext();
  return (
    <div>
      <span data-testid="project-count">{projects.length}</span>
      <span data-testid="active-project">{activeProject?.name ?? '(none)'}</span>
      <span data-testid="active-project-id">{activeProjectId ?? '(none)'}</span>
      <span data-testid="resource-id">{resourceId}</span>
      <span data-testid="session-enabled">{sessionEnabled ? 'yes' : 'no'}</span>
      <button onClick={() => void selectProject(null)}>clear selection</button>
    </div>
  );
}

function renderProbe() {
  return renderWithProviders(
    <ActiveProjectProvider>
      <Probe />
    </ActiveProjectProvider>,
  );
}

describe('ActiveProjectProvider', () => {
  it('given a seeded active project, then it exposes the projects and active selection', async () => {
    seedProject();
    renderProbe();

    await waitFor(() => expect(screen.getByTestId('active-project')).toHaveTextContent('MastraCode Test'));
    expect(screen.getByTestId('project-count')).toHaveTextContent('1');
    expect(screen.getByTestId('active-project-id')).toHaveTextContent('project-test');
    expect(screen.getByTestId('resource-id')).toHaveTextContent('resource-test');
    expect(screen.getByTestId('session-enabled')).toHaveTextContent('yes');
  });

  it('given an active project, when selectProject(null) is called, then the selection clears', async () => {
    seedProject();
    renderProbe();

    await waitFor(() => expect(screen.getByTestId('active-project')).toHaveTextContent('MastraCode Test'));
    await userEvent.click(screen.getByRole('button', { name: 'clear selection' }));

    expect(screen.getByTestId('active-project')).toHaveTextContent('(none)');
    expect(screen.getByTestId('active-project-id')).toHaveTextContent('(none)');
    expect(screen.getByTestId('session-enabled')).toHaveTextContent('no');
  });

  it('given no provider, when useActiveProjectContext is called, then it throws a descriptive error', () => {
    expect(() => render(<Probe />)).toThrow('useActiveProjectContext must be used within an ActiveProjectProvider');
  });
});

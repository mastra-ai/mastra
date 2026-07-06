/**
 * BDD coverage for the propless `ProjectSwitcher` (`domains/workspaces/components`).
 *
 * The switcher reads the active project from `useActiveProjectContext` and
 * drives the projects modal through `useOverlays` — no props. Opening the
 * projects overlay also closes the sidebar drawer (mobile behavior).
 */
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';

import { renderWithProviders } from '../../../../../../../e2e/web-ui/render';
import { OverlaysProvider, useOverlays } from '../../../../lib/overlays';
import { ActiveProjectProvider } from '../../context/ActiveProjectProvider';
import type { Project } from '../../services/projects';
import { ProjectSwitcher } from '../ProjectSwitcher';

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

function OverlayProbe() {
  const overlays = useOverlays();
  return (
    <div>
      <span data-testid="projects-open">{overlays.isOpen('projects') ? 'yes' : 'no'}</span>
      <span data-testid="sidebar-open">{overlays.isOpen('sidebar') ? 'yes' : 'no'}</span>
      <button onClick={() => overlays.open('sidebar')}>open sidebar</button>
    </div>
  );
}

function renderSwitcher() {
  return renderWithProviders(
    <ActiveProjectProvider>
      <OverlaysProvider>
        <ProjectSwitcher />
        <OverlayProbe />
      </OverlaysProvider>
    </ActiveProjectProvider>,
  );
}

describe('ProjectSwitcher', () => {
  it('given an active project, then its name and path render', async () => {
    seedProject();
    renderSwitcher();

    await waitFor(() => expect(screen.getByText('MastraCode Test')).toBeInTheDocument());
    expect(screen.getByText('/tmp/mastracode-test')).toBeInTheDocument();
  });

  it('given no selection, then the placeholder renders', () => {
    renderSwitcher();

    expect(screen.getByText('Select a project…')).toBeInTheDocument();
  });

  it('when the switcher is clicked, then the projects overlay opens and the sidebar closes', async () => {
    seedProject();
    renderSwitcher();

    await userEvent.click(screen.getByRole('button', { name: 'open sidebar' }));
    expect(screen.getByTestId('sidebar-open')).toHaveTextContent('yes');

    await waitFor(() => expect(screen.getByText('MastraCode Test')).toBeInTheDocument());
    await userEvent.click(screen.getByTitle('/tmp/mastracode-test'));

    expect(screen.getByTestId('projects-open')).toHaveTextContent('yes');
    expect(screen.getByTestId('sidebar-open')).toHaveTextContent('no');
  });

  it('when the manage-projects button is clicked, then the projects overlay opens and the sidebar closes', async () => {
    seedProject();
    renderSwitcher();

    await userEvent.click(screen.getByRole('button', { name: 'open sidebar' }));
    await userEvent.click(screen.getByRole('button', { name: 'Manage projects' }));

    expect(screen.getByTestId('projects-open')).toHaveTextContent('yes');
    expect(screen.getByTestId('sidebar-open')).toHaveTextContent('no');
  });
});

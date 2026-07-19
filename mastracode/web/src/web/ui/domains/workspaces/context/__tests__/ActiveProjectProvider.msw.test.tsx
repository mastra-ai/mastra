/**
 * BDD coverage for `ActiveProjectProvider` (`domains/workspaces/context`).
 *
 * The provider exposes the existing `useActiveProject()` hook through context
 * so project selection is consumed via `useActiveProjectContext()` instead of
 * being prop-drilled from the chat composition root. GitHub project selection
 * remains a browser-only state change; sandbox materialization starts later when
 * a worktree session is created.
 */
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { afterEach, describe, expect, it } from 'vitest';

import { server } from '../../../../../../../e2e/web-ui/msw-server';
import { TEST_BASE_URL, renderWithProviders } from '../../../../../../../e2e/web-ui/render';
import type { Project } from '../../services/projects';
import { ActiveProjectProvider, useActiveProjectContext } from '../ActiveProjectProvider';

const PROJECT: Project = {
  id: 'project-test',
  name: 'MastraCode Test',
  path: '/tmp/mastracode-test',
  resourceId: 'resource-test',
  createdAt: 1,
};

const GITHUB_PROJECT: Project = {
  id: 'project-gh',
  name: 'octo/hello',
  source: 'github',
  githubProjectId: 'ghp_1',
  createdAt: 2,
};

afterEach(() => {
  localStorage.clear();
});

function seedProject(project: Project = PROJECT, active = true) {
  localStorage.setItem('mastracode-projects', JSON.stringify([project]));
  if (active) localStorage.setItem('mastracode-active-project', project.id);
}

function Probe({ selectTarget }: { selectTarget?: Project }) {
  const api = useActiveProjectContext();
  const { projects, activeProject, resourceId, sessionEnabled, selectProject } = api;
  return (
    <div>
      <span data-testid="project-count">{projects.length}</span>
      <span data-testid="active-project">{activeProject?.name ?? '(none)'}</span>
      <span data-testid="active-project-id">{activeProject?.id ?? '(none)'}</span>
      <span data-testid="has-legacy-id-field">{'activeProjectId' in api ? 'yes' : 'no'}</span>
      <span data-testid="resource-id">{resourceId}</span>
      <span data-testid="session-enabled">{sessionEnabled ? 'yes' : 'no'}</span>
      <button onClick={() => void selectProject(null)}>clear selection</button>
      {selectTarget && <button onClick={() => void selectProject(selectTarget)}>select target</button>}
    </div>
  );
}

function renderProbe(selectTarget?: Project) {
  return renderWithProviders(
    <ActiveProjectProvider>
      <Probe selectTarget={selectTarget} />
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
    // `activeProject` is the canonical field; the redundant id field is gone.
    expect(screen.getByTestId('has-legacy-id-field')).toHaveTextContent('no');
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

  describe('GitHub projects', () => {
    it('given an unmaterialized GitHub project, when selected, then it activates without calling /ensure', async () => {
      let ensureCalls = 0;
      server.use(
        http.get(`${TEST_BASE_URL}/web/github/projects`, () => HttpResponse.json([GITHUB_PROJECT])),
        http.post(`${TEST_BASE_URL}/web/github/projects/ghp_1/ensure`, () => {
          ensureCalls += 1;
          return HttpResponse.error();
        }),
      );
      renderProbe(GITHUB_PROJECT);

      await waitFor(() => expect(screen.getByTestId('project-count')).toHaveTextContent('1'));
      await userEvent.click(screen.getByRole('button', { name: 'select target' }));

      expect(screen.getByTestId('active-project')).toHaveTextContent('octo/hello');
      expect(screen.getByTestId('resource-id')).toHaveTextContent('web-demo-user');
      expect(screen.getByTestId('session-enabled')).toHaveTextContent('no');
      expect(ensureCalls).toBe(0);
    });
  });
});

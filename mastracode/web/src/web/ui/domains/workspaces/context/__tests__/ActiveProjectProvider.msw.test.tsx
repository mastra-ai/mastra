/**
 * BDD coverage for `ActiveProjectProvider` (`domains/workspaces/context`).
 *
 * The provider exposes the existing `useActiveProject()` hook through context
 * so project selection is consumed via `useActiveProjectContext()` instead of
 * being prop-drilled from the chat composition root. GitHub projects are
 * materialized into their cloud sandbox on selection (the `/ensure` SSE
 * route); only the network is mocked (MSW).
 */
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { afterEach, describe, expect, it } from 'vitest';

import { server } from '../../../../../../../e2e/web-ui/msw-server';
import { TEST_BASE_URL, renderWithProviders } from '../../../../../../../e2e/web-ui/render';
import type { MaterializeResult } from '../../services/github';
import { loadProjects } from '../../services/projects';
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

const ENSURE_URL = `${TEST_BASE_URL}/web/github/projects/ghp_1/ensure`;

const materialized: MaterializeResult = {
  resourceId: 'resource-gh',
  githubProjectId: 'ghp_1',
  sandboxId: 'sbx_1',
  sandboxWorkdir: '/workspace/hello',
};

function sseFrame(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

function sseResponse(body: string) {
  return new HttpResponse(body, { headers: { 'content-type': 'text/event-stream' } });
}

afterEach(() => {
  localStorage.clear();
});

function seedProject(project: Project = PROJECT, active = true) {
  localStorage.setItem('mastracode-projects', JSON.stringify([project]));
  if (active) localStorage.setItem('mastracode-active-project', project.id);
}

function Probe({ selectTarget }: { selectTarget?: Project }) {
  const api = useActiveProjectContext();
  const { projects, activeProject, resourceId, sessionEnabled, selectProject, preparing, prepareError } = api;
  return (
    <div>
      <span data-testid="project-count">{projects.length}</span>
      <span data-testid="active-project">{activeProject?.name ?? '(none)'}</span>
      <span data-testid="active-project-id">{activeProject?.id ?? '(none)'}</span>
      <span data-testid="has-legacy-id-field">{'activeProjectId' in api ? 'yes' : 'no'}</span>
      <span data-testid="resource-id">{resourceId}</span>
      <span data-testid="session-enabled">{sessionEnabled ? 'yes' : 'no'}</span>
      <span data-testid="preparing">{preparing?.message ?? '(idle)'}</span>
      <span data-testid="prepare-error">{prepareError?.message ?? '(none)'}</span>
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
    it('given a GitHub project, when selected, then it is materialized via /ensure with live progress and activated with the server resourceId', async () => {
      seedProject(GITHUB_PROJECT, false);
      let release!: () => void;
      const gate = new Promise<void>(resolve => (release = resolve));
      server.use(
        http.post(ENSURE_URL, async () => {
          await gate;
          return sseResponse(
            sseFrame('progress', { phase: 'cloning', message: 'Cloning octo/hello…' }) + sseFrame('done', materialized),
          );
        }),
      );
      renderProbe(GITHUB_PROJECT);

      await waitFor(() => expect(screen.getByTestId('project-count')).toHaveTextContent('1'));
      await userEvent.click(screen.getByRole('button', { name: 'select target' }));

      // Preparation feedback is exposed while the server works.
      await waitFor(() => expect(screen.getByTestId('preparing')).not.toHaveTextContent('(idle)'));
      expect(screen.getByTestId('active-project')).toHaveTextContent('(none)');
      release();

      await waitFor(() => expect(screen.getByTestId('active-project')).toHaveTextContent('octo/hello'));
      expect(screen.getByTestId('resource-id')).toHaveTextContent('resource-gh');
      expect(screen.getByTestId('session-enabled')).toHaveTextContent('yes');
      expect(screen.getByTestId('preparing')).toHaveTextContent('(idle)');

      // The materialize result is persisted so a reload can reattach.
      const stored = loadProjects().find(p => p.id === 'project-gh');
      expect(stored).toMatchObject({
        resourceId: 'resource-gh',
        sandboxId: 'sbx_1',
        sandboxWorkdir: '/workspace/hello',
      });
      expect(stored?.worktrees).toEqual([{ branch: 'main', worktreePath: '/workspace/hello', baseBranch: 'main' }]);
    });

    it('given materialization fails, when a GitHub project is selected, then it is NOT activated and the error is exposed', async () => {
      seedProject(GITHUB_PROJECT, false);
      server.use(
        http.post(ENSURE_URL, () =>
          HttpResponse.json({ error: 'sandbox_not_configured', message: 'Sandbox is not configured' }, { status: 503 }),
        ),
      );
      renderProbe(GITHUB_PROJECT);

      await waitFor(() => expect(screen.getByTestId('project-count')).toHaveTextContent('1'));
      await userEvent.click(screen.getByRole('button', { name: 'select target' }));

      await waitFor(() => expect(screen.getByTestId('prepare-error')).toHaveTextContent('Sandbox is not configured'));
      expect(screen.getByTestId('active-project')).toHaveTextContent('(none)');
      expect(screen.getByTestId('session-enabled')).toHaveTextContent('no');
      expect(screen.getByTestId('preparing')).toHaveTextContent('(idle)');
      // Nothing was persisted onto the stored project.
      expect(loadProjects().find(p => p.id === 'project-gh')?.resourceId).toBeUndefined();
    });
  });
});

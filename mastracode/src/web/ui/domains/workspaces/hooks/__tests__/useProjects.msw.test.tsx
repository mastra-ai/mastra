import { act, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it } from 'vitest';

import { server } from '../../../../../../../e2e/web-ui/msw-server';
import { renderHookWithProviders, waitForMutationsIdle, TEST_BASE_URL } from '../../../../../../../e2e/web-ui/render';
import type { Project } from '../../services/projects';
import { loadActiveProjectId, loadProjects, saveActiveProjectId, saveProjects } from '../../services/projects';
import { useActiveProject } from '../useActiveProject';
import {
  useAddProjectMutation,
  useEnsureResourceIdMutation,
  useProjectsQuery,
  useRemoveProjectMutation,
} from '../useProjects';

const ORIGIN = TEST_BASE_URL;

const localProject: Project = {
  id: 'project-local',
  name: 'Mastra',
  path: '/repo/mastra',
  resourceId: 'resource-local',
  gitBranch: 'main',
  createdAt: 1,
};

const legacyProject: Project = {
  id: 'project-legacy',
  name: 'Legacy',
  path: '/repo/legacy',
  createdAt: 2,
};

beforeEach(() => {
  localStorage.clear();
});

describe('projects query hooks', () => {
  it('reads persisted projects through React Query', async () => {
    saveProjects([localProject]);

    const { result } = renderHookWithProviders(() => useProjectsQuery());

    await waitFor(() => expect(result.current.data).toHaveLength(1));
    expect(result.current.data[0]).toMatchObject({ id: 'project-local', name: 'Mastra' });
  });

  it('adds a project, persists it, and refreshes project query consumers', async () => {
    saveProjects([localProject]);
    server.use(
      http.get(`${ORIGIN}/api/web/project/resolve`, ({ request }) => {
        expect(new URL(request.url).searchParams.get('path')).toBe('/repo/new-app');
        return HttpResponse.json({
          resourceId: 'resource-new',
          name: 'New App',
          rootPath: '/repo/new-app',
          gitBranch: 'main',
        });
      }),
    );

    const { result, client } = renderHookWithProviders(() => {
      const projects = useProjectsQuery();
      const addProject = useAddProjectMutation();
      return { projects, addProject };
    });

    await waitFor(() => expect(result.current.projects.data).toHaveLength(1));

    await act(async () => {
      await result.current.addProject.mutateAsync({ name: 'New App', path: '/repo/new-app' });
    });
    await waitForMutationsIdle(client);

    expect(loadProjects().map(project => project.name)).toEqual(['Mastra', 'New App']);
    await waitFor(() =>
      expect(result.current.projects.data.map(project => project.name)).toEqual(['Mastra', 'New App']),
    );
  });

  it('removes the active project, clears active id, and refreshes project query consumers', async () => {
    saveProjects([localProject, { ...legacyProject, resourceId: 'resource-legacy' }]);
    saveActiveProjectId(localProject.id);

    const { result, client } = renderHookWithProviders(() => {
      const projects = useProjectsQuery();
      const removeProject = useRemoveProjectMutation();
      return { projects, removeProject };
    });

    await waitFor(() => expect(result.current.projects.data).toHaveLength(2));

    await act(async () => {
      result.current.removeProject.mutate(localProject.id);
    });
    await waitForMutationsIdle(client);

    expect(loadActiveProjectId()).toBeNull();
    expect(loadProjects().map(project => project.id)).toEqual(['project-legacy']);
    await waitFor(() => expect(result.current.projects.data.map(project => project.id)).toEqual(['project-legacy']));
  });

  it('backfills a missing resourceId and refreshes the projects query', async () => {
    saveProjects([legacyProject]);
    server.use(
      http.get(`${ORIGIN}/api/web/project/resolve`, () =>
        HttpResponse.json({
          resourceId: 'resource-legacy',
          name: 'Legacy',
          rootPath: '/repo/legacy',
          gitBranch: 'main',
        }),
      ),
    );

    const { result, client } = renderHookWithProviders(() => {
      const projects = useProjectsQuery();
      const ensureResourceId = useEnsureResourceIdMutation();
      return { projects, ensureResourceId };
    });

    await waitFor(() => expect(result.current.projects.data[0]?.resourceId).toBeUndefined());

    await act(async () => {
      await result.current.ensureResourceId.mutateAsync(legacyProject);
    });
    await waitForMutationsIdle(client);

    expect(loadProjects()[0]?.resourceId).toBe('resource-legacy');
    await waitFor(() => expect(result.current.projects.data[0]?.resourceId).toBe('resource-legacy'));
  });

  it('leaves the projects cache unchanged when resourceId resolution fails', async () => {
    saveProjects([legacyProject]);
    server.use(
      http.get(`${ORIGIN}/api/web/project/resolve`, () => HttpResponse.json({ error: 'nope' }, { status: 500 })),
    );

    const { result } = renderHookWithProviders(() => {
      const projects = useProjectsQuery();
      const ensureResourceId = useEnsureResourceIdMutation();
      return { projects, ensureResourceId };
    });

    await waitFor(() => expect(result.current.projects.data[0]?.resourceId).toBeUndefined());

    await act(async () => {
      await expect(result.current.ensureResourceId.mutateAsync(legacyProject)).rejects.toThrow(
        'Failed to resolve project (500)',
      );
    });

    await waitFor(() => expect(result.current.ensureResourceId.isError).toBe(true));
    expect(loadProjects()[0]?.resourceId).toBeUndefined();
    expect(result.current.projects.data[0]?.resourceId).toBeUndefined();
  });

  it('resolves the persisted active project and clears stale active ids', async () => {
    saveProjects([localProject]);
    saveActiveProjectId(localProject.id);

    const active = renderHookWithProviders(() => useActiveProject());

    await waitFor(() => expect(active.result.current.activeProject?.id).toBe(localProject.id));

    saveActiveProjectId('missing-project');
    const stale = renderHookWithProviders(() => useActiveProject());

    await waitFor(() => expect(stale.result.current.activeProject).toBeNull());
    await waitFor(() => expect(loadActiveProjectId()).toBeNull());
  });

  it('selects a legacy project after resolving its resource id through the project query cache', async () => {
    saveProjects([legacyProject]);
    server.use(
      http.get(`${ORIGIN}/api/web/project/resolve`, () =>
        HttpResponse.json({
          resourceId: 'resource-legacy',
          name: 'Legacy',
          rootPath: '/repo/legacy',
          gitBranch: 'main',
        }),
      ),
    );

    const { result, client } = renderHookWithProviders(() => useActiveProject());

    await waitFor(() => expect(result.current.projects[0]?.resourceId).toBeUndefined());

    await act(async () => {
      await result.current.selectProject(legacyProject);
    });
    await waitForMutationsIdle(client);

    await waitFor(() => expect(result.current.activeProject?.resourceId).toBe('resource-legacy'));
    expect(result.current.activeProjectId).toBe(legacyProject.id);
  });
});

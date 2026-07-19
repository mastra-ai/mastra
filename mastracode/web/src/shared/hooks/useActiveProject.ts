import { useEffect, useState } from 'react';
import {
  DEFAULT_RESOURCE_ID,
  loadActiveProjectId,
  saveActiveProjectId,
} from '../../web/ui/domains/workspaces/services/projects';
import type { Project } from '../../web/ui/domains/workspaces/services/projects';
import { useEnsureResourceIdMutation, useProjectsQuery } from './useProjects';

export function useActiveProject() {
  const projectsQuery = useProjectsQuery();
  const projects = projectsQuery.data;
  const projectsPending = projectsQuery.isFetching && !projectsQuery.isFetchedAfterMount;
  const ensureResourceId = useEnsureResourceIdMutation();
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(() => loadActiveProjectId());
  // Derived: a selection pointing at a deleted project counts as no selection.
  const activeProjectId =
    selectedProjectId && projects.some(p => p.id === selectedProjectId) ? selectedProjectId : null;
  const activeProject = projects.find(p => p.id === activeProjectId) ?? null;
  const resourceId = activeProject?.resourceId ?? DEFAULT_RESOURCE_ID;
  const sessionEnabled = !!activeProject?.resourceId;

  // Persisting to localStorage is external-system sync; keep as an effect.
  // Only clear a missing backend selection after a settled, successful project load.
  useEffect(() => {
    if (selectedProjectId && !activeProjectId && (!projectsQuery.isSuccess || projectsQuery.isFetching)) return;
    saveActiveProjectId(activeProjectId);
  }, [activeProjectId, projectsQuery.isFetching, projectsQuery.isSuccess, selectedProjectId]);

  const selectProject = async (project: Project | null) => {
    if (!project) {
      setSelectedProjectId(null);
      return;
    }

    if (project.source === 'github') {
      setSelectedProjectId(project.id);
      return;
    }

    if (!project.resourceId) {
      try {
        const filled = await ensureResourceId.mutateAsync(project);
        setSelectedProjectId(filled.id);
        return;
      } catch {
        // Resolution failed (path gone?); activate anyway with default scope.
      }
    }
    setSelectedProjectId(project.id);
  };

  return {
    projects,
    projectsPending,
    activeProject,
    resourceId,
    sessionEnabled,
    selectProject,
  };
}

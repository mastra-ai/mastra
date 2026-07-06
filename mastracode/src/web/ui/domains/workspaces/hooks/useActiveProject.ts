import { useEffect, useRef, useState } from 'react';

import { DEFAULT_RESOURCE_ID, loadActiveProjectId, saveActiveProjectId } from '../services/projects';
import type { Project } from '../services/projects';
import { useEnsureResourceIdMutation, useProjectsQuery } from './useProjects';

export function useActiveProject() {
  const { data: projects } = useProjectsQuery();
  const ensureResourceId = useEnsureResourceIdMutation();
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(() => loadActiveProjectId());
  // Derived: a selection pointing at a deleted project counts as no selection.
  const activeProjectId =
    selectedProjectId && projects.some(p => p.id === selectedProjectId) ? selectedProjectId : null;
  const activeProject = projects.find(p => p.id === activeProjectId) ?? null;
  const resourceId = activeProject?.resourceId ?? DEFAULT_RESOURCE_ID;
  const sessionEnabled = !!activeProject?.resourceId;

  // Persisting to localStorage is external-system sync; keep as an effect.
  useEffect(() => {
    saveActiveProjectId(activeProjectId);
  }, [activeProjectId]);

  const backfilledRef = useRef<string | null>(null);
  useEffect(() => {
    if (activeProject && !activeProject.resourceId && backfilledRef.current !== activeProject.id) {
      backfilledRef.current = activeProject.id;
      ensureResourceId.mutate(activeProject);
    }
  }, [activeProject, ensureResourceId]);

  const selectProject = async (project: Project | null) => {
    if (!project) {
      setSelectedProjectId(null);
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
    activeProject,
    activeProjectId,
    resourceId,
    sessionEnabled,
    selectProject,
  };
}

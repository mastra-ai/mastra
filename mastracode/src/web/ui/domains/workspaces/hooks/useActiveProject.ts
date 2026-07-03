import { useEffect, useRef, useState } from 'react';

import { DEFAULT_RESOURCE_ID, loadActiveProjectId, saveActiveProjectId } from '../services/projects';
import type { Project } from '../services/projects';
import { useEnsureResourceIdMutation, useProjectsQuery } from './useProjects';

export function useActiveProject() {
  const { data: projects } = useProjectsQuery();
  const ensureResourceId = useEnsureResourceIdMutation();
  const [activeProjectId, setActiveProjectId] = useState<string | null>(() => loadActiveProjectId());
  const activeProject = projects.find(p => p.id === activeProjectId) ?? null;
  const resourceId = activeProject?.resourceId ?? DEFAULT_RESOURCE_ID;
  const sessionEnabled = !!activeProject?.resourceId;

  useEffect(() => {
    if (activeProjectId && !projects.some(p => p.id === activeProjectId)) {
      setActiveProjectId(null);
    }
  }, [activeProjectId, projects]);

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
      setActiveProjectId(null);
      return;
    }

    if (!project.resourceId) {
      try {
        const filled = await ensureResourceId.mutateAsync(project);
        setActiveProjectId(filled.id);
        return;
      } catch {
        // Resolution failed (path gone?); activate anyway with default scope.
      }
    }
    setActiveProjectId(project.id);
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

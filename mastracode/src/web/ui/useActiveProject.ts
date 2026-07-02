import { useEffect, useRef, useState } from 'react';

import {
  DEFAULT_RESOURCE_ID,
  ensureResourceId,
  loadActiveProjectId,
  loadProjects,
  saveActiveProjectId,
} from './projects';
import type { Project } from './projects';

export function useActiveProject() {
  const [projects, setProjects] = useState<Project[]>(() => loadProjects());
  const [activeProjectId, setActiveProjectId] = useState<string | null>(() => {
    const saved = loadActiveProjectId();
    return saved && loadProjects().some(p => p.id === saved) ? saved : null;
  });
  const activeProject = projects.find(p => p.id === activeProjectId) ?? null;
  const resourceId = activeProject?.resourceId ?? DEFAULT_RESOURCE_ID;
  const sessionEnabled = !!activeProject?.resourceId;

  useEffect(() => {
    saveActiveProjectId(activeProjectId);
  }, [activeProjectId]);

  const backfilledRef = useRef<string | null>(null);
  useEffect(() => {
    if (activeProject && !activeProject.resourceId && backfilledRef.current !== activeProject.id) {
      backfilledRef.current = activeProject.id;
      void ensureResourceId(activeProject).then(() => setProjects(loadProjects()));
    }
  }, [activeProject]);

  const selectProject = async (project: Project | null) => {
    if (!project) {
      setActiveProjectId(null);
      return;
    }

    if (!project.resourceId) {
      try {
        const filled = await ensureResourceId(project);
        setProjects(loadProjects());
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
    setProjects,
    selectProject,
  };
}

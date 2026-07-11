import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';

import { queryKeys } from '../../../../../shared/api/keys';
import {
  applyMaterializeResult,
  DEFAULT_RESOURCE_ID,
  loadActiveProjectId,
  saveActiveProjectId,
} from '../services/projects';
import type { Project } from '../services/projects';
import { useEnsureRepoMaterializedMutation } from './useEnsureRepoMaterialized';
import { useEnsureResourceIdMutation, useProjectsQuery } from './useProjects';

/** Live sandbox-preparation feedback while a GitHub project is being opened. */
export interface PreparingState {
  projectId: string;
  message: string;
}

export function useActiveProject() {
  const queryClient = useQueryClient();
  const { data: projects } = useProjectsQuery();
  const ensureResourceId = useEnsureResourceIdMutation();
  const ensureMaterialized = useEnsureRepoMaterializedMutation();
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(() => loadActiveProjectId());
  const [preparing, setPreparing] = useState<PreparingState | null>(null);
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

  const selectProject = async (project: Project | null) => {
    if (!project) {
      setSelectedProjectId(null);
      return;
    }

    if (project.source === 'github') {
      await selectGithubProject(project);
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

  /**
   * Opening a GitHub project materializes it into its cloud sandbox first
   * (provision/reattach + clone/pull via the server's `/ensure` SSE route).
   * On failure the previous selection is kept — activating with the default
   * scope would silently bind the session to the wrong workspace.
   */
  const selectGithubProject = async (project: Project) => {
    if (!project.githubProjectId) return;
    // Guard rapid re-clicks: one materialization at a time.
    if (ensureMaterialized.isPending) return;

    setPreparing({ projectId: project.id, message: 'Preparing sandbox…' });
    try {
      const result = await ensureMaterialized.mutateAsync({
        githubProjectId: project.githubProjectId,
        onProgress: event => setPreparing({ projectId: project.id, message: event.message }),
      });
      applyMaterializeResult(project, result);
      // Refresh the projects query from localStorage so the selection sees the
      // persisted resourceId (otherwise the session would briefly be disabled).
      await queryClient.invalidateQueries({ queryKey: queryKeys.projects() });
      setSelectedProjectId(project.id);
    } catch {
      // The mutation retains the error (exposed as `prepareError`); selection
      // stays unchanged so the user can retry by re-selecting the project.
    } finally {
      setPreparing(null);
    }
  };

  return {
    projects,
    activeProject,
    resourceId,
    sessionEnabled,
    selectProject,
    /** Non-null while a GitHub project is being provisioned/cloned. */
    preparing,
    /** Last materialization failure (carries the server's `code`), if any. */
    prepareError: (ensureMaterialized.error as (Error & { code?: string }) | null) ?? null,
  };
}

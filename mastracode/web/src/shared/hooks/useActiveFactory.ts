import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';

import { queryKeys } from '../api/keys';
import {
  applyMaterializeResult,
  DEFAULT_RESOURCE_ID,
  isGithubFactory,
  loadActiveFactoryId,
  saveActiveFactoryId,
} from '../../web/ui/domains/workspaces/services/factories';
import type { Factory, GithubFactory } from '../../web/ui/domains/workspaces/services/factories';
import { useEnsureRepoMaterializedMutation } from './useEnsureRepoMaterialized';
import { useFactoriesQuery } from './useFactories';

/** Live sandbox-preparation feedback while a GitHub factory is being opened. */
export interface PreparingState {
  factoryId: string;
  message: string;
}

export function useActiveFactory() {
  const queryClient = useQueryClient();
  const { data: factories } = useFactoriesQuery();
  const ensureMaterialized = useEnsureRepoMaterializedMutation();
  const [selectedFactoryId, setSelectedFactoryId] = useState<string | null>(() => loadActiveFactoryId());
  const [preparing, setPreparing] = useState<PreparingState | null>(null);
  // Monotonic selection token so a newer local/null/GitHub selection supersedes
  // an in-flight materialization instead of re-activating the previous target.
  const selectionRequestRef = useRef(0);
  // Derived: a selection pointing at a deleted factory counts as no selection.
  const activeFactoryId =
    selectedFactoryId && factories.some(factory => factory.id === selectedFactoryId) ? selectedFactoryId : null;
  const activeFactory = factories.find(factory => factory.id === activeFactoryId) ?? null;
  const resourceId = activeFactory?.resourceId ?? DEFAULT_RESOURCE_ID;
  const sessionEnabled = !!activeFactory?.resourceId;

  // Persisting to localStorage is external-system sync; keep as an effect.
  useEffect(() => {
    saveActiveFactoryId(activeFactoryId);
  }, [activeFactoryId]);

  const selectFactory = async (factory: Factory | null) => {
    const requestId = ++selectionRequestRef.current;

    if (!factory) {
      setPreparing(null);
      setSelectedFactoryId(null);
      return;
    }

    if (isGithubFactory(factory)) {
      await selectGithubFactory(factory, requestId);
      return;
    }

    // Local factories always carry a required resourceId from creation.
    setPreparing(null);
    setSelectedFactoryId(factory.id);
  };

  /**
   * Opening a GitHub factory materializes it into its cloud sandbox first
   * (provision/reattach + clone/pull via the server's `/ensure` SSE route).
   * On failure the previous selection is kept — activating with the default
   * scope would silently bind the session to the wrong workspace.
   */
  const selectGithubFactory = async (factory: GithubFactory, requestId: number) => {
    setPreparing({ factoryId: factory.id, message: 'Preparing sandbox…' });
    try {
      const result = await ensureMaterialized.mutateAsync({
        githubProjectId: factory.binding.githubProjectId,
        onProgress: event => {
          if (selectionRequestRef.current !== requestId) return;
          setPreparing({ factoryId: factory.id, message: event.message });
        },
      });
      // A newer selection won while materialization was still running — discard
      // this result so it cannot stomp the user's latest choice.
      if (selectionRequestRef.current !== requestId) return;
      applyMaterializeResult(factory, result);
      // Refresh the factories query from localStorage so the selection sees the
      // persisted resourceId (otherwise the session would briefly be disabled).
      await queryClient.invalidateQueries({ queryKey: queryKeys.factories() });
      if (selectionRequestRef.current !== requestId) return;
      setSelectedFactoryId(factory.id);
    } catch {
      // The mutation retains the error (exposed as `prepareError`); selection
      // stays unchanged so the user can retry by re-selecting the factory.
    } finally {
      if (selectionRequestRef.current === requestId) {
        setPreparing(null);
      }
    }
  };

  return {
    factories,
    activeFactory,
    resourceId,
    sessionEnabled,
    selectFactory,
    /** Non-null while a GitHub factory is being provisioned/cloned. */
    preparing,
    /** Last materialization failure (carries the server's `code`), if any. */
    prepareError: (ensureMaterialized.error as (Error & { code?: string }) | null) ?? null,
  };
}

import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';

import { queryKeys } from '../api/keys';
import {
  applyMaterializeResult,
  DEFAULT_RESOURCE_ID,
  isServerFactory,
  loadActiveFactoryId,
  saveActiveFactoryId,
  selectedRepository,
} from '../../web/ui/domains/workspaces/services/factories';
import type { Factory, FactoryRepository, ServerFactory } from '../../web/ui/domains/workspaces/services/factories';
import { useEnsureRepoMaterializedMutation } from './useEnsureRepoMaterialized';
import { useFactoriesQuery } from './useFactories';

/** Live sandbox-preparation feedback while a factory repository is being opened. */
export interface PreparingState {
  factoryId: string;
  message: string;
}

export function useActiveFactory() {
  const queryClient = useQueryClient();
  const {
    data: factories,
    isPending: factoriesPending,
    isFetching: factoriesFetching,
    isError: factoriesError,
  } = useFactoriesQuery();
  const factoryList = factories ?? [];
  const ensureMaterialized = useEnsureRepoMaterializedMutation();
  const [selectedFactoryId, setSelectedFactoryId] = useState<string | null>(() => loadActiveFactoryId());
  const [preparing, setPreparing] = useState<PreparingState | null>(null);
  // Monotonic selection token so a newer selection supersedes an in-flight
  // materialization instead of re-activating the previous target.
  const selectionRequestRef = useRef(0);
  // Derived: a selection pointing at a deleted factory counts as no selection.
  const activeFactoryId =
    selectedFactoryId && factoryList.some(factory => factory.id === selectedFactoryId) ? selectedFactoryId : null;
  const activeFactory = factoryList.find(factory => factory.id === activeFactoryId) ?? null;
  // Server-backed factories without a materialized repository chat against the
  // factory project itself; local factories always carry a resolved resourceId.
  const resourceId =
    activeFactory?.resourceId ??
    (activeFactory && isServerFactory(activeFactory) ? activeFactory.binding.factoryProjectId : undefined) ??
    DEFAULT_RESOURCE_ID;
  const sessionEnabled = !!activeFactory;

  // Persisting to localStorage is external-system sync; keep as an effect.
  // A failed backend hydration must not erase a selection that may become valid
  // again once the factory list can be loaded.
  useEffect(() => {
    if (!factoriesFetching && !factoriesError) saveActiveFactoryId(activeFactoryId);
  }, [activeFactoryId, factoriesError, factoriesFetching]);

  const selectFactory = async (factory: Factory | null) => {
    const requestId = ++selectionRequestRef.current;

    if (!factory) {
      setPreparing(null);
      setSelectedFactoryId(null);
      return;
    }

    if (isServerFactory(factory)) {
      const repository = selectedRepository(factory);
      if (!repository) {
        // No linked repositories yet — a valid state. The Board renders with a
        // connect prompt and chat scopes to the factory project resource.
        setPreparing(null);
        setSelectedFactoryId(factory.id);
        return;
      }
      await prepareRepository(factory, repository, requestId);
      return;
    }

    // Local factories always carry a required resourceId from creation.
    setPreparing(null);
    setSelectedFactoryId(factory.id);
  };

  /**
   * Opening a server factory materializes its selected repository into its
   * cloud sandbox first (provision/reattach + clone/pull via the server's
   * `/ensure` SSE route). On failure the previous selection is kept —
   * activating with the default scope would silently bind the session to the
   * wrong workspace.
   */
  const prepareRepository = async (factory: ServerFactory, repository: FactoryRepository, requestId: number) => {
    setPreparing({ factoryId: factory.id, message: 'Preparing sandbox…' });
    try {
      const result = await ensureMaterialized.mutateAsync({
        projectRepositoryId: repository.projectRepositoryId,
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
    factories: factoryList,
    factoriesPending,
    activeFactory,
    resourceId,
    sessionEnabled,
    selectFactory,
    /** Non-null while a factory repository is being provisioned/cloned. */
    preparing,
    /** Last materialization failure (carries the server's `code`), if any. */
    prepareError: (ensureMaterialized.error as (Error & { code?: string }) | null) ?? null,
  };
}

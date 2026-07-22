import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';

import { queryKeys } from '../api/keys';
import {
  applyMaterializeResult,
  DEFAULT_RESOURCE_ID,
  isServerFactory,
  selectedRepository,
} from '../../web/ui/domains/workspaces/services/factories';
import { useEnsureRepoMaterializedMutation } from './useEnsureRepoMaterialized';
import { useFactoriesQuery } from './useFactories';

/** Live sandbox-preparation feedback while a factory repository is being opened. */
export interface PreparingState {
  factoryId: string;
  message: string;
}

/**
 * Resolves the route's `factoryId` against the factories list and drives
 * mount-driven sandbox materialization for server factories. The URL is the
 * single source of truth for which factory is active; this hook only prepares
 * it and gates the chat session until the workspace is safe to bind.
 */
export function useActiveFactory(factoryId: string) {
  const queryClient = useQueryClient();
  const { data: factories, isPending: factoriesPending } = useFactoriesQuery();
  const factoryList = factories ?? [];
  const ensureMaterialized = useEnsureRepoMaterializedMutation();
  const [preparing, setPreparing] = useState<PreparingState | null>(null);
  // Set once `/ensure` succeeds for the given factoryId; cleared implicitly by
  // navigating to a different factory.
  const [materializedFor, setMaterializedFor] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  // Monotonic token so navigating to another factory supersedes an in-flight
  // materialization instead of letting its result stomp the newer route.
  const requestRef = useRef(0);
  // Which `${factoryId}:${attempt}` run has already been started, so factories
  // refetches don't re-trigger the ensure.
  const startedKeyRef = useRef<string | null>(null);

  const activeFactory = factoryList.find(factory => factory.id === factoryId) ?? null;
  // Server-backed factories without a materialized repository chat against the
  // factory project itself; local factories always carry a resolved resourceId.
  const resourceId =
    activeFactory?.resourceId ??
    (activeFactory && isServerFactory(activeFactory) ? activeFactory.binding.factoryProjectId : undefined) ??
    DEFAULT_RESOURCE_ID;
  const repository = activeFactory && isServerFactory(activeFactory) ? selectedRepository(activeFactory) : undefined;
  // Never bind the session to the wrong workspace: while a server factory's
  // repository is being materialized (or failed to), the session stays off.
  const sessionEnabled = !!activeFactory && (!repository || materializedFor === factoryId);

  /**
   * Opening a server factory materializes its selected repository into its
   * cloud sandbox (provision/reattach + clone/pull via the server's `/ensure`
   * SSE route) when the route mounts or the factoryId changes. Switching and
   * deep-linking share this single code path.
   */
  useEffect(() => {
    if (!activeFactory || !isServerFactory(activeFactory)) return;
    const repo = selectedRepository(activeFactory);
    if (!repo) return;
    if (materializedFor === factoryId) return;
    const key = `${factoryId}:${attempt}`;
    if (startedKeyRef.current === key) return;
    startedKeyRef.current = key;
    const requestId = ++requestRef.current;
    setPreparing({ factoryId, message: 'Preparing sandbox…' });
    void (async () => {
      try {
        const result = await ensureMaterialized.mutateAsync({
          projectRepositoryId: repo.projectRepositoryId,
          onProgress: event => {
            if (requestRef.current !== requestId) return;
            setPreparing({ factoryId, message: event.message });
          },
        });
        // The route moved to another factory while materialization was still
        // running — discard this result.
        if (requestRef.current !== requestId) return;
        applyMaterializeResult(activeFactory, result);
        // Refresh the factories query from localStorage so consumers see the
        // persisted resourceId before the session is enabled.
        await queryClient.invalidateQueries({ queryKey: queryKeys.factories() });
        if (requestRef.current !== requestId) return;
        setMaterializedFor(factoryId);
      } catch {
        // The mutation retains the error (exposed as `prepareError`); the
        // session stays disabled until `retryPrepare()` succeeds.
      } finally {
        if (requestRef.current === requestId) {
          setPreparing(null);
        }
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeFactory, factoryId, attempt, materializedFor]);

  /** Re-runs the sandbox materialization after a failure. */
  const retryPrepare = () => {
    setAttempt(current => current + 1);
  };

  return {
    factories: factoryList,
    factoriesPending,
    activeFactory,
    resourceId,
    sessionEnabled,
    /** Non-null while a factory repository is being provisioned/cloned. */
    preparing,
    /** Last materialization failure (carries the server's `code`), if any. */
    prepareError: (ensureMaterialized.error as (Error & { code?: string }) | null) ?? null,
    retryPrepare,
  };
}

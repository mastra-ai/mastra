import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router';

import { queryKeys } from '../api/keys';
import {
  applyMaterializeResult,
  DEFAULT_RESOURCE_ID,
  isServerFactory,
  selectedRepository,
} from '../../web/ui/domains/workspaces/services/factories';
import type { Factory } from '../../web/ui/domains/workspaces/services/factories';
import { useEnsureRepoMaterializedMutation } from './useEnsureRepoMaterialized';
import { useFactoriesQuery } from './useFactories';

/** Live sandbox-preparation feedback while a factory repository is being opened. */
export interface PreparingState {
  factoryId: string;
  message: string;
}

/**
 * Sub-pages that make sense for any factory; preserved when switching the
 * active factory. Thread routes are scope-specific, so switching falls back
 * to the draft composer.
 */
const PRESERVED_SUBPAGES = new Set(['overview', 'work', 'review', 'metrics', 'audit', 'new']);

function switchSuffix(pathname: string): string {
  const match = /^\/factories\/[^/]+\/([^/]+)$/.exec(pathname);
  if (match && PRESERVED_SUBPAGES.has(match[1])) return `/${match[1]}`;
  return '/new';
}

/**
 * The active factory is resolved from the `/factories/:factoryId` URL param —
 * the URL is the single source of truth (nothing is persisted in storage).
 * "Selecting" a factory navigates to its URL; repository materialization for
 * server-backed factories runs as an effect reacting to the param, so deep
 * links and reloads prepare the sandbox too.
 */
export function useActiveFactory() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { factoryId } = useParams<{ factoryId: string }>();
  const { data: factories, isPending: factoriesPending } = useFactoriesQuery();
  const factoryList = factories ?? [];
  const ensureMaterialized = useEnsureRepoMaterializedMutation();
  const [preparing, setPreparing] = useState<PreparingState | null>(null);
  // Monotonic request token so a newer activation supersedes an in-flight
  // materialization instead of letting a stale result stomp the current one.
  const requestRef = useRef(0);
  // Which factory/repository pair the effect already started preparing —
  // prevents re-materializing on unrelated re-renders (and StrictMode
  // double-invocation) while the URL still points at the same factory.
  const preparedRef = useRef<string | null>(null);

  const activeFactory = factoryList.find(factory => factory.id === factoryId) ?? null;
  // Server-backed factories without a materialized repository chat against the
  // factory project itself; local factories always carry a resolved resourceId.
  const resourceId =
    activeFactory?.resourceId ??
    (activeFactory && isServerFactory(activeFactory) ? activeFactory.binding.factoryProjectId : undefined) ??
    DEFAULT_RESOURCE_ID;
  const sessionEnabled = !!activeFactory;

  const activeFactoryId = activeFactory?.id ?? null;
  const activeRepositoryId = activeFactory ? (selectedRepository(activeFactory)?.projectRepositoryId ?? null) : null;

  /**
   * Opening a server factory materializes its selected repository into its
   * cloud sandbox (provision/reattach + clone/pull via the server's `/ensure`
   * SSE route). On failure the URL stays put and the page surfaces
   * `prepareError`; navigating away and back retries.
   */
  useEffect(() => {
    if (!activeFactoryId || !activeRepositoryId) return;
    const prepareKey = `${activeFactoryId}:${activeRepositoryId}`;
    if (preparedRef.current === prepareKey) return;
    preparedRef.current = prepareKey;
    const requestId = ++requestRef.current;

    const prepare = async () => {
      setPreparing({ factoryId: activeFactoryId, message: 'Preparing sandbox…' });
      try {
        const result = await ensureMaterialized.mutateAsync({
          projectRepositoryId: activeRepositoryId,
          onProgress: event => {
            if (requestRef.current !== requestId) return;
            setPreparing({ factoryId: activeFactoryId, message: event.message });
          },
        });
        // A newer activation won while materialization was still running —
        // discard this result so it cannot stomp the latest target.
        if (requestRef.current !== requestId) return;
        const factory = loadCurrentFactory();
        if (factory) applyMaterializeResult(factory, result);
        // Refresh the factories query from localStorage so consumers see the
        // persisted resourceId (otherwise the session would briefly be disabled).
        await queryClient.invalidateQueries({ queryKey: queryKeys.factories() });
      } catch {
        // The mutation retains the error (exposed as `prepareError`). Clear the
        // prepared marker so re-activating this factory retries.
        if (preparedRef.current === prepareKey) preparedRef.current = null;
      } finally {
        if (requestRef.current === requestId) setPreparing(null);
      }
    };

    const loadCurrentFactory = () => {
      const current = (queryClient.getQueryData<Factory[]>(queryKeys.factories()) ?? factoryList).find(
        factory => factory.id === activeFactoryId,
      );
      return current && isServerFactory(current) ? current : undefined;
    };

    void prepare();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeFactoryId, activeRepositoryId]);

  /**
   * Navigate to the factory's URL (the sub-page is preserved when it applies
   * to any factory, otherwise the draft composer). `null` leaves the factory
   * scope entirely.
   */
  const selectFactory = (factory: Factory | null) => {
    if (!factory) {
      navigate('/');
      return;
    }
    navigate(`/factories/${factory.id}${switchSuffix(pathname)}`);
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

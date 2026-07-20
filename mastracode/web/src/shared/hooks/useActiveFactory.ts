import { useEffect, useState } from 'react';

import {
  DEFAULT_RESOURCE_ID,
  loadActiveFactoryId,
  saveActiveFactoryId,
} from '../../web/ui/domains/workspaces/services/factories';
import type { Factory } from '../../web/ui/domains/workspaces/services/factories';
import { useFactoriesQuery } from './useFactories';

export function useActiveFactory() {
  const factoriesQuery = useFactoriesQuery();
  const { data: factories } = factoriesQuery;
  const [selectedFactoryId, setSelectedFactoryId] = useState<string | null>(() => loadActiveFactoryId());
  // Derived: a selection pointing at a deleted factory counts as no selection.
  const activeFactoryId =
    selectedFactoryId && factories.some(factory => factory.id === selectedFactoryId) ? selectedFactoryId : null;
  const activeFactory = factories.find(factory => factory.id === activeFactoryId) ?? null;
  const resourceId = activeFactory?.resourceId ?? DEFAULT_RESOURCE_ID;
  const sessionEnabled = !!activeFactory?.resourceId;

  // Do not clear a persisted backend selection while hydration is still in
  // flight or failed. Only a successful backend result can prove it is stale.
  useEffect(() => {
    if (activeFactoryId) {
      saveActiveFactoryId(activeFactoryId);
      return;
    }
    if (!factoriesQuery.isFetching && !factoriesQuery.isError) {
      saveActiveFactoryId(null);
    }
  }, [activeFactoryId, factoriesQuery.isError, factoriesQuery.isFetching]);

  const selectFactory = async (factory: Factory | null) => {
    // Selecting a source-control factory only binds its persisted project row.
    // Sandbox provisioning, clone/pull, and worktree creation stay deferred to
    // the worktree/session-start route.
    setSelectedFactoryId(factory?.id ?? null);
  };

  return {
    factories,
    factoriesPending: factoriesQuery.isFetching,
    activeFactory,
    resourceId,
    sessionEnabled,
    selectFactory,
  };
}

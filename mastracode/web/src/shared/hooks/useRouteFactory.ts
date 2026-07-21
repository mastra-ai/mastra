import { useParams } from 'react-router';

import {
  DEFAULT_RESOURCE_ID,
  isServerFactory,
} from '../../web/ui/domains/workspaces/services/factories';
import { useFactoriesQuery } from './useFactories';

/** Resolves the current Factory exclusively from the route's `:projectId`. */
export function useRouteFactory() {
  const { projectId } = useParams();
  const factoriesQuery = useFactoriesQuery();
  const activeFactory = factoriesQuery.data.find(factory => factory.id === projectId) ?? null;
  const resourceId =
    activeFactory?.resourceId ??
    (activeFactory && isServerFactory(activeFactory) ? activeFactory.binding.factoryProjectId : undefined) ??
    DEFAULT_RESOURCE_ID;

  return {
    factories: factoriesQuery.data,
    factoriesPending: factoriesQuery.isFetching,
    activeFactory,
    resourceId,
    sessionEnabled: activeFactory !== null,
  };
}

import { useParams } from 'react-router';

import type { AvailableModelsTarget } from '../../../../hooks/useAvailableModels';
import { useFactoryProjectQuery } from '../../../../hooks/useFactoryDefaultModel';
import { useSessionModelCatalogQuery } from '../../../../hooks/useSessionModelCatalog';
import { useChatSessionContext } from './useChatSessionContext';

/** Live threads use the same server-resolved owner and billing policy as model invocations. */
export function useChatModelScope() {
  const { factoryId: routeFactoryId } = useParams<{ factoryId: string }>();
  const { kind, factorySessionState, draftSessionId, resourceId, sessionThreadId, resourceReady } =
    useChatSessionContext();
  const factoryId = factorySessionState?.factoryProjectId ?? routeFactoryId;
  const projectQuery = useFactoryProjectQuery(factoryId);
  const sessionTarget = draftSessionId
    ? undefined
    : {
        factoryProjectId: factoryId,
        resourceId,
        threadId: sessionThreadId ?? resourceId,
        enabled: resourceReady,
      };
  const sessionModelsQuery = useSessionModelCatalogQuery(sessionTarget);
  const storedScope = projectQuery.data?.modelScope;
  const draftScope = storedScope === 'hybrid' ? kind : storedScope;
  const modelScope = sessionTarget
    ? (sessionModelsQuery.data?.modelScope ?? (sessionModelsQuery.isSuccess ? draftScope : undefined))
    : draftScope;
  const scopeLoading = sessionTarget ? !sessionModelsQuery.isSuccess : Boolean(factoryId && !projectQuery.isSuccess);
  const draftCatalogTarget: AvailableModelsTarget = {
    ...(draftScope === 'user' ? { scope: 'user' } : { factoryProjectId: factoryId }),
    enabled: !scopeLoading,
  };
  const catalogTarget: AvailableModelsTarget = sessionTarget ?? draftCatalogTarget;

  return { factoryId, projectQuery, modelScope, catalogTarget, scopeLoading, sessionModelsQuery };
}

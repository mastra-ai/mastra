import { useContext } from 'react';
import { useParams } from 'react-router';

import type { AvailableModelsTarget } from '../../../../hooks/useAvailableModels';
import { useFactoryProjectQuery } from '../../../../hooks/useFactoryDefaultModel';
import { useSessionModelCatalogQuery } from '../../../../hooks/useSessionModelCatalog';
import { ChatThreadMessagesContext } from './ChatThreadMessagesContext';
import { useChatSessionContext } from './useChatSessionContext';

/** Live threads use the same server-resolved owner and billing policy as model invocations. */
export function useChatModelScope() {
  const { factoryId: routeFactoryId } = useParams<{ factoryId: string }>();
  const { kind, factorySessionState, draftSessionId, sessionId, resourceId, sessionThreadId, resourceReady } =
    useChatSessionContext();
  // The displayed thread decides billing; the session-primary thread is only a fallback.
  const displayedThreadId = useContext(ChatThreadMessagesContext)?.threadId;
  const factoryId = factorySessionState?.factoryProjectId ?? routeFactoryId;
  const projectQuery = useFactoryProjectQuery(factoryId);
  const sessionTarget = draftSessionId
    ? undefined
    : {
        factoryProjectId: factoryId,
        sessionId,
        resourceId,
        threadId: displayedThreadId ?? sessionThreadId ?? sessionId,
        enabled: resourceReady,
      };
  const sessionModelsQuery = useSessionModelCatalogQuery(sessionTarget);
  const storedScope = projectQuery.data?.modelScope;
  const draftScope = storedScope === 'hybrid' ? kind : storedScope;
  const modelScope = sessionTarget
    ? (sessionModelsQuery.data?.modelScope ?? (sessionModelsQuery.isSuccess ? draftScope : undefined))
    : draftScope;
  const scopeLoading = sessionTarget ? sessionModelsQuery.isPending : Boolean(factoryId && !projectQuery.isSuccess);
  const draftCatalogTarget: AvailableModelsTarget = {
    ...(draftScope === 'user' ? { scope: 'user' } : { factoryProjectId: factoryId }),
    enabled: !scopeLoading,
  };
  const catalogTarget: AvailableModelsTarget = sessionTarget ?? draftCatalogTarget;

  return { factoryId, projectQuery, modelScope, catalogTarget, scopeLoading, sessionModelsQuery };
}

import { useContext } from 'react';
import { useSessionHost } from './SessionHostContext';

import type { AvailableModelsTarget } from '@mastra/react/hooks/factory';
import { useSessionModelCatalogQuery } from '@mastra/react/hooks/factory';
import { newChatCatalogTarget } from './chatDefaultModel';
import { ChatThreadMessagesContext } from './ChatThreadMessagesContext';
import { useChatSessionContext } from './useChatSessionContext';

/** Live threads use the same server-resolved owner and billing policy as model invocations. */
export function useChatModelScope() {
  const { factoryProjectId: routeFactoryId } = useSessionHost();
  const { kind, factorySessionState, draftSessionId, sessionId, resourceId, sessionThreadId, resourceReady } =
    useChatSessionContext();
  // The displayed thread decides billing; the session-primary thread is only a fallback.
  const displayedThreadId = useContext(ChatThreadMessagesContext)?.threadId;
  const factoryId = factorySessionState?.factoryProjectId ?? routeFactoryId;
  const projectQuery = useSessionHost().data.useProjectSettings(factoryId);
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
    ...newChatCatalogTarget(draftScope, factoryId),
    enabled: !scopeLoading,
  };
  const catalogTarget: AvailableModelsTarget = sessionTarget ?? draftCatalogTarget;

  return { factoryId, projectQuery, modelScope, catalogTarget, scopeLoading, sessionModelsQuery };
}

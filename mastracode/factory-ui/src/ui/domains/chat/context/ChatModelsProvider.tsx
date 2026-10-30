import { useQueryClient } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { useState } from 'react';

import { useApiConfig } from '../../../../api/config';
import { defaultModelQueryOptions, useDefaultModelQuery } from '../../../../hooks/use-default-model';
import { availableModelsQueryOptions, useFallbackModelQuery } from '../../../../hooks/useAvailableModels';
import { factoryProjectQueryOptions } from '../../../../hooks/useFactoryDefaultModel';
import { useChatModelScope } from './useChatModelScope';
import { useSwitchAgentControllerModelMutation } from '../../../../hooks/useAgentControllerStateMutations';
import { AGENT_CONTROLLER_ID } from '../services/constants';
import { draftModelScope, newChatCatalogTarget, routedDefaultModelId } from './chatDefaultModel';
import { ChatModelsContext } from './ChatModelsContext';
import type { ChatModelsApi } from './ChatModelsContext';
import { useChatConnection } from './useChatConnection';
import { useChatSessionContext } from './useChatSessionContext';

interface ChatModelsProviderProps {
  children: ReactNode;
}

export function ChatModelsProvider({
  children,
  initialDraftModelId,
}: ChatModelsProviderProps & { initialDraftModelId?: string }) {
  const { draftSessionId } = useChatSessionContext();
  return draftSessionId ? (
    <DraftChatModelsProvider initialModelId={initialDraftModelId}>{children}</DraftChatModelsProvider>
  ) : (
    <LiveChatModelsProvider>{children}</LiveChatModelsProvider>
  );
}

function DraftChatModelsProvider({ children, initialModelId }: ChatModelsProviderProps & { initialModelId?: string }) {
  const { factoryId, projectQuery: factoryProjectQuery, modelScope, catalogTarget } = useChatModelScope();
  const { kind } = useChatSessionContext();
  const { baseUrl, client } = useApiConfig();
  const queryClient = useQueryClient();
  const defaultModelQuery = useDefaultModelQuery();
  const fallbackModelQuery = useFallbackModelQuery(catalogTarget);
  const [draftModelId, setDraftModelId] = useState(initialModelId);
  const defaultModelId = routedDefaultModelId(modelScope, {
    factory: factoryProjectQuery.data?.defaultModelId,
    personal: defaultModelQuery.data?.modelId,
  });
  const personalDefaultUsed = modelScope !== 'factory';
  const usesFallback = !defaultModelId;
  const value: ChatModelsApi = {
    activeModelId: draftModelId ?? defaultModelId ?? fallbackModelQuery.data,
    defaultModelId,
    pendingModelId: undefined,
    isLoading:
      factoryProjectQuery.isPending ||
      (personalDefaultUsed && defaultModelQuery.isPending) ||
      (usesFallback && fallbackModelQuery.isPending),
    error:
      factoryProjectQuery.error ??
      (personalDefaultUsed ? defaultModelQuery.error : null) ??
      (usesFallback ? fallbackModelQuery.error : null) ??
      undefined,
    setModel: modelId => {
      setDraftModelId(modelId);
      return Promise.resolve();
    },
    // The same rules as above, but awaiting each query instead of reading its
    // current state, so a send made while they load waits rather than drops.
    resolveDraftModels: async () => {
      const project = factoryId
        ? await queryClient.ensureQueryData(factoryProjectQueryOptions(baseUrl, factoryId))
        : undefined;
      const scope = draftModelScope(project?.modelScope, kind);
      const personal =
        scope === 'factory' ? undefined : (await queryClient.ensureQueryData(defaultModelQueryOptions(client))).modelId;
      const resolvedDefault = routedDefaultModelId(scope, { factory: project?.defaultModelId, personal });
      if (draftModelId || resolvedDefault) {
        return { activeModelId: draftModelId ?? resolvedDefault, defaultModelId: resolvedDefault };
      }
      const catalog = await queryClient.ensureQueryData(
        availableModelsQueryOptions(baseUrl, newChatCatalogTarget(scope, factoryId)),
      );
      return { activeModelId: catalog.fallbackModelId ?? undefined, defaultModelId: undefined };
    },
  };

  return <ChatModelsContext.Provider value={value}>{children}</ChatModelsContext.Provider>;
}

function LiveChatModelsProvider({ children }: ChatModelsProviderProps) {
  const { sessionId, baseUrl, sessionEnabled } = useChatSessionContext();
  const { state } = useChatConnection();
  const { projectQuery, modelScope, sessionModelsQuery } = useChatModelScope();
  const defaultModelQuery = useDefaultModelQuery();
  const localDefaultModelId = routedDefaultModelId(modelScope, {
    factory: projectQuery.data?.defaultModelId,
    personal: defaultModelQuery.data?.modelId,
  });
  const defaultModelId = sessionModelsQuery.isSuccess
    ? (('defaultModelId' in sessionModelsQuery.data ? sessionModelsQuery.data.defaultModelId : localDefaultModelId) ??
      undefined)
    : undefined;
  const {
    mutateAsync: switchModel,
    isPending: switching,
    variables: switchingTo,
  } = useSwitchAgentControllerModelMutation({
    agentControllerId: AGENT_CONTROLLER_ID,
    sessionId,
    baseUrl,
    enabled: sessionEnabled,
  });
  const value: ChatModelsApi = {
    activeModelId: state?.modelId,
    defaultModelId,
    pendingModelId: switching ? switchingTo?.modelId : undefined,
    isLoading: sessionModelsQuery.isPending,
    error: sessionModelsQuery.error ?? undefined,
    setModel: modelId => switchModel({ modelId }),
  };

  return <ChatModelsContext.Provider value={value}>{children}</ChatModelsContext.Provider>;
}

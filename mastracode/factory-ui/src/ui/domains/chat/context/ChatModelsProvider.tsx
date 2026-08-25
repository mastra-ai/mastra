import type { ReactNode } from 'react';
import { useState } from 'react';

import { useFactoryProjectQuery } from '../../../../hooks/useFactoryDefaultModel';
import { useActivateModelPack, useModelPacksQuery } from '../../../../hooks/use-model-packs';
import { useSwitchAgentControllerModelMutation } from '../../../../hooks/useAgentControllerStateMutations';
import { AGENT_CONTROLLER_ID } from '../services/constants';
import { ChatModelsContext } from './ChatModelsContext';
import type { ChatModelsApi } from './ChatModelsContext';
import { useChatConnection } from './useChatConnection';
import { useChatModes } from './useChatModes';
import { useChatSessionContext } from './useChatSessionContext';

interface ChatModelsProviderProps {
  children: ReactNode;
}

export function ChatModelsProvider({ children }: ChatModelsProviderProps) {
  const { draftSessionId } = useChatSessionContext();
  return draftSessionId ? (
    <DraftChatModelsProvider>{children}</DraftChatModelsProvider>
  ) : (
    <LiveChatModelsProvider>{children}</LiveChatModelsProvider>
  );
}

function DraftChatModelsProvider({ children }: ChatModelsProviderProps) {
  const { factorySessionState } = useChatSessionContext();
  const { activeModeId } = useChatModes();
  const factoryProjectQuery = useFactoryProjectQuery(factorySessionState?.factoryProjectId);
  const modelPacksQuery = useModelPacksQuery();
  const [draftModelId, setDraftModelId] = useState<string>();
  const [draftModelPackId, setDraftModelPackId] = useState<string>();
  const activeModelPackId = draftModelPackId ?? modelPacksQuery.data?.activePackId ?? undefined;
  const activePack = modelPacksQuery.data?.packs.find(pack => pack.id === activeModelPackId);
  const packModelId =
    activeModeId === 'build' || activeModeId === 'plan' || activeModeId === 'fast'
      ? activePack?.models[activeModeId]
      : undefined;
  const value: ChatModelsApi = {
    activeModelId: draftModelId ?? packModelId ?? factoryProjectQuery.data?.defaultModelId ?? undefined,
    activeModelPackId,
    defaultModelPackId: modelPacksQuery.data?.activePackId ?? undefined,
    draftModelPackId,
    modelPacks: modelPacksQuery.data?.packs ?? [],
    isLoading: factoryProjectQuery.isPending || modelPacksQuery.isPending,
    error: factoryProjectQuery.error ?? undefined,
    setModel: modelId => {
      setDraftModelId(modelId);
      return Promise.resolve();
    },
    setModelPack: modelPackId => {
      setDraftModelPackId(modelPackId);
      setDraftModelId(undefined);
      return Promise.resolve();
    },
  };

  return <ChatModelsContext.Provider value={value}>{children}</ChatModelsContext.Provider>;
}

function LiveChatModelsProvider({ children }: ChatModelsProviderProps) {
  const { resourceId, projectPath, baseUrl, kind, sessionEnabled, resourceReady } = useChatSessionContext();
  const { state } = useChatConnection();
  const modelPacksQuery = useModelPacksQuery(resourceId, projectPath, kind === 'user' && resourceReady);
  const activateModelPack = useActivateModelPack(resourceId, projectPath);
  const { mutateAsync: switchModel } = useSwitchAgentControllerModelMutation({
    agentControllerId: AGENT_CONTROLLER_ID,
    resourceId,
    scope: projectPath,
    baseUrl,
    enabled: sessionEnabled,
  });
  const value: ChatModelsApi = {
    activeModelId: state?.modelId,
    activeModelPackId: modelPacksQuery.data?.sessionPackId ?? modelPacksQuery.data?.activePackId ?? undefined,
    defaultModelPackId: modelPacksQuery.data?.activePackId ?? undefined,
    draftModelPackId: undefined,
    modelPacks: modelPacksQuery.data?.packs ?? [],
    isLoading: false,
    error: undefined,
    setModel: modelId => switchModel(modelId),
    setModelPack: async modelPackId => {
      await activateModelPack.mutateAsync({ id: modelPackId, target: 'session' });
    },
  };

  return <ChatModelsContext.Provider value={value}>{children}</ChatModelsContext.Provider>;
}

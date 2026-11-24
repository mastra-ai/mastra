import { activeModelPack } from '@mastra/factory/model-packs';
import type { ModelPackSet } from '@mastra/factory/model-packs';
import type { ReactNode } from 'react';
import { useState } from 'react';

import { useDefaultModelQuery } from '../../../../hooks/use-default-model';
import { useFallbackModelQuery } from '../../../../hooks/useAvailableModels';
import type { FactoryProjectPayload } from '../../workspaces/services/github';
import { useChatModelScope } from './useChatModelScope';
import { useSwitchAgentControllerModelMutation } from '../../../../hooks/useAgentControllerStateMutations';
import { useSetSessionModelPackMutation } from '../../../../hooks/useSessionModelPack';
import { AGENT_CONTROLLER_ID } from '../services/constants';
import { routedDefault } from './chatDefaultModel';
import { ChatModelsContext } from './ChatModelsContext';
import type { ChatModelsApi } from './ChatModelsContext';
import { useChatConnection } from './useChatConnection';
import { useChatSessionContext } from './useChatSessionContext';

interface DraftModelChoice {
  modelId?: string;
  modelPackId?: string;
}

const NO_MODEL_PACKS: ModelPackSet = { modelPacks: [], defaultModelPackId: null };

/** One provider for a draft and its thread, so a Start keeps the picked model on screen. */
export function ChatModelsProvider({
  children,
  initialDraftModelId,
  initialDraftModelPackId,
}: {
  children: ReactNode;
  initialDraftModelId?: string;
  initialDraftModelPackId?: string;
}) {
  const { draftSessionId } = useChatSessionContext();
  const [draftChoice, setDraftChoice] = useState<DraftModelChoice>({
    modelId: initialDraftModelId,
    modelPackId: initialDraftModelPackId,
  });
  const draft = useDraftModels(draftChoice, setDraftChoice);
  const live = useLiveModels(draftChoice.modelId);
  return <ChatModelsContext.Provider value={draftSessionId ? draft : live}>{children}</ChatModelsContext.Provider>;
}

function useLocalModelPacks(project: FactoryProjectPayload | undefined, personal: ModelPackSet | undefined) {
  const { modelScope } = useChatModelScope();
  return (
    routedDefault<ModelPackSet>(modelScope, {
      factory: project && {
        modelPacks: project.modelPacks ?? [],
        defaultModelPackId: project.defaultModelPackId ?? null,
      },
      personal,
    }) ?? NO_MODEL_PACKS
  );
}

function useDraftModels(
  draftChoice: DraftModelChoice,
  setDraftChoice: (update: (choice: DraftModelChoice) => DraftModelChoice) => void,
): ChatModelsApi {
  const { projectQuery, modelScope, catalogTarget } = useChatModelScope();
  const defaultModelQuery = useDefaultModelQuery();
  const fallbackModelQuery = useFallbackModelQuery(catalogTarget);
  const packSet = useLocalModelPacks(projectQuery.data, defaultModelQuery.data);
  const defaultModelId = routedDefault(modelScope, {
    factory: projectQuery.data?.defaultModelId,
    personal: defaultModelQuery.data?.modelId,
  });
  const personalDefaultUsed = modelScope !== 'factory';
  const usesFallback = !defaultModelId;
  const activeModelId = draftChoice.modelId ?? defaultModelId ?? fallbackModelQuery.data;
  return {
    activeModelId,
    defaultModelId,
    modelPacks: packSet.modelPacks,
    defaultModelPackId: packSet.defaultModelPackId,
    activeModelPack: activeModelPack(packSet, draftChoice.modelPackId, activeModelId),
    pendingModelId: undefined,
    pendingModelPackId: undefined,
    isLoading:
      projectQuery.isPending ||
      (personalDefaultUsed && defaultModelQuery.isPending) ||
      (usesFallback && fallbackModelQuery.isPending),
    error:
      projectQuery.error ??
      (personalDefaultUsed ? defaultModelQuery.error : null) ??
      (usesFallback ? fallbackModelQuery.error : null) ??
      undefined,
    setModel: modelId => {
      setDraftChoice(choice => ({ ...choice, modelId }));
      return Promise.resolve();
    },
    setModelPack: pack => {
      setDraftChoice(() => ({ modelId: pack.models[0].modelId, modelPackId: pack.id }));
      return Promise.resolve();
    },
  };
}

function useLiveModels(draftModelId: string | undefined): ChatModelsApi {
  const { sessionId, resourceId, sessionThreadId, baseUrl, sessionEnabled } = useChatSessionContext();
  const { state } = useChatConnection();
  const { projectQuery, modelScope, catalogTarget, sessionModelsQuery } = useChatModelScope();
  const defaultModelQuery = useDefaultModelQuery();
  const localPackSet = useLocalModelPacks(projectQuery.data, defaultModelQuery.data);
  const localDefaultModelId = routedDefault(modelScope, {
    factory: projectQuery.data?.defaultModelId,
    personal: defaultModelQuery.data?.modelId,
  });
  const catalog = sessionModelsQuery.data;
  const defaultModelId = sessionModelsQuery.isSuccess
    ? ((catalog && 'defaultModelId' in catalog ? catalog.defaultModelId : localDefaultModelId) ?? undefined)
    : undefined;
  const packSet: ModelPackSet = catalog?.modelPacks
    ? { modelPacks: catalog.modelPacks, defaultModelPackId: catalog.defaultModelPackId ?? null }
    : localPackSet;
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
  const {
    mutateAsync: setSessionModelPack,
    isPending: switchingPack,
    variables: switchingToPackId,
  } = useSetSessionModelPackMutation({
    resourceId,
    threadId: catalogTarget.threadId ?? sessionThreadId ?? sessionId,
    sessionId,
  });
  const activeModelId = state?.modelId ?? draftModelId;
  return {
    activeModelId,
    defaultModelId,
    modelPacks: sessionModelsQuery.isSuccess ? packSet.modelPacks : [],
    defaultModelPackId: packSet.defaultModelPackId,
    activeModelPack: sessionModelsQuery.isSuccess
      ? activeModelPack(packSet, catalog?.modelPackId, activeModelId)
      : undefined,
    pendingModelId: switching ? switchingTo?.modelId : undefined,
    pendingModelPackId: switchingPack ? switchingToPackId : undefined,
    isLoading: sessionModelsQuery.isPending,
    error: sessionModelsQuery.error ?? undefined,
    setModel: modelId => switchModel({ modelId }),
    setModelPack: async pack => {
      await setSessionModelPack(pack.id);
    },
  };
}

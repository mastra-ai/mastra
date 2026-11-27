import { defaultModelPack } from '@mastra/factory/model-packs';
import type { ModelPackSet, ModelSelectionRequest } from '@mastra/factory/model-packs';
import type { ReactNode } from 'react';
import { useState } from 'react';

import { useDefaultModelQuery } from '../../../../hooks/use-default-model';
import { useFallbackModelQuery } from '../../../../hooks/useAvailableModels';
import { usePendingSessionModel, useSetSessionModelMutation } from '../../../../hooks/useSessionModel';
import { DEFAULT_MODEL_SELECTION, selectionPack } from '../services/modelSelection';
import { routedModelDefaults } from './chatDefaultModel';
import { ChatModelsContext } from './ChatModelsContext';
import type { ChatModelsApi } from './ChatModelsContext';
import { useChatConnection } from './useChatConnection';
import { useChatModelScope } from './useChatModelScope';
import { useChatSessionContext } from './useChatSessionContext';

/** One provider for a draft and its thread, so a Start keeps the picked model on screen. */
export function ChatModelsProvider({
  children,
  initialDraftSelection,
}: {
  children: ReactNode;
  initialDraftSelection?: ModelSelectionRequest;
}) {
  const { draftSessionId } = useChatSessionContext();
  const [draftSelection, setDraftSelection] = useState(initialDraftSelection ?? DEFAULT_MODEL_SELECTION);
  const draft = useDraftModels(draftSelection, setDraftSelection);
  const live = useLiveModels(draft.activeModelId);
  return (
    <ChatModelsContext.Provider value={draftSessionId ? draft : { ...live, selection: draftSelection }}>
      {children}
    </ChatModelsContext.Provider>
  );
}

function useDraftModels(
  selection: ModelSelectionRequest,
  setSelection: (selection: ModelSelectionRequest) => void,
): ChatModelsApi {
  const { projectQuery, modelScope, catalogTarget } = useChatModelScope();
  const defaultModelQuery = useDefaultModelQuery();
  const fallbackModelQuery = useFallbackModelQuery(catalogTarget);
  const defaults = routedModelDefaults(modelScope, projectQuery.data, defaultModelQuery.data);
  const selectedPack = selectionPack(selection, defaults);
  const exactModelId = selection.kind === 'model' ? selection.modelId : undefined;
  const personalDefaultUsed = modelScope !== 'factory';
  const usesFallback = !selectedPack && !exactModelId;
  const activeModelId = selectedPack?.models[0]?.modelId ?? exactModelId ?? fallbackModelQuery.data;
  return {
    activeModelId,
    modelPacks: defaults.modelPacks,
    defaultModelPack: defaultModelPack(defaults),
    selectedPack,
    selection,
    selectedThinkingLevel:
      selectedPack?.models[0]?.thinkingLevel ?? (selection.kind === 'model' ? selection.thinkingLevel : undefined),
    switching: false,
    isLoading:
      projectQuery.isPending ||
      (personalDefaultUsed && defaultModelQuery.isPending) ||
      (usesFallback && fallbackModelQuery.isPending),
    error:
      projectQuery.error ??
      (personalDefaultUsed ? defaultModelQuery.error : null) ??
      (usesFallback ? fallbackModelQuery.error : null) ??
      undefined,
    select: async next => {
      setSelection(next);
    },
  };
}

function useLiveModels(draftModelId: string | undefined): Omit<ChatModelsApi, 'selection'> {
  const { sessionId, resourceId, sessionThreadId } = useChatSessionContext();
  const { state } = useChatConnection();
  const { catalogTarget, sessionModelsQuery } = useChatModelScope();
  const catalog = sessionModelsQuery.data;
  const packSet: ModelPackSet = {
    modelPacks: catalog?.modelPacks ?? [],
    defaultModelPackId: catalog?.defaultModelPackId ?? null,
  };
  const { mutateAsync: setSessionModel } = useSetSessionModelMutation({
    resourceId,
    threadId: catalogTarget.threadId ?? sessionThreadId ?? sessionId,
    sessionId,
  });
  const pending = usePendingSessionModel(sessionId);
  const stored = catalog?.modelSelection;
  const selectedPack = pending
    ? selectionPack(pending, packSet)
    : stored?.kind === 'pack'
      ? packSet.modelPacks.find(pack => pack.id === stored.packId)
      : undefined;
  const pendingModel = pending?.kind === 'model' ? pending : undefined;
  const activeModelId = selectedPack?.models[0]?.modelId ?? pendingModel?.modelId ?? state?.modelId ?? draftModelId;
  return {
    activeModelId,
    modelPacks: packSet.modelPacks,
    defaultModelPack: defaultModelPack(packSet),
    selectedPack,
    selectedThinkingLevel: selectedPack?.models[0]?.thinkingLevel ?? pendingModel?.thinkingLevel,
    switching: pending !== undefined,
    isLoading: sessionModelsQuery.isPending,
    error: sessionModelsQuery.error ?? undefined,
    select: async next => {
      await setSessionModel(next);
    },
  };
}

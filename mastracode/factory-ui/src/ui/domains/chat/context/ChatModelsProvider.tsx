import { resolveDefaultThinkingLevel } from '@mastra/code-sdk/thinking';
import type { ThinkingLevelSetting } from '@mastra/code-sdk/thinking';
import type { ReactNode } from 'react';
import { useState } from 'react';

import { useFactoryProjectQuery } from '../../../../hooks/useFactoryDefaultModel';
import { useActivateModelPack, useModelPacksQuery } from '../../../../hooks/use-model-packs';
import { useThinkingConfigQuery } from '../../../../hooks/use-thinking';
import { useAgentControllerSettings } from '../../../../hooks/useAgentControllerSettings';
import { useSwitchAgentControllerModelMutation } from '../../../../hooks/useAgentControllerStateMutations';
import { useUpdateAgentControllerSettingsMutation } from '../../../../hooks/useUpdateAgentControllerSettingsMutation';
import { AGENT_CONTROLLER_ID } from '../services/constants';
import { ChatModelsContext } from './ChatModelsContext';
import type { ChatModelsApi } from './ChatModelsContext';
import { planModelSwitch } from './modelSwitch';
import { useChatConnection } from './useChatConnection';
import { useChatModes } from './useChatModes';
import { useChatSessionContext } from './useChatSessionContext';

function useDefaultThinkingLevel(): ThinkingLevelSetting | undefined {
  const { activeModeId } = useChatModes();
  const { data: thinkingConfig } = useThinkingConfigQuery();
  return thinkingConfig ? resolveDefaultThinkingLevel(thinkingConfig, activeModeId).level : undefined;
}

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
  const [draftThinkingLevel, setDraftThinkingLevel] = useState<ThinkingLevelSetting>();
  const defaultThinkingLevel = useDefaultThinkingLevel();
  const activeModelPackId = draftModelPackId ?? modelPacksQuery.data?.activePackId ?? undefined;
  const activePack = modelPacksQuery.data?.packs.find(pack => pack.id === activeModelPackId);
  const packModelId =
    activeModeId === 'build' || activeModeId === 'plan' || activeModeId === 'fast'
      ? activePack?.models[activeModeId]
      : undefined;
  const activeModelId = draftModelId ?? packModelId ?? factoryProjectQuery.data?.defaultModelId ?? undefined;
  const thinkingLevel = draftThinkingLevel ?? defaultThinkingLevel;
  const value: ChatModelsApi = {
    activeModelId,
    activeModelPackId,
    defaultModelPackId: modelPacksQuery.data?.activePackId ?? undefined,
    draftModelPackId,
    modelPacks: modelPacksQuery.data?.packs ?? [],
    isLoading: factoryProjectQuery.isPending || modelPacksQuery.isPending,
    error: factoryProjectQuery.error ?? undefined,
    switchModel: requested => {
      const plan = planModelSwitch({ modelId: activeModelId, thinkingLevel }, requested);
      if (plan.modelId) setDraftModelId(plan.modelId);
      if (plan.thinkingLevel) setDraftThinkingLevel(plan.thinkingLevel);
      return Promise.resolve();
    },
    switching: false,
    setModelPack: modelPackId => {
      setDraftModelPackId(modelPackId);
      setDraftModelId(undefined);
      return Promise.resolve();
    },
    thinkingLevel,
    draftThinkingLevel,
  };

  return <ChatModelsContext.Provider value={value}>{children}</ChatModelsContext.Provider>;
}

function LiveChatModelsProvider({ children }: ChatModelsProviderProps) {
  const { resourceId, projectPath, baseUrl, kind, sessionEnabled, resourceReady } = useChatSessionContext();
  const { state } = useChatConnection();
  const modelPacksQuery = useModelPacksQuery(resourceId, projectPath, kind === 'user' && resourceReady);
  const activateModelPack = useActivateModelPack(resourceId, projectPath);
  const mutationArgs = {
    agentControllerId: AGENT_CONTROLLER_ID,
    resourceId,
    scope: projectPath,
    baseUrl,
    enabled: sessionEnabled,
  };
  const { mutateAsync: switchSessionModel } = useSwitchAgentControllerModelMutation(mutationArgs);
  const settingsQuery = useAgentControllerSettings(mutationArgs);
  const { mutateAsync: updateSettings } = useUpdateAgentControllerSettingsMutation(mutationArgs);
  const defaultThinkingLevel = useDefaultThinkingLevel();
  const [switching, setSwitching] = useState(false);
  const activeModelId = state?.modelId;
  const thinkingLevel = settingsQuery.data ? (settingsQuery.data.thinkingLevel ?? defaultThinkingLevel) : undefined;
  const value: ChatModelsApi = {
    activeModelId,
    activeModelPackId: modelPacksQuery.data?.sessionPackId ?? modelPacksQuery.data?.activePackId ?? undefined,
    defaultModelPackId: modelPacksQuery.data?.activePackId ?? undefined,
    draftModelPackId: undefined,
    modelPacks: modelPacksQuery.data?.packs ?? [],
    isLoading: false,
    error: undefined,
    switchModel: async requested => {
      const plan = planModelSwitch({ modelId: activeModelId, thinkingLevel }, requested);
      setSwitching(true);
      try {
        if (plan.modelId) await switchSessionModel(plan.modelId);
        if (plan.thinkingLevel) await updateThinkingAfterModel(plan.thinkingLevel, plan.modelId);
      } finally {
        setSwitching(false);
      }
    },
    switching,
    setModelPack: async modelPackId => {
      await activateModelPack.mutateAsync({ id: modelPackId, target: 'session' });
    },
    thinkingLevel,
    draftThinkingLevel: undefined,
  };

  async function updateThinkingAfterModel(level: ThinkingLevelSetting, switchedModelId: string | undefined) {
    try {
      await updateSettings({ thinkingLevel: level });
    } catch (cause) {
      if (!switchedModelId) throw cause;
      const reason = cause instanceof Error ? cause.message : 'unknown error';
      throw new Error(`Switched to ${switchedModelId}, but thinking stayed at ${thinkingLevel}: ${reason}`, { cause });
    }
  }

  return <ChatModelsContext.Provider value={value}>{children}</ChatModelsContext.Provider>;
}

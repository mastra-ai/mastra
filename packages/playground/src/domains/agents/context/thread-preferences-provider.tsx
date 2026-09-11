import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import { AgentSettingsContext } from './agent-context';
import { PlaygroundModelContext } from './playground-model-context';
import { readThreadPreferences, serializeThreadPreferences } from './thread-preferences';
import { useAgentBuilderAllowedModels } from '@/domains/agent-builder/hooks/use-agent-builder-allowed-models';
import { useBuilderSettings } from '@/domains/agent-builder/hooks/use-builder-settings';
import { defaultSettings as fallbackSettings } from '@/domains/agents/hooks/use-agent-settings-state';
import { cleanProviderId } from '@/domains/llm';
import type { AgentSettingsType } from '@/types';

export interface ThreadPreferencesProviderProps {
  children: ReactNode;
  agentId: string;
  threadId: string;
  defaultProvider: string;
  defaultModel: string;
  defaultSettings?: AgentSettingsType;
  isNewThread?: boolean;
}

export function ThreadPreferencesProvider(props: ThreadPreferencesProviderProps) {
  const storageKey = `mastra-thread-preferences-${JSON.stringify([props.agentId, props.threadId])}`;
  return <ThreadPreferencesState key={storageKey} {...props} storageKey={storageKey} />;
}

function ThreadPreferencesState({
  children,
  defaultProvider,
  defaultModel,
  defaultSettings,
  storageKey,
  agentId,
  isNewThread,
}: ThreadPreferencesProviderProps & { storageKey: string }) {
  const [preferences, setPreferences] = useState(() =>
    readThreadPreferences(storageKey, isNewThread ? undefined : `mastra-agent-store-${agentId}`),
  );

  useEffect(() => {
    try {
      localStorage.setItem(storageKey, serializeThreadPreferences(preferences));
    } catch {
      // Keep chat usable when browser storage is unavailable or full.
    }
  }, [storageKey, preferences]);

  const { data: builderSettings, isError: policyError } = useBuilderSettings();
  const policy = builderSettings?.modelPolicy;
  const { models: allowedModels } = useAgentBuilderAllowedModels({ enabled: policy?.active === true });
  const savedSelection = preferences.selection;
  const allowed =
    !policy?.active ||
    policy.allowed === undefined ||
    allowedModels.some(
      entry =>
        cleanProviderId(entry.provider) === cleanProviderId(savedSelection?.provider ?? '') &&
        (!savedSelection?.model || entry.model === savedSelection.model),
    );
  const locked = policy?.active && policy.pickerVisible === false;
  // Never send a restored override before policy resolution, or when it is no longer allowed.
  const selection = builderSettings && !policyError && !locked && allowed ? savedSelection : undefined;
  const policyDefault = policy?.active && (locked || (savedSelection && !allowed)) ? policy.default : undefined;
  const provider = selection?.provider ?? policyDefault?.provider ?? defaultProvider;
  const model = selection?.model ?? policyDefault?.modelId ?? defaultModel;
  const modelOverride = (selection || policyDefault) && provider && model ? `${provider}/${model}` : undefined;
  const settings: AgentSettingsType = {
    modelSettings: {
      ...fallbackSettings.modelSettings,
      ...defaultSettings?.modelSettings,
      ...preferences.modelSettings,
    },
  };

  return (
    <PlaygroundModelContext.Provider
      value={{
        provider,
        model,
        modelOverride,
        setProvider: provider => setPreferences(previous => ({ ...previous, selection: { provider, model: '' } })),
        setModel: (provider, model) => setPreferences(previous => ({ ...previous, selection: { provider, model } })),
      }}
    >
      <AgentSettingsContext.Provider
        value={{
          settings,
          setSettings: settings => setPreferences(previous => ({ ...previous, modelSettings: settings.modelSettings })),
          resetAll: () => setPreferences(previous => ({ ...previous, modelSettings: undefined })),
        }}
      >
        {children}
      </AgentSettingsContext.Provider>
    </PlaygroundModelContext.Provider>
  );
}

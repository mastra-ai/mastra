import { Button } from '@mastra/playground-ui/components/Button';
import { ButtonsGroup } from '@mastra/playground-ui/components/ButtonsGroup';
import { EnvironmentVariablesEditor } from '@mastra/playground-ui/components/EnvironmentVariablesEditor';
import { Input } from '@mastra/playground-ui/components/Input';
import { SectionCard } from '@mastra/playground-ui/components/SectionCard';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@mastra/playground-ui/components/Select';
import { SettingsRow } from '@mastra/playground-ui/components/SettingsRow';
import { StatusBadge } from '@mastra/playground-ui/components/StatusBadge';
import { useEnvironmentVariablesEditor } from '@mastra/playground-ui/hooks/use-environment-variables-editor';
import { toast } from '@mastra/playground-ui/utils/toast';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { desktopEndpoint, desktopLocalProviderIdForModelUrl, desktopRequest } from '@/lib/desktop-runtime';
import type {
  DesktopRuntimeSettings,
  DesktopRuntimeState,
  ProbeModelsResult,
  UpdateSettingsResult,
} from '@/lib/desktop-runtime';

type LocalModelProviderId = 'lmstudio' | 'ollama' | 'custom';

interface EnvironmentVariableRow {
  key: string;
  value: string;
}

const LOCAL_MODEL_PRESETS = {
  lmstudio: {
    id: 'lmstudio',
    name: 'LM Studio',
    modelUrl: 'http://localhost:1234/v1',
    modelId: 'lmstudio/openai/gpt-oss-20b',
    modelApiKey: 'not-needed',
    guidance: 'Start the LM Studio local server, load a model, then probe for available models.',
  },
  ollama: {
    id: 'ollama',
    name: 'Ollama',
    modelUrl: 'http://localhost:11434/v1',
    modelId: 'llama3.2',
    modelApiKey: 'ollama',
    guidance: 'Start Ollama, pull a chat model, then probe its OpenAI-compatible endpoint.',
  },
  custom: {
    id: 'custom',
    name: 'Custom',
    modelUrl: '',
    modelId: '',
    modelApiKey: 'not-needed',
    guidance: 'Use any local OpenAI-compatible server that exposes /v1/models.',
  },
} as const satisfies Record<
  LocalModelProviderId,
  { id: LocalModelProviderId; name: string; modelUrl: string; modelId: string; modelApiKey: string; guidance: string }
>;

const ENVIRONMENT_VARIABLE_PRESETS = [
  { key: 'OPENAI_API_KEY', label: 'OpenAI key' },
  { key: 'LM_API_TOKEN', label: 'LM Studio token' },
] as const;

function providerForModelUrl(modelUrl: string): LocalModelProviderId {
  const providerId = desktopLocalProviderIdForModelUrl(modelUrl);
  return providerId === 'local' ? 'custom' : providerId;
}

function rowsFromEnvironmentVariables(envVars: Record<string, string>): EnvironmentVariableRow[] {
  const rows = Object.entries(envVars).map(([key, value]) => ({ key, value }));
  return rows.length ? rows : [{ key: '', value: '' }];
}

function modelMatchesSettings(settings: DesktopRuntimeSettings, modelUrl: string, modelId: string, apiKey: string) {
  return (
    settings.modelUrl === modelUrl.trim() &&
    settings.modelId === modelId.trim() &&
    settings.modelApiKey === apiKey.trim()
  );
}

function RuntimeBadge({ state }: { state: DesktopRuntimeState }) {
  const running = state.runtime.state === 'running';
  return (
    <StatusBadge variant={running ? 'success' : 'neutral'} size="sm" withDot={running}>
      {running ? `Runtime running on ${state.runtime.url ?? 'local port'}` : `Runtime ${state.runtime.state}`}
    </StatusBadge>
  );
}

function probeStatusLabel(probe: ProbeModelsResult | undefined, isPending: boolean) {
  if (isPending) return 'Detecting models...';
  if (!probe) return undefined;
  if (!probe.ok) return 'Not reachable';
  if (probe.models.length === 0) return 'No models detected';
  return `${probe.models.length} detected`;
}

function modelOptionsFor(probe: ProbeModelsResult | undefined, modelId: string) {
  if (!probe?.ok || probe.models.length === 0) return [];

  const detected = probe?.ok ? probe.models : [];
  if (modelId.trim() && !detected.includes(modelId)) return [...detected, modelId];
  return detected;
}

function ModelIdControl({
  isPending,
  modelId,
  onChange,
  probe,
}: {
  isPending: boolean;
  modelId: string;
  onChange: (nextModelId: string) => void;
  probe: ProbeModelsResult | undefined;
}) {
  const modelOptions = modelOptionsFor(probe, modelId);

  if (modelOptions.length > 0) {
    return (
      <Select value={modelId || modelOptions[0]} onValueChange={onChange}>
        <SelectTrigger id="desktop-model-id" size="sm" className="w-full">
          <SelectValue placeholder="Select detected model" />
        </SelectTrigger>
        <SelectContent>
          {modelOptions.map(model => (
            <SelectItem key={model} value={model}>
              {model}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }

  return (
    <Input
      id="desktop-model-id"
      value={modelId}
      placeholder={isPending ? 'Detecting models...' : 'Model ID'}
      size="sm"
      onChange={event => onChange(event.currentTarget.value)}
    />
  );
}

function RuntimeEnvironmentEditor({ endpoint, state }: { endpoint: string; state: DesktopRuntimeState }) {
  const queryClient = useQueryClient();
  const [rows, setRows] = useState(() => rowsFromEnvironmentVariables(state.settings.environmentVariables));
  const savedVariableCount = Object.keys(state.settings.environmentVariables).length;
  const editor = useEnvironmentVariablesEditor({
    rows,
    onRowsChange: nextRows => {
      setRows(nextRows);
    },
  });
  const dirty = editor.isRowsDirty;

  async function refreshEnvironment() {
    return queryClient.fetchQuery({
      queryFn: () => desktopRequest<DesktopRuntimeState>(endpoint, '/state'),
      queryKey: ['desktop-runtime-state', endpoint],
      staleTime: 0,
    });
  }

  async function restartRuntimeAfterEnvironmentSave(savedState: DesktopRuntimeState) {
    try {
      const restartedState = await desktopRequest<DesktopRuntimeState>(endpoint, '/restart-runtime', {
        method: 'POST',
      });
      queryClient.setQueryData(['desktop-runtime-state', endpoint], restartedState);
    } catch (error) {
      queryClient.setQueryData(['desktop-runtime-state', endpoint], savedState);
      toast.error(error instanceof Error ? error.message : 'Runtime environment saved, but restart failed');
    } finally {
      void queryClient.invalidateQueries({ queryKey: ['desktop-runtime-state', endpoint] });
      void queryClient.invalidateQueries({ queryKey: ['llm-providers'] });
      void queryClient.invalidateQueries({ queryKey: ['agents-model-providers'] });
      void queryClient.invalidateQueries({ queryKey: ['builder-available-models'] });
    }
  }

  const saveEnvironment = useMutation({
    mutationFn: async () => {
      return desktopRequest<UpdateSettingsResult>(endpoint, '/settings', {
        body: JSON.stringify({ environmentVariables: editor.getEnvironmentVariablesForSubmit() }),
        method: 'PATCH',
      });
    },
    onSuccess: result => {
      const nextRows = rowsFromEnvironmentVariables(result.settings.environmentVariables);
      editor.resetRows(nextRows);
      queryClient.setQueryData(['desktop-runtime-state', endpoint], result.state);
      toast.success('Runtime environment saved');
      void restartRuntimeAfterEnvironmentSave(result.state);
    },
    onError: error => {
      toast.error(error instanceof Error ? error.message : 'Unable to save runtime environment');
    },
  });

  const refreshEnvironmentMutation = useMutation({
    mutationFn: refreshEnvironment,
    onSuccess: async nextState => {
      const nextRows = rowsFromEnvironmentVariables(nextState.settings.environmentVariables);
      editor.resetRows(nextRows);
      await queryClient.invalidateQueries({ queryKey: ['desktop-runtime-state', endpoint], refetchType: 'none' });
      toast.success('Runtime environment refreshed');
    },
    onError: error => {
      toast.error(error instanceof Error ? error.message : 'Unable to refresh runtime environment');
    },
  });

  return (
    <div className="space-y-4">
      <SettingsRow label="Runtime environment">
        <StatusBadge variant={dirty ? 'warning' : 'neutral'} size="sm">
          {dirty ? 'Unsaved' : `${savedVariableCount} saved`}
        </StatusBadge>
      </SettingsRow>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <ButtonsGroup spacing="default" aria-label="Environment variable presets" className="flex-wrap justify-start">
          {ENVIRONMENT_VARIABLE_PRESETS.map(preset => (
            <Button
              key={preset.key}
              type="button"
              size="xs"
              variant="outline"
              onClick={() => {
                if (!rows.some(row => row.key.trim() === preset.key)) {
                  setRows([...rows.filter(row => row.key.trim() || row.value), { key: preset.key, value: '' }]);
                }
              }}
            >
              {preset.label}
            </Button>
          ))}
        </ButtonsGroup>

        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={refreshEnvironmentMutation.isPending || saveEnvironment.isPending}
          onClick={() => refreshEnvironmentMutation.mutate()}
        >
          {refreshEnvironmentMutation.isPending ? 'Refreshing...' : 'Refresh env'}
        </Button>
      </div>

      <EnvironmentVariablesEditor
        editor={editor}
        addLabel="Add variable"
        keyPlaceholder="OPENAI_API_KEY"
        valuePlaceholder="Value"
        actions={
          <Button
            type="button"
            size="sm"
            disabled={!dirty || editor.hasDuplicateKeys || saveEnvironment.isPending}
            onClick={() => saveEnvironment.mutate()}
          >
            {saveEnvironment.isPending ? 'Saving...' : 'Save runtime env'}
          </Button>
        }
      />
    </div>
  );
}

function DesktopRuntimeSettingsForm({ endpoint, state }: { endpoint: string; state: DesktopRuntimeState }) {
  const queryClient = useQueryClient();
  const [providerId, setProviderId] = useState(() => providerForModelUrl(state.settings.modelUrl));
  const [modelUrl, setModelUrl] = useState(() => state.settings.modelUrl);
  const [modelId, setModelId] = useState(() => state.settings.modelId);
  const [modelApiKey, setModelApiKey] = useState(() => state.settings.modelApiKey);
  const [modelIdEdited, setModelIdEdited] = useState(false);
  const selectedProvider = LOCAL_MODEL_PRESETS[providerId];

  const {
    data: probeData,
    isFetching: isProbeFetching,
    refetch: refetchProbeModels,
  } = useQuery({
    enabled: Boolean(modelUrl.trim()) && providerId !== 'custom',
    queryFn: () =>
      desktopRequest<ProbeModelsResult>(endpoint, '/probe-models', {
        body: JSON.stringify({
          apiKey: modelApiKey,
          modelUrl,
          providerId,
          providerName: selectedProvider.name,
        }),
        method: 'POST',
      }),
    queryKey: ['desktop-runtime-models', endpoint, providerId, modelUrl, modelApiKey],
    retry: false,
    staleTime: 30_000,
  });

  const detectedModelId = probeData?.ok ? probeData.models[0] : undefined;
  const shouldUseDetectedModel =
    Boolean(detectedModelId) && !modelIdEdited && (!modelId.trim() || modelId === selectedProvider.modelId);
  const effectiveModelId = shouldUseDetectedModel ? detectedModelId! : modelId;
  const isModelApplied = modelMatchesSettings(state.settings, modelUrl, effectiveModelId, modelApiKey);
  const applyModelLabel = providerId === 'custom' ? 'Use custom provider' : `Use ${selectedProvider.name}`;

  async function refreshModels() {
    const result = await refetchProbeModels();
    if (result.error) {
      toast.error(result.error instanceof Error ? result.error.message : 'Unable to refresh models');
    }
  }

  function updateModelId(nextModelId: string) {
    setModelId(nextModelId);
    setModelIdEdited(true);
  }

  function updateProvider(nextProviderId: LocalModelProviderId) {
    const provider = LOCAL_MODEL_PRESETS[nextProviderId];
    setProviderId(provider.id);
    setModelIdEdited(false);
    if (provider.id !== 'custom') {
      setModelUrl(provider.modelUrl);
      setModelId(provider.modelId);
      setModelApiKey(provider.modelApiKey);
    }
  }

  function updateModelUrl(nextModelUrl: string) {
    setModelUrl(nextModelUrl);
    setProviderId(providerForModelUrl(nextModelUrl));
    setModelIdEdited(false);
  }

  const probeLabel = probeStatusLabel(probeData, isProbeFetching);
  const probeVariant: 'error' | 'neutral' | 'success' =
    isProbeFetching || !probeData
      ? 'neutral'
      : probeData.ok && probeData.models.length > 0
        ? 'success'
        : probeData.ok
          ? 'neutral'
          : 'error';
  const probeWithDot = Boolean(probeData?.ok && probeData.models.length > 0);
  const isRefreshDisabled = !modelUrl.trim() || isProbeFetching;

  const applyModel = useMutation({
    mutationFn: async () => {
      if (!modelUrl.trim()) throw new Error('Enter a model server base URL.');
      if (!effectiveModelId.trim()) throw new Error('Enter or select a model ID.');

      await desktopRequest<UpdateSettingsResult>(endpoint, '/settings', {
        body: JSON.stringify({
          modelApiKey: modelApiKey.trim() || 'not-needed',
          modelId: effectiveModelId.trim(),
          modelUrl: modelUrl.trim(),
        }),
        method: 'PATCH',
      });
      return desktopRequest<DesktopRuntimeState>(endpoint, '/restart-runtime', { method: 'POST' });
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['desktop-runtime-state', endpoint] }),
        queryClient.invalidateQueries({ queryKey: ['desktop-runtime-models', endpoint] }),
        queryClient.invalidateQueries({ queryKey: ['builder-available-models'] }),
      ]);
      toast.success('Local model settings applied');
    },
    onError: error => {
      toast.error(error instanceof Error ? error.message : 'Unable to apply local model settings');
    },
  });

  return (
    <SectionCard
      title="Desktop Runtime"
      description="Configure the bundled local runtime used by Mastra Studio Desktop."
    >
      <div className="space-y-8">
        <SettingsRow
          label="Local runtime"
          description="This controls the Mastra runtime started by the desktop app, not a hosted Platform Studio."
        >
          <RuntimeBadge state={state} />
        </SettingsRow>

        <div className="space-y-4">
          <SettingsRow label="Local model provider">
            <ButtonsGroup spacing="default" aria-label="Local model provider" className="flex-wrap justify-end">
              {Object.values(LOCAL_MODEL_PRESETS).map(provider => (
                <Button
                  key={provider.id}
                  type="button"
                  variant={provider.id === providerId ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => updateProvider(provider.id)}
                >
                  {provider.name}
                </Button>
              ))}
            </ButtonsGroup>
          </SettingsRow>

          <div className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_minmax(120px,0.7fr)]">
            <label className="min-w-0 space-y-2 text-sm text-neutral4" htmlFor="desktop-model-url">
              <span>Base URL</span>
              <Input
                id="desktop-model-url"
                value={modelUrl}
                placeholder="http://localhost:1234/v1"
                size="sm"
                onChange={event => updateModelUrl(event.currentTarget.value)}
              />
            </label>
            <label className="min-w-0 space-y-2 text-sm text-neutral4" htmlFor="desktop-model-id">
              <span className="flex min-w-0 items-center justify-between gap-2">
                <span>Model</span>
                {probeLabel ? (
                  <StatusBadge variant={probeVariant} size="sm" withDot={probeWithDot}>
                    {probeLabel}
                  </StatusBadge>
                ) : null}
              </span>
              <ModelIdControl
                isPending={isProbeFetching}
                modelId={effectiveModelId}
                onChange={updateModelId}
                probe={probeData}
              />
            </label>
            <label className="min-w-0 space-y-2 text-sm text-neutral4" htmlFor="desktop-model-api-key">
              <span>API key</span>
              <Input
                id="desktop-model-api-key"
                value={modelApiKey}
                placeholder="not-needed"
                size="sm"
                onChange={event => setModelApiKey(event.currentTarget.value)}
              />
            </label>
          </div>

          <ButtonsGroup spacing="default" className="justify-start">
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={isRefreshDisabled}
              onClick={() => void refreshModels()}
            >
              {isProbeFetching ? 'Refreshing...' : 'Refresh models'}
            </Button>
            {!isModelApplied ? (
              <Button type="button" size="sm" onClick={() => applyModel.mutate()}>
                {applyModel.isPending ? 'Updating...' : applyModelLabel}
              </Button>
            ) : null}
          </ButtonsGroup>
        </div>

        <RuntimeEnvironmentEditor
          key={JSON.stringify(state.settings.environmentVariables)}
          endpoint={endpoint}
          state={state}
        />
      </div>
    </SectionCard>
  );
}

export function DesktopRuntimeSettingsSection() {
  const endpoint = desktopEndpoint();
  const {
    data: desktopState,
    error: stateError,
    isError: isStateError,
    isLoading: isStateLoading,
  } = useQuery({
    enabled: Boolean(endpoint),
    queryFn: () => {
      if (!endpoint) throw new Error('Desktop endpoint is not configured.');
      return desktopRequest<DesktopRuntimeState>(endpoint, '/state');
    },
    queryKey: ['desktop-runtime-state', endpoint],
    retry: false,
  });

  if (!endpoint) return null;

  if (isStateLoading) {
    return (
      <SectionCard title="Desktop Runtime" description="Loading local desktop runtime settings.">
        <p className="text-sm text-neutral4">Loading...</p>
      </SectionCard>
    );
  }

  if (isStateError || !desktopState) {
    return (
      <SectionCard title="Desktop Runtime" description="The desktop runtime settings could not be loaded.">
        <p className="text-sm text-accent2">
          {stateError instanceof Error ? stateError.message : 'Unable to load desktop runtime settings.'}
        </p>
      </SectionCard>
    );
  }

  return <DesktopRuntimeSettingsForm key={desktopState.settings.modelUrl} endpoint={endpoint} state={desktopState} />;
}

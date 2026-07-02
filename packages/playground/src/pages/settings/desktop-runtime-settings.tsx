import { Button } from '@mastra/playground-ui/components/Button';
import { ButtonsGroup } from '@mastra/playground-ui/components/ButtonsGroup';
import { EnvironmentVariablesEditor } from '@mastra/playground-ui/components/EnvironmentVariablesEditor';
import { Input } from '@mastra/playground-ui/components/Input';
import { SectionCard } from '@mastra/playground-ui/components/SectionCard';
import { SettingsRow } from '@mastra/playground-ui/components/SettingsRow';
import { StatusBadge } from '@mastra/playground-ui/components/StatusBadge';
import { useEnvironmentVariablesEditor } from '@mastra/playground-ui/hooks/use-environment-variables-editor';
import { toast } from '@mastra/playground-ui/utils/toast';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

type RuntimeState = 'idle' | 'starting' | 'running' | 'stopped' | 'error';
type LocalModelProviderId = 'lmstudio' | 'ollama' | 'custom';

interface EnvironmentVariableRow {
  key: string;
  value: string;
}

interface DesktopRuntimeSettings {
  modelUrl: string;
  modelId: string;
  modelApiKey: string;
  environmentVariables: Record<string, string>;
}

export interface DesktopRuntimeState {
  runtime: {
    state: RuntimeState;
    url?: string;
    error?: string;
  };
  settings: DesktopRuntimeSettings;
}

interface ProbeModelsResult {
  ok: boolean;
  modelUrl: string;
  models: string[];
  error?: string;
}

interface UpdateSettingsResult {
  settings: DesktopRuntimeSettings;
  state: DesktopRuntimeState;
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
} as const;

const ENVIRONMENT_VARIABLE_PRESETS = [
  { key: 'OPENAI_API_KEY', label: 'OpenAI key' },
  { key: 'LM_API_TOKEN', label: 'LM Studio token' },
] as const;

function desktopEndpoint() {
  const endpoint = window.MASTRA_DESKTOP_ENDPOINT?.trim();
  return endpoint ? endpoint.replace(/\/$/, '') : undefined;
}

function desktopUrl(endpoint: string, path: string) {
  return `${endpoint}${path}`;
}

async function desktopRequest<TResponse>(endpoint: string, path: string, init?: RequestInit): Promise<TResponse> {
  const response = await fetch(desktopUrl(endpoint, path), {
    ...init,
    headers: init?.body ? { 'Content-Type': 'application/json' } : init?.headers,
  });

  const body = (await response.json()) as unknown;
  if (!response.ok) {
    const error =
      typeof body === 'object' && body !== null && 'error' in body && typeof body.error === 'string'
        ? body.error
        : `Desktop request failed with ${response.status}`;
    throw new Error(error);
  }
  return body as TResponse;
}

function providerForModelUrl(modelUrl: string): LocalModelProviderId {
  const normalized = modelUrl.replace(/\/$/, '');
  if (normalized === LOCAL_MODEL_PRESETS.ollama.modelUrl) return 'ollama';
  if (normalized === LOCAL_MODEL_PRESETS.lmstudio.modelUrl) return 'lmstudio';
  return 'custom';
}

function rowsFromEnvironmentVariables(envVars: Record<string, string>): EnvironmentVariableRow[] {
  const rows = Object.entries(envVars).map(([key, value]) => ({ key, value }));
  return rows.length ? rows : [{ key: '', value: '' }];
}

function collectEnvironmentVariables(rows: readonly EnvironmentVariableRow[]) {
  const variables: Record<string, string> = {};
  for (const row of rows) {
    const key = row.key.trim();
    if (key) variables[key] = row.value;
  }
  return variables;
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

function ProbeResult({
  modelId,
  probe,
  onSelectModel,
}: {
  modelId: string;
  probe: ProbeModelsResult | undefined;
  onSelectModel: (nextModelId: string) => void;
}) {
  if (!probe) return null;

  if (!probe.ok) {
    return <p className="text-sm text-accent2">{probe.error ?? 'Unable to reach the model server.'}</p>;
  }

  if (!probe.models.length) {
    return <p className="text-sm text-neutral4">Server reachable, but no loaded models were reported.</p>;
  }

  return (
    <ButtonsGroup spacing="default" aria-label="Detected models" className="flex-wrap justify-start">
      {probe.models.map(model => (
        <Button
          key={model}
          type="button"
          variant={model === modelId ? 'default' : 'outline'}
          size="xs"
          onClick={() => onSelectModel(model)}
        >
          {model}
        </Button>
      ))}
    </ButtonsGroup>
  );
}

function RuntimeEnvironmentEditor({ endpoint, state }: { endpoint: string; state: DesktopRuntimeState }) {
  const queryClient = useQueryClient();
  const [rows, setRows] = useState(() => rowsFromEnvironmentVariables(state.settings.environmentVariables));
  const [dirty, setDirty] = useState(false);
  const savedVariableCount = Object.keys(state.settings.environmentVariables).length;
  const editor = useEnvironmentVariablesEditor({
    rows,
    onRowsChange: nextRows => {
      setRows(nextRows);
      setDirty(true);
    },
  });

  const saveEnvironment = useMutation({
    mutationFn: async () => {
      await desktopRequest<UpdateSettingsResult>(endpoint, '/settings', {
        body: JSON.stringify({ environmentVariables: collectEnvironmentVariables(editor.rows) }),
        method: 'PATCH',
      });
      return desktopRequest<DesktopRuntimeState>(endpoint, '/restart-runtime', { method: 'POST' });
    },
    onSuccess: async () => {
      setDirty(false);
      await queryClient.invalidateQueries({ queryKey: ['desktop-runtime-state', endpoint] });
      toast.success('Runtime environment saved');
    },
    onError: error => {
      toast.error(error instanceof Error ? error.message : 'Unable to save runtime environment');
    },
  });

  return (
    <div className="space-y-4">
      <SettingsRow
        label="Runtime environment"
        description="Add provider keys for the bundled runtime. LM Studio tokens are created in LM Studio and pasted here when authentication is enabled."
      >
        <StatusBadge variant={dirty ? 'warning' : 'neutral'} size="sm">
          {dirty ? 'Unsaved' : `${savedVariableCount} saved`}
        </StatusBadge>
      </SettingsRow>

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
                setDirty(true);
              }
            }}
          >
            {preset.label}
          </Button>
        ))}
      </ButtonsGroup>

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
            {saveEnvironment.isPending ? 'Saving...' : 'Save & restart'}
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
  const [probe, setProbe] = useState<ProbeModelsResult>();
  const selectedProvider = LOCAL_MODEL_PRESETS[providerId];
  const isModelApplied = modelMatchesSettings(state.settings, modelUrl, modelId, modelApiKey);

  const probeModels = useMutation({
    mutationFn: () =>
      desktopRequest<ProbeModelsResult>(endpoint, '/probe-models', {
        body: JSON.stringify({ apiKey: modelApiKey, modelUrl, providerName: selectedProvider.name }),
        method: 'POST',
      }),
    onSuccess: result => {
      setProbe(result);
      if (result.ok && result.models[0]) {
        setModelId(result.models[0]);
      }
    },
    onError: error => {
      toast.error(error instanceof Error ? error.message : 'Unable to probe model server');
    },
  });

  const applyModel = useMutation({
    mutationFn: async () => {
      if (!modelUrl.trim()) throw new Error('Enter a model server base URL.');
      if (!modelId.trim()) throw new Error('Enter or select a model ID.');

      await desktopRequest<UpdateSettingsResult>(endpoint, '/settings', {
        body: JSON.stringify({
          modelApiKey: modelApiKey.trim() || 'not-needed',
          modelId: modelId.trim(),
          modelUrl: modelUrl.trim(),
        }),
        method: 'PATCH',
      });
      return desktopRequest<DesktopRuntimeState>(endpoint, '/restart-runtime', { method: 'POST' });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['desktop-runtime-state', endpoint] });
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
          <SettingsRow label="Local model provider" description={selectedProvider.guidance}>
            <ButtonsGroup spacing="default" aria-label="Local model provider" className="flex-wrap justify-end">
              {Object.values(LOCAL_MODEL_PRESETS).map(provider => (
                <Button
                  key={provider.id}
                  type="button"
                  variant={provider.id === providerId ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => {
                    setProviderId(provider.id);
                    setProbe(undefined);
                    if (provider.id !== 'custom') {
                      setModelUrl(provider.modelUrl);
                      setModelId(provider.modelId);
                      setModelApiKey(provider.modelApiKey);
                    }
                  }}
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
                onChange={event => {
                  setModelUrl(event.currentTarget.value);
                  setProviderId(providerForModelUrl(event.currentTarget.value));
                  setProbe(undefined);
                }}
              />
            </label>
            <label className="min-w-0 space-y-2 text-sm text-neutral4" htmlFor="desktop-model-id">
              <span>Model ID</span>
              <Input
                id="desktop-model-id"
                value={modelId}
                placeholder="Loaded model ID"
                size="sm"
                onChange={event => setModelId(event.currentTarget.value)}
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

          <ProbeResult modelId={modelId} probe={probe} onSelectModel={setModelId} />

          <ButtonsGroup spacing="default" className="justify-start">
            <Button type="button" size="sm" variant="outline" onClick={() => probeModels.mutate()}>
              {probeModels.isPending ? 'Probing...' : 'Probe models'}
            </Button>
            <Button type="button" size="sm" onClick={() => applyModel.mutate()}>
              {applyModel.isPending ? 'Applying...' : isModelApplied ? 'Restart runtime' : 'Apply & restart'}
            </Button>
          </ButtonsGroup>
        </div>

        <RuntimeEnvironmentEditor endpoint={endpoint} state={state} />
      </div>
    </SectionCard>
  );
}

export function DesktopRuntimeSettingsSection() {
  const endpoint = desktopEndpoint();
  const stateQuery = useQuery({
    enabled: Boolean(endpoint),
    queryFn: () => {
      if (!endpoint) throw new Error('Desktop endpoint is not configured.');
      return desktopRequest<DesktopRuntimeState>(endpoint, '/state');
    },
    queryKey: ['desktop-runtime-state', endpoint],
    retry: false,
  });

  if (!endpoint) return null;

  if (stateQuery.isLoading) {
    return (
      <SectionCard title="Desktop Runtime" description="Loading local desktop runtime settings.">
        <p className="text-sm text-neutral4">Loading...</p>
      </SectionCard>
    );
  }

  if (stateQuery.isError || !stateQuery.data) {
    return (
      <SectionCard title="Desktop Runtime" description="The desktop runtime settings could not be loaded.">
        <p className="text-sm text-accent2">
          {stateQuery.error instanceof Error ? stateQuery.error.message : 'Unable to load desktop runtime settings.'}
        </p>
      </SectionCard>
    );
  }

  return (
    <DesktopRuntimeSettingsForm key={stateQuery.data.settings.modelUrl} endpoint={endpoint} state={stateQuery.data} />
  );
}

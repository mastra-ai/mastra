import { Button } from '@mastra/playground-ui/components/Button';
import { ButtonsGroup } from '@mastra/playground-ui/components/ButtonsGroup';
import { EnvironmentVariablesEditor } from '@mastra/playground-ui/components/EnvironmentVariablesEditor';
import { Input } from '@mastra/playground-ui/components/Input';
import { StatusBadge } from '@mastra/playground-ui/components/StatusBadge';
import { useEnvironmentVariablesEditor } from '@mastra/playground-ui/hooks/use-environment-variables-editor';

import { ENVIRONMENT_VARIABLE_PRESETS } from '../shared/environment-variables';
import type { EnvironmentVariableRow } from '../shared/environment-variables';
import { LOCAL_MODEL_PRESETS } from '../shared/model-presets';
import type { LocalModelProviderId } from '../shared/model-presets';
import { getOfflineReadiness } from '../shared/offline-readiness';
import type { DesktopState, ProbeModelsResult } from '../shared/types';

export interface RuntimeSettingsActions {
  onAddEnvironmentPreset: (key: string) => void;
  onApplyLocalModel: () => void;
  onLocalModelApiKeyChange: (value: string) => void;
  onLocalModelIdChange: (value: string) => void;
  onLocalModelUrlChange: (value: string) => void;
  onProbeLocalModels: () => void;
  onRuntimeEnvironmentRowsChange: (rows: EnvironmentVariableRow[]) => void;
  onSaveRuntimeEnvironment: (rows: readonly EnvironmentVariableRow[]) => void;
  onSelectLocalModel: (modelId: string) => void;
  onSetLocalProvider: (providerId: LocalModelProviderId) => void;
}

export interface RuntimeSettingsProps {
  actions: RuntimeSettingsActions;
  busyAction: string | undefined;
  current: DesktopState;
  environmentRows: EnvironmentVariableRow[];
  isLocalModelApplied: boolean;
  localModelApiKey: string;
  localModelId: string;
  localModelProbe: ProbeModelsResult | undefined;
  localModelUrl: string;
  localProviderId: LocalModelProviderId;
  runtimeEnvironmentDirty: boolean;
}

function RuntimeStatus({ current }: { current: DesktopState }) {
  const label =
    current.runtime.state === 'running'
      ? `Runtime running on ${current.runtime.url ?? 'local port'}`
      : `Runtime ${current.runtime.state}`;

  return (
    <StatusBadge variant={current.runtime.state === 'running' ? 'success' : 'neutral'} size="sm" withDot>
      {label}
    </StatusBadge>
  );
}

function OfflineReadinessStatus({
  current,
  isLocalModelApplied,
  localModelProbe,
  providerName,
}: {
  current: DesktopState;
  isLocalModelApplied: boolean;
  localModelProbe: ProbeModelsResult | undefined;
  providerName: string;
}) {
  const readiness = getOfflineReadiness({
    isLocalModelApplied,
    modelProbe: localModelProbe,
    providerName,
    runtimeState: current.runtime.state,
  });

  return (
    <div className="offline-readiness">
      <StatusBadge variant={readiness.variant} size="sm" withDot={readiness.variant === 'success'}>
        {readiness.label}
      </StatusBadge>
      <p>{readiness.message}</p>
    </div>
  );
}

function DetectedModels({
  localModelId,
  localModelProbe,
  onSelectLocalModel,
}: {
  localModelId: string;
  localModelProbe: ProbeModelsResult | undefined;
  onSelectLocalModel: (modelId: string) => void;
}) {
  if (!localModelProbe) return null;

  if (!localModelProbe.ok) {
    return <p className="launcher-message error">{localModelProbe.error ?? 'Unable to reach the model server.'}</p>;
  }

  if (localModelProbe.models.length === 0) {
    return <p className="launcher-message">Server reachable, but no loaded models were reported.</p>;
  }

  return (
    <ButtonsGroup className="model-list" spacing="default">
      {localModelProbe.models.map(model => (
        <Button
          key={model}
          type="button"
          variant={model === localModelId ? 'default' : 'outline'}
          size="xs"
          onClick={() => onSelectLocalModel(model)}
        >
          {model}
        </Button>
      ))}
    </ButtonsGroup>
  );
}

export function LocalModelSetup({
  actions,
  busyAction,
  current,
  isLocalModelApplied,
  localModelApiKey,
  localModelId,
  localModelProbe,
  localModelUrl,
  localProviderId,
}: Pick<
  RuntimeSettingsProps,
  | 'actions'
  | 'busyAction'
  | 'current'
  | 'isLocalModelApplied'
  | 'localModelApiKey'
  | 'localModelId'
  | 'localModelProbe'
  | 'localModelUrl'
  | 'localProviderId'
>) {
  const selectedProvider = LOCAL_MODEL_PRESETS[localProviderId] ?? LOCAL_MODEL_PRESETS.custom;

  return (
    <section className="local-model-setup" aria-label="Local model setup">
      <header className="inline-section-header">
        <h3>Local model setup</h3>
        <div className="runtime-statuses">
          <RuntimeStatus current={current} />
          <OfflineReadinessStatus
            current={current}
            isLocalModelApplied={isLocalModelApplied}
            localModelProbe={localModelProbe}
            providerName={selectedProvider.name}
          />
        </div>
      </header>

      <ButtonsGroup className="provider-tabs" spacing="default" aria-label="Local model provider">
        {Object.values(LOCAL_MODEL_PRESETS).map(provider => (
          <Button
            key={provider.id}
            type="button"
            variant={provider.id === localProviderId ? 'default' : 'outline'}
            size="sm"
            onClick={() => actions.onSetLocalProvider(provider.id)}
          >
            {provider.name}
          </Button>
        ))}
      </ButtonsGroup>

      <p className="setup-guidance">{selectedProvider.guidance}</p>

      <div className="setup-grid">
        <label htmlFor="settings-local-model-base-url">
          <span>Base URL</span>
          <Input
            id="settings-local-model-base-url"
            value={localModelUrl}
            placeholder="http://localhost:1234/v1"
            size="sm"
            onChange={event => actions.onLocalModelUrlChange(event.currentTarget.value)}
          />
        </label>
        <label htmlFor="settings-local-model-id">
          <span>Model ID</span>
          <Input
            id="settings-local-model-id"
            value={localModelId}
            placeholder="Loaded model ID"
            size="sm"
            onChange={event => actions.onLocalModelIdChange(event.currentTarget.value)}
          />
        </label>
        <label htmlFor="settings-local-model-api-key">
          <span>API key</span>
          <Input
            id="settings-local-model-api-key"
            value={localModelApiKey}
            placeholder="not-needed"
            size="sm"
            onChange={event => actions.onLocalModelApiKeyChange(event.currentTarget.value)}
          />
        </label>
      </div>

      <DetectedModels
        localModelId={localModelId}
        localModelProbe={localModelProbe}
        onSelectLocalModel={actions.onSelectLocalModel}
      />

      <ButtonsGroup className="setup-actions" spacing="default">
        <Button type="button" size="sm" variant="outline" onClick={actions.onProbeLocalModels}>
          {busyAction === 'probe-local-models' ? 'Probing...' : 'Probe models'}
        </Button>
        <Button type="button" size="sm" variant="default" onClick={actions.onApplyLocalModel}>
          {busyAction === 'apply-local-model' ? 'Applying...' : isLocalModelApplied ? 'Restart runtime' : 'Apply & restart'}
        </Button>
      </ButtonsGroup>
    </section>
  );
}

export function RuntimeEnvironmentSetup({
  actions,
  busyAction,
  current,
  environmentRows,
  runtimeEnvironmentDirty,
}: Pick<RuntimeSettingsProps, 'actions' | 'busyAction' | 'current' | 'environmentRows' | 'runtimeEnvironmentDirty'>) {
  const editor = useEnvironmentVariablesEditor({
    rows: environmentRows,
    onRowsChange: actions.onRuntimeEnvironmentRowsChange,
  });
  const savedVariableCount = Object.keys(current.settings.environmentVariables).length;

  return (
    <section className="runtime-env-setup" aria-label="Runtime environment">
      <header className="inline-section-header">
        <h3>Runtime environment</h3>
        <StatusBadge variant={runtimeEnvironmentDirty ? 'warning' : 'neutral'} size="sm">
          {runtimeEnvironmentDirty ? 'Unsaved' : `${savedVariableCount} saved`}
        </StatusBadge>
      </header>

      <p className="setup-guidance">
        Add provider keys for the bundled runtime. LM Studio tokens are created in LM Studio and pasted here when
        authentication is enabled.
      </p>

      <ButtonsGroup className="env-preset-row" spacing="default" aria-label="Environment variable presets">
        {ENVIRONMENT_VARIABLE_PRESETS.map(preset => (
          <Button
            key={preset.key}
            type="button"
            size="xs"
            variant="outline"
            onClick={() => actions.onAddEnvironmentPreset(preset.key)}
          >
            {preset.label}
          </Button>
        ))}
      </ButtonsGroup>

      <EnvironmentVariablesEditor
        editor={editor}
        className="runtime-env-editor"
        addLabel="Add variable"
        keyPlaceholder="OPENAI_API_KEY"
        valuePlaceholder="Value"
        actions={
          <Button
            type="button"
            size="sm"
            variant="default"
            disabled={!runtimeEnvironmentDirty || editor.hasDuplicateKeys}
            onClick={() => actions.onSaveRuntimeEnvironment(editor.rows)}
          >
            {busyAction === 'save-runtime-env' ? 'Saving...' : 'Save & restart'}
          </Button>
        }
      />
    </section>
  );
}


import { Badge } from '@mastra/playground-ui/components/Badge';
import { Button } from '@mastra/playground-ui/components/Button';
import { Input } from '@mastra/playground-ui/components/Input';
import { SettingsRow } from '@mastra/playground-ui/new/settings';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { useState } from 'react';

import {
  useOMQuery,
  useUpdateOMModel,
  useUpdateOMObserveAttachments,
  useUpdateOMThresholds,
} from '../../../../hooks/use-om';
import type { AvailableModelOption } from '../../../../hooks/useAvailableModels';
import { SkeletonRows } from '../../../ui/SkeletonRows';
import { ModelCombobox } from './ModelCombobox';
import { Segmented } from './SettingsFields';

type AttachmentChoice = 'auto' | 'on' | 'off';
type OMRole = 'observer' | 'reflector';


function attachmentToChoice(value: 'auto' | boolean): AttachmentChoice {
  if (value === true) return 'on';
  if (value === false) return 'off';
  return 'auto';
}

const ATTACHMENT_OPTIONS: { value: AttachmentChoice; label: string }[] = [
  { value: 'auto', label: 'Auto' },
  { value: 'on', label: 'On' },
  { value: 'off', label: 'Off' },
];

function choiceToAttachment(choice: AttachmentChoice): 'auto' | boolean {
  if (choice === 'on') return true;
  if (choice === 'off') return false;
  return 'auto';
}

function ThresholdInput({
  value,
  disabled,
  onCommit,
}: {
  value: number;
  disabled: boolean;
  onCommit: (value: number) => void;
}) {
  const [draft, setDraft] = useState(String(value));

  const commit = () => {
    const parsed = Number(draft);
    const rounded = Number.isFinite(parsed) ? Math.round(parsed) : NaN;
    if (!Number.isFinite(rounded) || rounded <= 0) {
      setDraft(String(value));
      return;
    }
    setDraft(String(rounded));
    if (rounded !== value) onCommit(rounded);
  };

  return (
    <Input
      size="sm"
      type="number"
      min={1}
      step={1000}
      value={draft}
      disabled={disabled}
      onChange={event => setDraft(event.target.value)}
      onBlur={commit}
    />
  );
}

export function OMSection({
  resourceId,
  scope,
  factoryId,
  models,
}: {
  resourceId?: string;
  scope?: string;
  factoryId?: string;
  models: AvailableModelOption[];
}) {
  const omQuery = useOMQuery(resourceId, scope, factoryId);
  const observerMutation = useUpdateOMModel(resourceId, 'observer', scope, factoryId);
  const reflectorMutation = useUpdateOMModel(resourceId, 'reflector', scope, factoryId);
  const thresholdsMutation = useUpdateOMThresholds(resourceId, scope, factoryId);
  const attachmentsMutation = useUpdateOMObserveAttachments(resourceId, scope, factoryId);

  const config = omQuery.data?.config;
  const modelsAvailable =
    config?.observer.providerStatus === 'available' && config.reflector.providerStatus === 'available';
  const loading = omQuery.isPending;
  const busy =
    observerMutation.isPending ||
    reflectorMutation.isPending ||
    thresholdsMutation.isPending ||
    attachmentsMutation.isPending;
  const mutationError = [
    observerMutation.error,
    reflectorMutation.error,
    thresholdsMutation.error,
    attachmentsMutation.error,
  ].find(error => error instanceof Error);
  const error = mutationError?.message ?? (omQuery.error instanceof Error ? omQuery.error.message : undefined);

  const switchModel = (role: OMRole, modelId: string) => {
    if (!modelId) return;
    const mutation = role === 'observer' ? observerMutation : reflectorMutation;
    mutation.mutate({ model: modelId });
  };

  const resetModel = (role: OMRole) => {
    const mutation = role === 'observer' ? observerMutation : reflectorMutation;
    mutation.mutate({ model: 'auto' });
  };

  if (loading) {
    return (
      <div className="px-4 py-3">
        <SkeletonRows label="Loading observational-memory settings" rows={4} rowClassName="h-10 w-full" />
      </div>
    );
  }

  const attachmentChoice = attachmentToChoice(config?.observeAttachments ?? 'auto');
  const observerValue = config?.observer.model === 'auto' ? '' : (config?.observer.model ?? '');
  const reflectorValue = config?.reflector.model === 'auto' ? '' : (config?.reflector.model ?? '');
  return (
    <>
      {error && (
        <Txt as="p" variant="caption" className="text-notice-destructive-fg px-4 py-3">
          {error}
        </Txt>
      )}

      {config && !modelsAvailable && (
        <div className="flex items-center gap-2 px-4 py-3">
          <Badge size="md" variant="yellow">
            Model credentials required
          </Badge>
          <Txt as="p" variant="meta" className="text-muted-foreground">
            Observational-memory model calls may fail until credentials are configured.
          </Txt>
        </div>
      )}

      <SettingsRow label="Observer model" description="Summarizes the conversation into observations">
        <div className="flex w-full max-w-72 items-center gap-2">
          <Button
            variant={config?.observer.model === 'auto' ? 'primary' : 'outline'}
            size="sm"
            aria-label="Use automatic observer model"
            aria-pressed={config?.observer.model === 'auto'}
            disabled={busy || !config}
            onClick={() => resetModel('observer')}
          >
            {config?.observer.model === 'auto' ? `Auto (${config.observer.effectiveModelId})` : 'Auto'}
          </Button>
          <ModelCombobox
            models={models}
            value={observerValue}
            placeholder="Select observer model…"
            disabled={busy}
            onValueChange={modelId => switchModel('observer', modelId)}
            className="flex-1"
          />
        </div>
      </SettingsRow>

      <SettingsRow label="Reflector model" description="Distills observations into longer-term memory">
        <div className="flex w-full max-w-72 items-center gap-2">
          <Button
            variant={config?.reflector.model === 'auto' ? 'primary' : 'outline'}
            size="sm"
            aria-label="Use automatic reflector model"
            aria-pressed={config?.reflector.model === 'auto'}
            disabled={busy || !config}
            onClick={() => resetModel('reflector')}
          >
            {config?.reflector.model === 'auto' ? `Auto (${config.reflector.effectiveModelId})` : 'Auto'}
          </Button>
          <ModelCombobox
            models={models}
            value={reflectorValue}
            placeholder="Select reflector model…"
            disabled={busy}
            onValueChange={modelId => switchModel('reflector', modelId)}
            className="flex-1"
          />
        </div>
      </SettingsRow>

      <SettingsRow label="Messages before observation" description="Message tokens processed before the observer runs.">
        {config && (
          <div className="w-full max-w-40">
            <ThresholdInput
              key={config.observationThreshold}
              value={config.observationThreshold}
              disabled={busy}
              onCommit={observationThreshold => {
                thresholdsMutation.mutate({ observationThreshold });
              }}
            />
          </div>
        )}
      </SettingsRow>

      <SettingsRow
        label="Observations before reflection"
        description="Observation tokens accumulated before the reflector runs."
      >
        {config && (
          <div className="w-full max-w-40">
            <ThresholdInput
              key={config.reflectionThreshold}
              value={config.reflectionThreshold}
              disabled={busy}
              onCommit={reflectionThreshold => {
                thresholdsMutation.mutate({ reflectionThreshold });
              }}
            />
          </div>
        )}
      </SettingsRow>

      <SettingsRow label="Observe attachments" description="Whether attached files are included in observations">
        <Segmented
          ariaLabel="Observe attachments"
          value={attachmentChoice}
          options={ATTACHMENT_OPTIONS}
          disabled={busy || !config}
          onChange={choice => attachmentsMutation.mutate({ value: choiceToAttachment(choice) })}
        />
      </SettingsRow>
    </>
  );
}

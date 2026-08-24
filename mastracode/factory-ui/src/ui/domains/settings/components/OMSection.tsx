import { Badge } from '@mastra/playground-ui/components/Badge';
import { Input } from '@mastra/playground-ui/components/Input';
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
import { SettingsRow } from './SettingsCard';
import { Segmented, SegmentedSelect } from './SettingsPanel.parts';

type AttachmentChoice = 'auto' | 'on' | 'off';

function attachmentToChoice(value: 'auto' | boolean): AttachmentChoice {
  if (value === true) return 'on';
  if (value === false) return 'off';
  return 'auto';
}

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
      className="w-full sm:w-32"
      onChange={event => setDraft(event.target.value)}
      onBlur={commit}
    />
  );
}

/**
 * Persisted observational-memory settings, optionally synchronized to an
 * active session. With `factoryId` set, the section edits the factory
 * project's shared settings (used by board runs and channel sessions) instead
 * of the caller's personal row.
 */
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
  const configuredModelIds = new Set(models.map(model => model.id));
  const observerAvailable = config !== undefined && configuredModelIds.has(config.observerModelId);
  const reflectorAvailable = config !== undefined && configuredModelIds.has(config.reflectorModelId);
  const modelsAvailable = observerAvailable && reflectorAvailable;
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

  const switchModel = (role: 'observer' | 'reflector', modelId: string) => {
    if (!modelId) return;
    const mutation = role === 'observer' ? observerMutation : reflectorMutation;
    mutation.mutate({ modelId });
  };

  if (loading) {
    return <SkeletonRows label="Loading observational-memory settings" rows={4} rowClassName="h-10 w-full" />;
  }

  const attachmentChoice = attachmentToChoice(config?.observeAttachments ?? 'auto');
  const attachmentOptions: { value: AttachmentChoice; label: string }[] = [
    { value: 'auto', label: 'Auto' },
    { value: 'on', label: 'On' },
    { value: 'off', label: 'Off' },
  ];

  return (
    <>
      {error && (
        <Txt as="p" variant="ui-xs" className="text-notice-destructive-fg px-4 pt-3">
          {error}
        </Txt>
      )}

      {config && !modelsAvailable && (
        <div className="flex items-center gap-2 px-4 pt-3">
          <Badge size="md" variant="warning">
            Model credentials required
          </Badge>
          <Txt as="p" variant="ui-xs" className="text-icon3">
            Observational-memory model calls may fail until credentials are configured.
          </Txt>
        </div>
      )}

      <SettingsRow label="Observer model" hint="Summarizes the conversation into observations">
        <ModelCombobox
          models={models}
          value={config?.observerModelId ?? ''}
          placeholder="Select observer model…"
          disabled={busy}
          className="w-full sm:w-72"
          onValueChange={modelId => switchModel('observer', modelId)}
        />
      </SettingsRow>

      <SettingsRow label="Reflector model" hint="Distills observations into longer-term memory">
        <ModelCombobox
          models={models}
          value={config?.reflectorModelId ?? ''}
          placeholder="Select reflector model…"
          disabled={busy}
          className="w-full sm:w-72"
          onValueChange={modelId => switchModel('reflector', modelId)}
        />
      </SettingsRow>

      <SettingsRow label="Messages before observation" hint="Message tokens processed before the observer runs.">
        {config && (
          <ThresholdInput
            key={config.observationThreshold}
            value={config.observationThreshold}
            disabled={busy}
            onCommit={observationThreshold => {
              thresholdsMutation.mutate({ observationThreshold });
            }}
          />
        )}
      </SettingsRow>

      <SettingsRow
        label="Observations before reflection"
        hint="Observation tokens accumulated before the reflector runs."
      >
        {config && (
          <ThresholdInput
            key={config.reflectionThreshold}
            value={config.reflectionThreshold}
            disabled={busy}
            onCommit={reflectionThreshold => {
              thresholdsMutation.mutate({ reflectionThreshold });
            }}
          />
        )}
      </SettingsRow>

      <SettingsRow label="Observe attachments" hint="Whether attached files are included in observations">
        <div className="w-full lg:hidden">
          <SegmentedSelect
            ariaLabel="Observe attachments"
            value={attachmentChoice}
            disabled={busy || !config}
            options={attachmentOptions}
            onChange={value => attachmentsMutation.mutate({ value: choiceToAttachment(value) })}
          />
        </div>
        <div className="hidden lg:block">
          <Segmented
            ariaLabel="Observe attachments"
            value={attachmentChoice}
            disabled={busy || !config}
            options={attachmentOptions}
            onChange={value => attachmentsMutation.mutate({ value: choiceToAttachment(value) })}
          />
        </div>
      </SettingsRow>
    </>
  );
}

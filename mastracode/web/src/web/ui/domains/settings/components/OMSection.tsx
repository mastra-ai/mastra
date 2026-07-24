import { Badge } from '@mastra/playground-ui/components/Badge';
import { Button } from '@mastra/playground-ui/components/Button';
import { ButtonsGroup } from '@mastra/playground-ui/components/ButtonsGroup';
import { Input } from '@mastra/playground-ui/components/Input';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { useState } from 'react';

import {
  useOMQuery,
  useUpdateOMModel,
  useUpdateOMObserveAttachments,
  useUpdateOMThresholds,
} from '../../../../../shared/hooks/use-om';
import type { AvailableModelOption } from '../../../../../shared/hooks/useAvailableModels';
import { SkeletonRows } from '../../../ui/SkeletonRows';
import { ModelCombobox } from './ModelCombobox';

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

function Field({ label, hint, children }: { label: string; hint: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex flex-col">
        <Txt as="span" variant="ui-sm" className="text-icon5">
          {label}
        </Txt>
        <Txt as="span" variant="ui-xs" className="text-icon3">
          {hint}
        </Txt>
      </div>
      {children}
    </div>
  );
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

/** Persisted observational-memory settings, optionally synchronized to an active session. */
export function OMSection({
  resourceId,
  scope,
  models,
}: {
  resourceId?: string;
  scope?: string;
  models: AvailableModelOption[];
}) {
  const omQuery = useOMQuery(resourceId, scope);
  const observerMutation = useUpdateOMModel(resourceId, 'observer', scope);
  const reflectorMutation = useUpdateOMModel(resourceId, 'reflector', scope);
  const thresholdsMutation = useUpdateOMThresholds(resourceId, scope);
  const attachmentsMutation = useUpdateOMObserveAttachments(resourceId, scope);

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
    <div className="flex flex-col gap-4">
      {error && (
        <Txt as="p" variant="ui-sm" className="text-notice-destructive-fg">
          {error}
        </Txt>
      )}

      {config && !modelsAvailable && (
        <div className="flex items-center gap-2">
          <Badge size="md" variant="warning">
            Model credentials required
          </Badge>
          <Txt as="p" variant="ui-xs" className="text-icon3">
            Observational-memory model calls may fail until credentials are configured.
          </Txt>
        </div>
      )}

      <Field label="Observer model" hint="Summarizes the conversation into observations">
        <ModelCombobox
          models={models}
          value={config?.observerModelId ?? ''}
          placeholder="Select observer model…"
          disabled={busy}
          onValueChange={modelId => switchModel('observer', modelId)}
        />
      </Field>

      <Field label="Reflector model" hint="Distills observations into longer-term memory">
        <ModelCombobox
          models={models}
          value={config?.reflectorModelId ?? ''}
          placeholder="Select reflector model…"
          disabled={busy}
          onValueChange={modelId => switchModel('reflector', modelId)}
        />
      </Field>

      <Field label="Messages before observation" hint="Message tokens processed before the observer runs.">
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
      </Field>

      <Field label="Observations before reflection" hint="Observation tokens accumulated before the reflector runs.">
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
      </Field>

      <Field label="Observe attachments" hint="Whether attached files are included in observations">
        <ButtonsGroup spacing="close" role="group" aria-label="Observe attachments">
          {attachmentOptions.map(option => (
            <Button
              key={option.value}
              variant={attachmentChoice === option.value ? 'primary' : 'outline'}
              size="sm"
              aria-pressed={attachmentChoice === option.value}
              disabled={busy || !config}
              onClick={() => attachmentsMutation.mutate({ value: choiceToAttachment(option.value) })}
            >
              {option.label}
            </Button>
          ))}
        </ButtonsGroup>
      </Field>
    </div>
  );
}

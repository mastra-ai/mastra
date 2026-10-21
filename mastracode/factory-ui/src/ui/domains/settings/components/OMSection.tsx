import { Badge } from '@mastra/playground-ui/components/Badge';
import { InputGroupAddon, InputGroupText } from '@mastra/playground-ui/components/InputGroup';
import {
  InputNumber,
  InputNumberDecrement,
  InputNumberGroup,
  InputNumberIncrement,
  InputNumberInput,
} from '@mastra/playground-ui/components/InputNumber';
import { SegmentedControl, SegmentedControlItem } from '@mastra/playground-ui/components/SegmentedControl';
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

type AttachmentChoice = 'auto' | 'on' | 'off';
type OMRole = 'observer' | 'reflector';

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

/**
 * Token count field with steppers. It stays editable while a save is in flight, since
 * disabling it would drop focus mid-edit; each save returns the full config.
 */
function TokenThresholdInput({ value, onCommit }: { value: number; onCommit: (value: number) => void }) {
  const [draft, setDraft] = useState<number | null>(value);
  // The last value this field asked to save, so a draft is compared with what was sent,
  // not with a saved value whose response may still be on its way.
  const [sent, setSent] = useState(value);
  const [editing, setEditing] = useState(false);
  const [syncedValue, setSyncedValue] = useState(value);
  // Follow the saved value (e.g. after another surface changed it) without remounting, so
  // focus stays put. While the person is still in the field, a save landing must not
  // overwrite what they are typing; leaving the field saves the draft.
  if (syncedValue !== value) {
    setSyncedValue(value);
    if (!editing) {
      setDraft(value);
      setSent(value);
    }
  }

  const commit = (next: number | null) => {
    const rounded = next == null ? NaN : Math.round(next);
    if (!Number.isFinite(rounded) || rounded <= 0) {
      setDraft(sent);
      return;
    }
    setDraft(rounded);
    if (rounded === sent) return;
    setSent(rounded);
    onCommit(rounded);
  };

  return (
    <InputNumber
      value={draft}
      min={1}
      step={1000}
      largeStep={10000}
      format={{ maximumFractionDigits: 0 }}
      onValueChange={setDraft}
      onValueCommitted={(next, details) => {
        // Typing and arrow-key stepping save once on blur; a stepper press saves when released.
        if (details.reason === 'increment-press' || details.reason === 'decrement-press') commit(next);
      }}
      className="sm:w-64 sm:shrink-0"
    >
      <InputNumberGroup
        size="sm"
        onFocus={() => setEditing(true)}
        onBlur={event => {
          if (!event.currentTarget.contains(event.relatedTarget)) setEditing(false);
        }}
      >
        <InputNumberInput onBlur={() => commit(draft)} />
        <InputGroupAddon align="inline-end" variant="flush">
          <InputGroupText className="mr-2">tokens</InputGroupText>
          <InputNumberDecrement />
          <InputNumberIncrement />
        </InputGroupAddon>
      </InputNumberGroup>
    </InputNumber>
  );
}

export function OMSection({
  sessionId,
  factoryId,
  models,
}: {
  sessionId?: string;
  factoryId?: string;
  models: AvailableModelOption[];
}) {
  const omQuery = useOMQuery(sessionId, factoryId);
  const observerMutation = useUpdateOMModel(sessionId, 'observer', factoryId);
  const reflectorMutation = useUpdateOMModel(sessionId, 'reflector', factoryId);
  const thresholdsMutation = useUpdateOMThresholds(sessionId, factoryId);
  const attachmentsMutation = useUpdateOMObserveAttachments(sessionId, factoryId);

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
    mutation.mutate({ modelId });
  };

  if (loading) {
    return (
      <div className="px-4 py-3">
        <SkeletonRows label="Loading observational-memory settings" rows={4} rowClassName="h-10 w-full" />
      </div>
    );
  }

  const attachmentChoice = attachmentToChoice(config?.observeAttachments ?? 'auto');
  return (
    <>
      {error && (
        <Txt as="p" variant="caption" className="text-destructive-foreground px-4 py-3">
          {error}
        </Txt>
      )}

      {config && !modelsAvailable && (
        <div className="flex items-center gap-2 px-4 py-3">
          <Badge size="md" variant="warning">
            Model credentials required
          </Badge>
          <Txt tone="muted" as="p" variant="meta">
            Observational-memory model calls may fail until credentials are configured.
          </Txt>
        </div>
      )}

      <SettingsRow label="Observer model" description="Summarizes the conversation into observations">
        <ModelCombobox
          models={models}
          value={config?.observer.model ?? ''}
          auto={{ effectiveModelId: config?.observer.effectiveModelId }}
          placeholder="Select observer model…"
          disabled={busy || !config}
          onValueChange={modelId => switchModel('observer', modelId)}
        />
      </SettingsRow>

      <SettingsRow label="Reflector model" description="Distills observations into longer-term memory">
        <ModelCombobox
          models={models}
          value={config?.reflector.model ?? ''}
          auto={{ effectiveModelId: config?.reflector.effectiveModelId }}
          placeholder="Select reflector model…"
          disabled={busy || !config}
          onValueChange={modelId => switchModel('reflector', modelId)}
        />
      </SettingsRow>

      <SettingsRow label="Messages before observation" description="Message tokens processed before the observer runs.">
        {config && (
          <TokenThresholdInput
            value={config.observationThreshold}
            onCommit={observationThreshold => thresholdsMutation.mutate({ observationThreshold })}
          />
        )}
      </SettingsRow>

      <SettingsRow
        label="Observations before reflection"
        description="Observation tokens accumulated before the reflector runs."
      >
        {config && (
          <TokenThresholdInput
            value={config.reflectionThreshold}
            onCommit={reflectionThreshold => thresholdsMutation.mutate({ reflectionThreshold })}
          />
        )}
      </SettingsRow>

      <SettingsRow label="Observe attachments" description="Whether attached files are included in observations">
        <SegmentedControl
          aria-label="Observe attachments"
          value={attachmentChoice}
          disabled={busy || !config}
          onValueChange={choice => attachmentsMutation.mutate({ value: choiceToAttachment(choice) })}
        >
          <SegmentedControlItem value="auto">Auto</SegmentedControlItem>
          <SegmentedControlItem value="on">On</SegmentedControlItem>
          <SegmentedControlItem value="off">Off</SegmentedControlItem>
        </SegmentedControl>
      </SettingsRow>
    </>
  );
}

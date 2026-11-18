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
import { Skeleton } from '@mastra/playground-ui/components/Skeleton';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { useState } from 'react';

import {
  useOMQuery,
  useUpdateOMModel,
  useUpdateOMObserveAttachments,
  useUpdateOMThresholds,
} from '../../../../hooks/use-om';
import type { AvailableModelOption } from '../../../../hooks/useAvailableModels';
import { ModelCombobox } from './ModelCombobox';
import { OMFlow } from './OMRow';

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

const CONTROL_SKELETON = <Skeleton aria-hidden className="h-control-sm w-full motion-reduce:before:animate-none" />;

function AttachmentsControl({
  value,
  disabled,
  onValueChange,
}: {
  value: AttachmentChoice | undefined;
  disabled: boolean;
  onValueChange?: (choice: AttachmentChoice) => void;
}) {
  return (
    <SegmentedControl<AttachmentChoice | ''>
      aria-label="Observe attachments"
      size="sm"
      value={value ?? ''}
      disabled={disabled}
      inert={value === undefined}
      onValueChange={choice => {
        if (choice) onValueChange?.(choice);
      }}
    >
      <SegmentedControlItem value="auto">Auto</SegmentedControlItem>
      <SegmentedControlItem value="on">On</SegmentedControlItem>
      <SegmentedControlItem value="off">Off</SegmentedControlItem>
    </SegmentedControl>
  );
}

// Stays editable while saving: disabling would drop focus mid-edit.
function TokenThresholdInput({ value, onCommit }: { value: number; onCommit: (value: number) => void }) {
  const [draft, setDraft] = useState<number | null>(value);
  // Compared with what was sent, not a saved value whose response may still be in flight.
  const [sent, setSent] = useState(value);
  const [editing, setEditing] = useState(false);
  const [syncedValue, setSyncedValue] = useState(value);
  // Follows outside saves without remounting, and never overwrites a draft being typed.
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
      className="w-full"
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
  threadId,
  resourceId,
  models,
}: {
  sessionId?: string;
  factoryId?: string;
  threadId?: string;
  resourceId?: string;
  models: AvailableModelOption[];
}) {
  const omQuery = useOMQuery(sessionId, factoryId, threadId, resourceId);
  const observerMutation = useUpdateOMModel(sessionId, 'observer', factoryId, threadId, resourceId);
  const reflectorMutation = useUpdateOMModel(sessionId, 'reflector', factoryId, threadId, resourceId);
  const thresholdsMutation = useUpdateOMThresholds(sessionId, factoryId, threadId, resourceId);
  const attachmentsMutation = useUpdateOMObserveAttachments(sessionId, factoryId, threadId, resourceId);

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

  if (omQuery.isPending) {
    return (
      <div role="status" aria-label="Loading observational-memory settings">
        <OMFlow
          observeAfter={CONTROL_SKELETON}
          observer={CONTROL_SKELETON}
          reflectAfter={CONTROL_SKELETON}
          reflector={CONTROL_SKELETON}
          attachments={<AttachmentsControl value={undefined} disabled={false} />}
        />
      </div>
    );
  }

  if (omQuery.data === undefined) {
    return (
      <Txt as="p" variant="caption" className="text-destructive-foreground">
        {omQuery.error.message}
      </Txt>
    );
  }

  const { config } = omQuery.data;
  const modelsAvailable =
    config.observer.providerStatus === 'available' && config.reflector.providerStatus === 'available';

  return (
    <div className="flex flex-col gap-4">
      {error && (
        <Txt as="p" variant="caption" className="text-destructive-foreground">
          {error}
        </Txt>
      )}

      {!modelsAvailable && (
        <div className="flex items-center gap-2">
          <Badge size="md" variant="warning">
            Model credentials required
          </Badge>
          <Txt tone="muted" as="p" variant="meta">
            Observational-memory model calls may fail until credentials are configured.
          </Txt>
        </div>
      )}

      <OMFlow
        observeAfter={
          <TokenThresholdInput
            value={config.observationThreshold}
            onCommit={observationThreshold => thresholdsMutation.mutate({ observationThreshold })}
          />
        }
        observer={
          <ModelCombobox
            models={models}
            value={config.observer.model}
            auto={{ effectiveModelId: config.observer.effectiveModelId }}
            placeholder="Select observer model"
            aria-label="Observer model"
            size="sm"
            disabled={busy}
            onValueChange={modelId => switchModel('observer', modelId)}
          />
        }
        reflectAfter={
          <TokenThresholdInput
            value={config.reflectionThreshold}
            onCommit={reflectionThreshold => thresholdsMutation.mutate({ reflectionThreshold })}
          />
        }
        reflector={
          <ModelCombobox
            models={models}
            value={config.reflector.model}
            auto={{ effectiveModelId: config.reflector.effectiveModelId }}
            placeholder="Select reflector model"
            aria-label="Reflector model"
            size="sm"
            disabled={busy}
            onValueChange={modelId => switchModel('reflector', modelId)}
          />
        }
        attachments={
          <AttachmentsControl
            value={attachmentToChoice(config.observeAttachments)}
            disabled={busy}
            onValueChange={choice => attachmentsMutation.mutate({ value: choiceToAttachment(choice) })}
          />
        }
      />
    </div>
  );
}

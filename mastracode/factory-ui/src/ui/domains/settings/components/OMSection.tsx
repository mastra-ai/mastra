import { Badge } from '@mastra/playground-ui/components/Badge';
import { Field, FieldLabel } from '@mastra/playground-ui/components/Field';
import { InputGroupAddon, InputGroupText } from '@mastra/playground-ui/components/InputGroup';
import {
  InputNumber,
  InputNumberDecrement,
  InputNumberGroup,
  InputNumberIncrement,
  InputNumberInput,
} from '@mastra/playground-ui/components/InputNumber';
import { SegmentedControl, SegmentedControlItem } from '@mastra/playground-ui/components/SegmentedControl';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { ChevronRight, MessageSquare } from 'lucide-react';
import type { ReactNode } from 'react';
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

// Stays editable while saving: disabling would drop focus mid-edit.
function TokenThresholdInput({
  label,
  value,
  onCommit,
}: {
  label: string;
  value: number;
  onCommit: (value: number) => void;
}) {
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
      className="shrink-0 @min-[46rem]:w-40"
    >
      <InputNumberGroup
        size="sm"
        onFocus={() => setEditing(true)}
        onBlur={event => {
          if (!event.currentTarget.contains(event.relatedTarget)) setEditing(false);
        }}
      >
        <InputNumberInput aria-label={label} onBlur={() => commit(draft)} />
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
    return <SkeletonRows label="Loading observational-memory settings" rows={2} rowClassName="h-14 w-full" />;
  }

  const attachmentChoice = attachmentToChoice(config?.observeAttachments ?? 'auto');
  return (
    <div className="flex flex-col gap-4">
      {error && (
        <Txt as="p" variant="caption" className="text-destructive-foreground">
          {error}
        </Txt>
      )}

      {config && !modelsAvailable && (
        <div className="flex items-center gap-2">
          <Badge size="md" variant="warning">
            Model credentials required
          </Badge>
          <Txt tone="muted" as="p" variant="meta">
            Observational-memory model calls may fail until credentials are configured.
          </Txt>
        </div>
      )}

      {config && (
        <div className="@container">
          <ol className="flex flex-col items-stretch gap-1 @min-[46rem]:flex-row @min-[46rem]:items-center">
            <PipelineStep>
              <span className="bg-fill-subtle text-muted-foreground h-control-sm inline-flex items-center gap-1.5 rounded-full px-3">
                <MessageSquare className="size-3.5" aria-hidden="true" />
                <Txt as="span" variant="caption">
                  Messages
                </Txt>
              </span>
            </PipelineStep>
            <PipelineStep>
              <TokenThresholdInput
                label="Messages before observation"
                value={config.observationThreshold}
                onCommit={observationThreshold => thresholdsMutation.mutate({ observationThreshold })}
              />
            </PipelineStep>
            <PipelineStep>
              <ModelStage label="Observer">
                <ModelCombobox
                  models={models}
                  value={config.observer.model}
                  auto={{ effectiveModelId: config.observer.effectiveModelId }}
                  placeholder="Select observer model…"
                  aria-label="Observer model"
                  size="sm"
                  disabled={busy}
                  onValueChange={modelId => switchModel('observer', modelId)}
                />
              </ModelStage>
            </PipelineStep>
            <PipelineStep>
              <TokenThresholdInput
                label="Observations before reflection"
                value={config.reflectionThreshold}
                onCommit={reflectionThreshold => thresholdsMutation.mutate({ reflectionThreshold })}
              />
            </PipelineStep>
            <PipelineStep>
              <ModelStage label="Reflector">
                <ModelCombobox
                  models={models}
                  value={config.reflector.model}
                  auto={{ effectiveModelId: config.reflector.effectiveModelId }}
                  placeholder="Select reflector model…"
                  aria-label="Reflector model"
                  size="sm"
                  disabled={busy}
                  onValueChange={modelId => switchModel('reflector', modelId)}
                />
              </ModelStage>
            </PipelineStep>
          </ol>
        </div>
      )}

      <div className="border-border flex flex-wrap items-center justify-between gap-3 border-t pt-4">
        <Txt as="span" variant="caption" tone="muted">
          Observe attachments
        </Txt>
        <SegmentedControl
          aria-label="Observe attachments"
          size="sm"
          value={attachmentChoice}
          disabled={busy || !config}
          onValueChange={choice => attachmentsMutation.mutate({ value: choiceToAttachment(choice) })}
        >
          <SegmentedControlItem value="auto">Auto</SegmentedControlItem>
          <SegmentedControlItem value="on">On</SegmentedControlItem>
          <SegmentedControlItem value="off">Off</SegmentedControlItem>
        </SegmentedControl>
      </div>
    </div>
  );
}

function PipelineStep({ children }: { children: ReactNode }) {
  return (
    <li className="group/step flex flex-col items-stretch gap-1 @min-[46rem]:flex-auto @min-[46rem]:flex-row @min-[46rem]:items-center @min-[46rem]:gap-0 @min-[46rem]:last:flex-none">
      {children}
      <span
        aria-hidden="true"
        className="text-placeholder flex items-center justify-center group-last/step:hidden @min-[46rem]:min-w-6 @min-[46rem]:flex-1"
      >
        <span className="bg-border hidden h-px flex-1 @min-[46rem]:block" />
        <ChevronRight className="size-3 rotate-90 @min-[46rem]:-ml-1 @min-[46rem]:rotate-0" />
      </span>
    </li>
  );
}

function ModelStage({ label, children }: { label: string; children: ReactNode }) {
  return (
    <Field className="border-border gap-1.5 rounded-lg border p-3 @min-[46rem]:w-52">
      <FieldLabel size="smaller" className="text-muted-foreground">
        {label}
      </FieldLabel>
      {children}
    </Field>
  );
}

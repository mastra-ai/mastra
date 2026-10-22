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

  const attachmentChoice = attachmentToChoice(config.observeAttachments);
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

      <div className="@container flex flex-col gap-3">
        <ol className="flex flex-col">
          <OMRow as="li" rail="node" label="Messages" />
          <OMRow as="li" rail="edge" label="Observe after">
            <TokenThresholdInput
              value={config.observationThreshold}
              onCommit={observationThreshold => thresholdsMutation.mutate({ observationThreshold })}
            />
          </OMRow>
          <OMRow as="li" rail="node" label="Observer">
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
          </OMRow>
          <OMRow as="li" rail="edge" label="Reflect after">
            <TokenThresholdInput
              value={config.reflectionThreshold}
              onCommit={reflectionThreshold => thresholdsMutation.mutate({ reflectionThreshold })}
            />
          </OMRow>
          <OMRow as="li" rail="node" label="Reflector">
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
          </OMRow>
        </ol>
        <OMRow rail="none" label="Attachments">
          <SegmentedControl
            aria-label="Observe attachments"
            size="sm"
            value={attachmentChoice}
            disabled={busy}
            onValueChange={choice => attachmentsMutation.mutate({ value: choiceToAttachment(choice) })}
          >
            <SegmentedControlItem value="auto">Auto</SegmentedControlItem>
            <SegmentedControlItem value="on">On</SegmentedControlItem>
            <SegmentedControlItem value="off">Off</SegmentedControlItem>
          </SegmentedControl>
        </OMRow>
      </div>
    </div>
  );
}

type RailMark = 'node' | 'edge' | 'none';

const RAIL_MARKS: Record<RailMark, ReactNode> = {
  node: (
    <>
      <span className="bg-border-strong h-1.5 w-px shrink-0 group-first/row:invisible @min-[30rem]:h-auto @min-[30rem]:flex-1" />
      <span className="bg-muted-foreground size-2 shrink-0 rounded-full" />
      <span className="bg-border-strong w-px flex-1 group-last/row:invisible" />
    </>
  ),
  edge: <span className="bg-border-strong w-px flex-1" />,
  none: null,
};

function OMRow({
  as: Row = 'div',
  rail,
  label,
  children,
}: {
  as?: 'li' | 'div';
  rail: RailMark;
  label: string;
  children?: ReactNode;
}) {
  return (
    <Row className="group/row grid min-h-10 grid-cols-[2rem_minmax(0,1fr)] items-center gap-x-3 gap-y-1 @min-[30rem]:grid-cols-[2rem_6.5rem_minmax(0,20rem)]">
      <span aria-hidden="true" className="row-span-2 flex flex-col items-center self-stretch @min-[30rem]:row-span-1">
        {RAIL_MARKS[rail]}
      </span>
      {children ? (
        <Field className="contents">
          <FieldLabel size="smaller" className={rail === 'node' ? undefined : 'text-muted-foreground'}>
            {label}
          </FieldLabel>
          <div className="col-start-2 pb-2 @min-[30rem]:col-start-auto @min-[30rem]:pb-0">{children}</div>
        </Field>
      ) : (
        <Txt as="span" variant="column">
          {label}
        </Txt>
      )}
    </Row>
  );
}

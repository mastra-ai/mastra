import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react';
import {
  ORDERING_LABELS,
  STEP_TYPE_OPTIONS,
  isStepTypeOption,
  isToolStepType,
  isTrajectoryOrdering,
  newTrajectoryStep,
  recordedDetails,
} from './trajectory-types';
import type { TrajectoryOrdering, TrajectoryStepRow } from './trajectory-types';
import { Button } from '@/ds/components/Button';
import { CodeEditor } from '@/ds/components/CodeEditor';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/ds/components/Collapsible';
import { DisclosureChevron } from '@/ds/components/DisclosureChevron';
import { Input } from '@/ds/components/Input';
import { SegmentedControl, SegmentedControlItem } from '@/ds/components/SegmentedControl';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/ds/components/Select';
import { Txt } from '@/ds/components/Txt';

const ORDERING_HINTS = {
  strict: 'Steps must run exactly in this order, with nothing in between.',
  relaxed: 'Steps must run in this order; other steps may run in between.',
  unordered: 'Steps must all run, in any order.',
} satisfies Record<TrajectoryOrdering, string>;

export interface TrajectoryEditorProps {
  ordering: TrajectoryOrdering;
  onOrderingChange: (ordering: TrajectoryOrdering) => void;
  steps: TrajectoryStepRow[];
  /** Receives an updater, so edits that land in the same tick don't overwrite each other. */
  onStepsChange: (update: (steps: TrajectoryStepRow[]) => TrajectoryStepRow[]) => void;
  /** The target agents' tools. When known, tool steps pick their name from them. */
  toolNames: string[];
}

export function TrajectoryEditor({
  ordering,
  onOrderingChange,
  steps,
  onStepsChange,
  toolNames,
}: TrajectoryEditorProps) {
  const updateStep = (id: string, patch: Partial<TrajectoryStepRow>) =>
    onStepsChange(current => current.map(step => (step.id === id ? { ...step, ...patch } : step)));
  const removeStep = (id: string) => onStepsChange(current => current.filter(step => step.id !== id));
  const moveStep = (from: number, to: number) =>
    onStepsChange(current => {
      const next = [...current];
      const [moved] = next.splice(from, 1);
      if (moved) next.splice(to, 0, moved);
      return next;
    });

  return (
    <div className="grid gap-4">
      <div className="grid gap-1.5">
        <SegmentedControl
          aria-label="Step ordering"
          size="sm"
          value={ordering}
          onValueChange={value => {
            if (isTrajectoryOrdering(value)) onOrderingChange(value);
          }}
          className="w-fit"
        >
          {Object.entries(ORDERING_LABELS).map(([value, label]) => (
            <SegmentedControlItem key={value} value={value}>
              {label}
            </SegmentedControlItem>
          ))}
        </SegmentedControl>
        <Txt variant="caption" tone="muted">
          {ORDERING_HINTS[ordering]}
        </Txt>
      </div>

      {steps.length > 0 && (
        <ol className="grid gap-2">
          {steps.map((step, index) => (
            <TrajectoryStepItem
              key={step.id}
              step={step}
              position={index + 1}
              isFirst={index === 0}
              isLast={index === steps.length - 1}
              toolNames={toolNames}
              onChange={patch => updateStep(step.id, patch)}
              onMoveUp={() => moveStep(index, index - 1)}
              onMoveDown={() => moveStep(index, index + 1)}
              onRemove={() => removeStep(step.id)}
            />
          ))}
        </ol>
      )}

      <div>
        <Button size="sm" icon={<Plus />} onClick={() => onStepsChange(current => [...current, newTrajectoryStep()])}>
          Add step
        </Button>
      </div>
    </div>
  );
}

interface TrajectoryStepItemProps {
  step: TrajectoryStepRow;
  position: number;
  isFirst: boolean;
  isLast: boolean;
  toolNames: string[];
  onChange: (patch: Partial<TrajectoryStepRow>) => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onRemove: () => void;
}

function TrajectoryStepItem({
  step,
  position,
  isFirst,
  isLast,
  toolNames,
  onChange,
  onMoveUp,
  onMoveDown,
  onRemove,
}: TrajectoryStepItemProps) {
  const label = `Step ${position}`;
  const details = recordedDetails(step);

  return (
    <li className="grid gap-2 rounded-lg bg-muted/50 px-3 py-2">
      <div className="flex flex-wrap items-center gap-2 sm:flex-nowrap">
        <span
          aria-hidden
          className="flex size-6 shrink-0 items-center justify-center rounded-full bg-background text-caption text-muted-foreground"
        >
          {position}
        </span>
        <div className="w-44 shrink-0">
          <Select
            value={step.stepType}
            onValueChange={stepType => {
              if (stepType && isStepTypeOption(stepType)) onChange({ stepType, recorded: undefined });
            }}
          >
            <SelectTrigger size="sm" aria-label={`${label} type`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STEP_TYPE_OPTIONS.map(option => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {isToolStepType(step.stepType) && toolNames.length > 0 ? (
          <div className="min-w-0 flex-1">
            <Select value={step.name} onValueChange={name => onChange({ name: name ?? '' })}>
              <SelectTrigger size="sm" aria-label={`${label} name`}>
                <SelectValue placeholder="Pick a tool" />
              </SelectTrigger>
              <SelectContent>
                {/* Keep a name typed before switching to a tool step pickable, so it isn't silently lost. */}
                {(step.name && !toolNames.includes(step.name) ? [step.name, ...toolNames] : toolNames).map(toolName => (
                  <SelectItem key={toolName} value={toolName}>
                    {toolName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : (
          <Input
            size="sm"
            aria-label={`${label} name`}
            placeholder={isToolStepType(step.stepType) ? 'Tool name' : 'Step name'}
            value={step.name}
            onChange={event => onChange({ name: event.target.value })}
            className="min-w-0 flex-1"
          />
        )}
        <div className="flex shrink-0 items-center gap-1">
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={`Move ${label.toLowerCase()} up`}
            disabled={isFirst}
            onClick={onMoveUp}
          >
            <ArrowUp />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={`Move ${label.toLowerCase()} down`}
            disabled={isLast}
            onClick={onMoveDown}
          >
            <ArrowDown />
          </Button>
          <Button variant="ghost" size="icon-sm" aria-label={`Remove ${label.toLowerCase()}`} onClick={onRemove}>
            <Trash2 />
          </Button>
        </div>
      </div>

      {details.length > 0 && (
        <Txt as="p" variant="caption" tone="muted" className="pl-8">
          Also expects the recorded {details.join(', ')}
        </Txt>
      )}

      {isToolStepType(step.stepType) && (
        <Collapsible>
          <CollapsibleTrigger
            aria-label={`${label} expected args`}
            className="flex items-center gap-1.5 rounded-sm pl-8"
          >
            <DisclosureChevron direction="right" />
            <Txt as="span" variant="caption" tone="muted">
              Expected args
            </Txt>
          </CollapsibleTrigger>
          <CollapsibleContent className="pt-2 pl-8">
            <CodeEditor
              value={step.toolArgs}
              onChange={toolArgs => onChange({ toolArgs })}
              aria-label={`${label} expected args JSON`}
              showFormatButton={Boolean(step.toolArgs.trim())}
              className="min-h-[100px]"
            />
          </CollapsibleContent>
        </Collapsible>
      )}
    </li>
  );
}

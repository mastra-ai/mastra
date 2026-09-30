import { Button } from '@mastra/playground-ui/components/Button';
import { ButtonsGroup } from '@mastra/playground-ui/components/ButtonsGroup';
import { Input } from '@mastra/playground-ui/components/Input';
import { Switch } from '@mastra/playground-ui/components/Switch';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { ArrowDown, ArrowUp, Pin, Trash2 } from 'lucide-react';

import { MODEL_OPTIONS, providerOf } from '../cast';
import { SettingSelect } from '../StorySettingControls';
import type { SettingOption } from '../StorySettingControls';
import type { WorkflowStep, WorkflowStepKind } from './storyWorkflows';
import { STEP_ICONS } from './WorkflowFlow';

const LANE_MODEL = 'lane';

const KINDS: SettingOption<WorkflowStepKind>[] = [
  { value: 'agent', label: 'Agent' },
  { value: 'tool', label: 'Tool' },
  { value: 'approval', label: 'Approval' },
];

const MODEL_CHOICES: SettingOption<string>[] = [
  { value: LANE_MODEL, label: 'Lane model' },
  ...MODEL_OPTIONS.map(model => ({ value: model, label: model })),
];

const TITLE_PLACEHOLDERS: Record<WorkflowStepKind, string> = {
  agent: 'What the agent does',
  tool: 'Which tool runs',
  approval: 'Who signs off',
};

function withKind(step: WorkflowStep, kind: WorkflowStepKind): WorkflowStep {
  return kind === 'agent' ? { ...step, kind } : { kind, title: step.title };
}

function withModel(step: WorkflowStep, value: string): WorkflowStep {
  if (value === LANE_MODEL) return { kind: step.kind, title: step.title };
  return { ...step, model: value, provider: providerOf(value) };
}

export function WorkflowStepEditor({
  step,
  position,
  count,
  onChange,
  onMove,
  onRemove,
}: {
  step: WorkflowStep;
  position: number;
  count: number;
  onChange: (step: WorkflowStep) => void;
  onMove: (offset: -1 | 1) => void;
  onRemove: () => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-1">
        <Input
          size="sm"
          aria-label={`Step ${position} title`}
          placeholder={TITLE_PLACEHOLDERS[step.kind]}
          value={step.title}
          onChange={event => onChange({ ...step, title: event.target.value })}
          className="min-w-0 flex-1"
        />
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={`Move step ${position} up`}
          disabled={position === 1}
          onClick={() => onMove(-1)}
        >
          <ArrowUp aria-hidden />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={`Move step ${position} down`}
          disabled={position === count}
          onClick={() => onMove(1)}
        >
          <ArrowDown aria-hidden />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={`Remove step ${position}`}
          disabled={count === 1}
          onClick={onRemove}
        >
          <Trash2 aria-hidden />
        </Button>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <ButtonsGroup size="sm" aria-label={`Step ${position} kind`}>
          {KINDS.map(kind => {
            const Icon = STEP_ICONS[kind.value];
            return (
              <Button
                key={kind.value}
                variant={step.kind === kind.value ? 'primary' : 'default'}
                aria-pressed={step.kind === kind.value}
                onClick={() => onChange(withKind(step, kind.value))}
              >
                <Icon aria-hidden />
                {kind.label}
              </Button>
            );
          })}
        </ButtonsGroup>
        {step.kind === 'agent' && <AgentModel step={step} position={position} onChange={onChange} />}
      </div>
    </div>
  );
}

function AgentModel({
  step,
  position,
  onChange,
}: {
  step: WorkflowStep;
  position: number;
  onChange: (step: WorkflowStep) => void;
}) {
  return (
    <>
      <SettingSelect
        label={`Step ${position} model`}
        value={step.model ?? LANE_MODEL}
        options={MODEL_CHOICES}
        onChange={value => onChange(withModel(step, value))}
      />
      <label className="flex items-center gap-2">
        <Switch
          aria-label={`Pin step ${position} model`}
          checked={step.pinned ?? false}
          disabled={!step.model}
          onCheckedChange={pinned => onChange({ ...step, pinned })}
        />
        <Txt as="span" variant="meta" tone={step.model ? 'ink' : 'faint'}>
          Pin model
        </Txt>
      </label>
      {step.pinned && (
        <Txt as="span" variant="meta" tone="muted" className="flex items-center gap-1">
          <Pin size={11} aria-hidden />
          Bills the Factory account
        </Txt>
      )}
    </>
  );
}

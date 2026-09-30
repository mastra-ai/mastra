import { Button } from '@mastra/playground-ui/components/Button';
import { Input } from '@mastra/playground-ui/components/Input';
import { cn } from '@mastra/playground-ui/utils/cn';
import { Plus, Workflow, Zap } from 'lucide-react';
import { useState } from 'react';

import { RAIL_LIST, RailRow } from '../../factory/components/Timeline';
import type { Storyboard } from '../StoryboardProvider';
import { storyBoardLanes } from '../storyBoards';
import type { StoryLane } from '../storyBoards';
import { SettingSelect } from '../StorySettingControls';
import type { SettingOption } from '../StorySettingControls';
import type { StoryWorkflow, WorkflowStep } from './storyWorkflows';
import { STEP_ICONS, StepMark } from './WorkflowFlow';
import { WorkflowStepEditor } from './WorkflowStepEditor';

type TriggerKind = 'lane' | 'label' | 'schedule';

type DraftStep = { id: string; step: WorkflowStep };

type Draft = { title: string; trigger: TriggerKind; lane: string; label: string; schedule: string; steps: DraftStep[] };

function newStep(): DraftStep {
  return { id: crypto.randomUUID(), step: { kind: 'agent', title: '' } };
}

const TRIGGER_OPTIONS: SettingOption<TriggerKind>[] = [
  { value: 'lane', label: 'Card enters a lane' },
  { value: 'label', label: 'Label added' },
  { value: 'schedule', label: 'On a schedule' },
];

const SCHEDULE_OPTIONS: SettingOption<string>[] = [
  { value: 'Every hour', label: 'Every hour' },
  { value: 'Every day at 9:00', label: 'Every day at 9:00' },
  { value: 'Every Monday', label: 'Every Monday' },
];

function laneOptions(lanes: StoryLane[]): SettingOption<string>[] {
  return lanes.map(lane => ({ value: lane.stage, label: lane.label }));
}

function toWorkflow(draft: Draft, lanes: StoryLane[]): StoryWorkflow {
  const title = draft.title.trim() || 'Untitled workflow';
  const lane = lanes.find(candidate => candidate.stage === draft.lane);
  const triggers: Record<TriggerKind, string> = {
    lane: `Card enters ${lane?.label ?? draft.lane}`,
    label: `Label “${draft.label.trim() || 'any'}” added`,
    schedule: draft.schedule,
  };
  return {
    id: `ui-${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${Date.now()}`,
    title,
    lanes: draft.trigger === 'lane' ? [draft.lane] : [],
    trigger: triggers[draft.trigger],
    steps: draft.steps.map(({ step }) => ({ ...step, title: step.title.trim() || 'Untitled step' })),
    source: 'ui',
  };
}

function moved<Item>(items: Item[], index: number, offset: -1 | 1): Item[] {
  const next = [...items];
  const [item] = next.splice(index, 1);
  if (item !== undefined) next.splice(index + offset, 0, item);
  return next;
}

export function WorkflowBuilder({ storyboard, onClose }: { storyboard: Storyboard; onClose: () => void }) {
  const lanes = storyBoardLanes(storyboard.state.boardLayout).flatMap(board => board.lanes);
  const [draft, setDraft] = useState<Draft>({
    title: '',
    trigger: 'lane',
    lane: lanes[0]?.stage ?? '',
    label: '',
    schedule: SCHEDULE_OPTIONS[0]!.value,
    steps: [newStep()],
  });
  const setSteps = (steps: DraftStep[]) => setDraft({ ...draft, steps });
  const save = () => {
    storyboard.patch({ workflows: [...storyboard.state.workflows, toWorkflow(draft, lanes)] });
    onClose();
  };

  return (
    <div className="border-border flex flex-col rounded-xl border">
      <div className="border-border flex items-center gap-2 border-b px-4 py-3">
        <Workflow size={14} className="text-muted-foreground shrink-0" aria-hidden />
        <Input
          variant="unstyled"
          aria-label="Workflow name"
          placeholder="Name this workflow"
          value={draft.title}
          onChange={event => setDraft({ ...draft, title: event.target.value })}
          className="text-foreground min-w-0 flex-1 text-sm"
        />
        <Button variant="ghost" size="sm" onClick={onClose}>
          Cancel
        </Button>
        <Button variant="primary" size="sm" onClick={save}>
          Save workflow
        </Button>
      </div>
      <ol className={cn(RAIL_LIST, 'max-w-3xl p-4')}>
        <RailRow connected mark={<StepMark icon={Zap} />}>
          <TriggerPicker draft={draft} lanes={lanes} onChange={setDraft} />
        </RailRow>
        {draft.steps.map(({ id, step }, index) => (
          <RailRow key={id} connected mark={<StepMark icon={STEP_ICONS[step.kind]} />}>
            <WorkflowStepEditor
              step={step}
              position={index + 1}
              count={draft.steps.length}
              onChange={next => setSteps(draft.steps.map(entry => (entry.id === id ? { id, step: next } : entry)))}
              onMove={offset => setSteps(moved(draft.steps, index, offset))}
              onRemove={() => setSteps(draft.steps.filter(entry => entry.id !== id))}
            />
          </RailRow>
        ))}
        <RailRow connected={false} mark={<StepMark icon={Plus} dashed />}>
          <div className="flex min-h-7 items-center">
            <Button variant="ghost" size="sm" className="-ml-2" onClick={() => setSteps([...draft.steps, newStep()])}>
              Add step
            </Button>
          </div>
        </RailRow>
      </ol>
    </div>
  );
}

function TriggerPicker({
  draft,
  lanes,
  onChange,
}: {
  draft: Draft;
  lanes: StoryLane[];
  onChange: (draft: Draft) => void;
}) {
  return (
    <div className="flex min-h-7 flex-wrap items-center gap-2">
      <SettingSelect
        label="Trigger"
        value={draft.trigger}
        options={TRIGGER_OPTIONS}
        onChange={trigger => onChange({ ...draft, trigger })}
      />
      {draft.trigger === 'lane' && (
        <SettingSelect
          label="Lane"
          value={draft.lane}
          options={laneOptions(lanes)}
          onChange={lane => onChange({ ...draft, lane })}
        />
      )}
      {draft.trigger === 'label' && (
        <Input
          size="sm"
          aria-label="Label"
          placeholder="security"
          value={draft.label}
          onChange={event => onChange({ ...draft, label: event.target.value })}
          className="w-44"
        />
      )}
      {draft.trigger === 'schedule' && (
        <SettingSelect
          label="Schedule"
          value={draft.schedule}
          options={SCHEDULE_OPTIONS}
          onChange={schedule => onChange({ ...draft, schedule })}
        />
      )}
    </div>
  );
}

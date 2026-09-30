import { Txt } from '@mastra/playground-ui/components/Txt';
import { Zap } from 'lucide-react';
import type { ReactNode } from 'react';

import { RAIL_LIST, RailRow } from '../factory/components/Timeline';
import { autoStatus } from './laneAutoStatus';
import { resolveLaneRunner, runnerName } from './laneRunner';
import { storyBoardLanes, storyLane } from './storyBoards';
import { RulePopover } from './StoryLaneRules';
import type { RuleMoment, StoryRule } from './storyRules';
import { rulesOnLane } from './storyRules';
import type { StoryState } from './storyState';
import { RailText, StepMark, WorkflowSteps } from './workflows/WorkflowFlow';
import type { StoryWorkflow } from './workflows/storyWorkflows';
import { laneStepPayer, workflowsOnLane } from './workflows/storyWorkflows';

type SequenceStep = { key: string; title: string; detail: string; rule?: StoryRule; body?: ReactNode };

function laneNeighbours(state: StoryState, stageId: string) {
  const lanes =
    storyBoardLanes(state.boardLayout).find(board => board.lanes.some(lane => lane.stage === stageId))?.lanes ??
    storyBoardLanes(state.boardLayout)[0]?.lanes ??
    [];
  const index = lanes.findIndex(lane => lane.stage === stageId);
  return {
    label: lanes[index]?.label ?? stageId.charAt(0).toUpperCase() + stageId.slice(1),
    previous: lanes[index - 1]?.label,
    next: lanes[index + 1]?.label,
  };
}

function ruleStep(rule: StoryRule): SequenceStep {
  return { key: rule.id, title: rule.title, detail: `Rule · ${rule.when} → ${rule.then}`, rule };
}

function laneSequence(state: StoryState, stageId: string): { steps: SequenceStep[]; anyTime: SequenceStep[] } {
  const rules = rulesOnLane(stageId);
  const at = (moment: RuleMoment) => rules.filter(rule => rule.moment === moment).map(ruleStep);
  const { label, previous, next } = laneNeighbours(state, stageId);
  const workflowSteps = (workflow: StoryWorkflow) => (
    <WorkflowSteps steps={workflow.steps} payerFor={step => laneStepPayer(state, step, stageId)} laneId={stageId} />
  );

  const runner = storyLane(state.boardLayout, stageId) ? resolveLaneRunner(state, stageId) : null;
  const runnerWorkflowId = runner?.kind === 'workflow' ? runner.workflow.id : null;
  const otherWorkflows = workflowsOnLane(state, stageId).filter(workflow => workflow.id !== runnerWorkflowId);

  const steps: SequenceStep[] = [
    {
      key: 'arrives',
      title: `Card arrives in ${label}`,
      detail: previous ? `From ${previous}` : 'From a source or a rule',
    },
    ...at('arrives'),
    ...otherWorkflows.map(workflow => ({
      key: workflow.id,
      title: workflow.title,
      detail: `Workflow · ${workflow.trigger}`,
      body: workflowSteps(workflow),
    })),
    ...(runner
      ? [
          {
            key: 'run',
            title: runnerName(runner),
            detail: `Runs the lane · ${autoStatus(state, stageId).label}`,
            body: runner.kind === 'workflow' ? workflowSteps(runner.workflow) : undefined,
          },
        ]
      : []),
    ...at('after-run'),
    ...(next ? [{ key: 'next', title: `Moves to ${next}`, detail: 'Once nothing above holds it' }] : []),
  ];
  return { steps, anyTime: at('any-time') };
}

function NumberMark({ value }: { value: number }) {
  return (
    <span className="border-border bg-fill-subtle text-muted-foreground grid size-7 place-items-center rounded-full border text-xs tabular-nums">
      {value}
    </span>
  );
}

function SequenceRow({ step, mark, connected }: { step: SequenceStep; mark: ReactNode; connected: boolean }) {
  const text = (
    <RailText title={step.title}>
      <Txt as="span" variant="meta" tone="muted">
        {step.detail}
      </Txt>
    </RailText>
  );
  return (
    <RailRow connected={connected} mark={mark}>
      {step.rule ? (
        <RulePopover
          rule={step.rule}
          trigger={
            <button type="button" className="text-left">
              {text}
            </button>
          }
        />
      ) : (
        text
      )}
      {step.body && <div className="pt-3">{step.body}</div>}
    </RailRow>
  );
}

export function StoryLaneSequence({ state, stageId }: { state: StoryState; stageId: string }) {
  const { steps, anyTime } = laneSequence(state, stageId);
  const { label } = laneNeighbours(state, stageId);
  return (
    <div className="flex flex-col gap-3">
      <Txt as="p" variant="meta" tone="faint">
        In {label}, in order
      </Txt>
      <ol className={RAIL_LIST}>
        {steps.map((step, index) => (
          <SequenceRow
            key={step.key}
            step={step}
            mark={<NumberMark value={index + 1} />}
            connected={index < steps.length - 1}
          />
        ))}
      </ol>
      {anyTime.length > 0 && (
        <div className="border-border flex flex-col gap-3 border-t pt-3">
          <Txt as="p" variant="meta" tone="faint">
            Any time a card is in {label}
          </Txt>
          <ol className={RAIL_LIST}>
            {anyTime.map(step => (
              <SequenceRow key={step.key} step={step} mark={<StepMark icon={Zap} dashed />} connected={false} />
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}

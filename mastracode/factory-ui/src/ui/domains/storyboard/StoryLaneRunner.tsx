import { DropdownMenu } from '@mastra/playground-ui/components/DropdownMenu';
import { Popover, PopoverContent, PopoverTrigger } from '@mastra/playground-ui/components/Popover';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { Bot, ChevronDown, Lock, Sparkles, Workflow } from 'lucide-react';
import type { ReactNode } from 'react';

import { StoryWorkflowLink } from './StoryExplain';
import type { Storyboard } from './StoryboardProvider';
import { LANE_CHIP_CLASS } from './laneChip';
import type { ResolvedRunner } from './laneRunner';
import { resolveLaneRunner, runnerName } from './laneRunner';
import { STORY_AGENTS } from './storyAgents';
import type { LaneRunner } from './storyState';
import { laneRunsOn } from './storyState';

function runnerLabel(runner: ResolvedRunner): { icon: ReactNode; label: string } {
  switch (runner.kind) {
    case 'skill':
      return { icon: <Sparkles size={12} aria-hidden />, label: runnerName(runner) };
    case 'agent':
      return { icon: <Bot size={12} aria-hidden />, label: runnerName(runner) };
    case 'workflow':
      return { icon: <Workflow size={12} aria-hidden />, label: runnerName(runner) };
  }
}

function RunnerDetails({ runner, ownerLane }: { runner: ResolvedRunner; ownerLane: boolean }) {
  switch (runner.kind) {
    case 'skill':
      return (
        <Txt as="p" variant="meta" tone="muted">
          {ownerLane
            ? "Owner's plan lanes run the default agent with the lane skill, on the model each owner picks. No custom agent, no workflow: the Factory can't pick a model it doesn't pay for."
            : `The default agent runs with the lane skills: ${runner.skills.join(', ') || 'none yet'}.`}
        </Txt>
      );
    case 'agent':
      return (
        <div className="flex flex-col gap-1">
          <Txt as="p" variant="meta" tone="muted">
            {runner.agent.description}
          </Txt>
          <Txt as="p" variant="meta" tone="faint">
            Runs {runner.agent.model} · tools: {runner.agent.tools.join(', ')}
          </Txt>
        </div>
      );
    case 'workflow':
      return (
        <div className="flex flex-col gap-1">
          <Txt as="p" variant="meta" tone="muted">
            {runner.workflow.steps.map(step => step.title).join(' → ')}
          </Txt>
          <StoryWorkflowLink workflowId={runner.workflow.id}>See the steps</StoryWorkflowLink>
        </div>
      );
  }
}

function runnerValue(runner: ResolvedRunner): string {
  if (runner.kind === 'agent') return `agent:${runner.agent.id}`;
  if (runner.kind === 'workflow') return `workflow:${runner.workflow.id}`;
  return 'skill';
}

function parseRunner(value: string): LaneRunner {
  const [kind, id = ''] = value.split(':');
  if (kind === 'agent') return { kind: 'agent', agentId: id };
  if (kind === 'workflow') return { kind: 'workflow', workflowId: id };
  return { kind: 'skill' };
}

function RunnerPicker({
  storyboard,
  stageId,
  runner,
}: {
  storyboard: Storyboard;
  stageId: string;
  runner: ResolvedRunner;
}) {
  const { state, patch } = storyboard;
  const ownerLane = laneRunsOn(state, stageId) === 'owner';
  const { icon, label } = runnerLabel(runner);
  return (
    <DropdownMenu>
      <DropdownMenu.Trigger
        render={
          <button type="button" className={LANE_CHIP_CLASS} aria-label={`Lane runner: ${label}`}>
            {icon}
            <span className="max-w-44 truncate">{label}</span>
            <ChevronDown size={12} aria-hidden />
          </button>
        }
      />
      <DropdownMenu.Content align="start" className="w-72">
        <DropdownMenu.Label>When a card enters this lane</DropdownMenu.Label>
        <DropdownMenu.RadioGroup
          value={runnerValue(runner)}
          onValueChange={value =>
            patch({ laneRunners: { ...state.laneRunners, [stageId]: parseRunner(String(value)) } })
          }
        >
          <DropdownMenu.RadioItem value="skill">Default agent with the lane skills</DropdownMenu.RadioItem>
          <DropdownMenu.Label>A specific agent{ownerLane && ' · Factory keys only'}</DropdownMenu.Label>
          {STORY_AGENTS.map(agent => (
            <DropdownMenu.RadioItem key={agent.id} value={`agent:${agent.id}`} disabled={ownerLane}>
              {agent.name}
            </DropdownMenu.RadioItem>
          ))}
          <DropdownMenu.Label>A workflow{ownerLane && ' · Factory keys only'}</DropdownMenu.Label>
          {state.workflows.map(workflow => (
            <DropdownMenu.RadioItem key={workflow.id} value={`workflow:${workflow.id}`} disabled={ownerLane}>
              {workflow.title}
            </DropdownMenu.RadioItem>
          ))}
        </DropdownMenu.RadioGroup>
      </DropdownMenu.Content>
    </DropdownMenu>
  );
}

export function StoryLaneRunner({ storyboard, stageId }: { storyboard: Storyboard; stageId: string }) {
  const { state } = storyboard;
  const runner = resolveLaneRunner(state, stageId);
  if (state.viewerRole === 'admin') return <RunnerPicker storyboard={storyboard} stageId={stageId} runner={runner} />;
  const { icon, label } = runnerLabel(runner);
  return (
    <Popover>
      <PopoverTrigger
        openOnHover
        delay={150}
        closeDelay={100}
        render={
          <button type="button" className={LANE_CHIP_CLASS} aria-label={`Lane runner: ${label}`}>
            {icon}
            <span className="max-w-44 truncate">{label}</span>
          </button>
        }
      />
      <PopoverContent align="start" className="flex w-72 flex-col gap-2 p-3">
        <Txt as="p" variant="label" tone="ink">
          {label}
        </Txt>
        <RunnerDetails runner={runner} ownerLane={laneRunsOn(state, stageId) === 'owner'} />
        <Txt as="p" variant="meta" tone="faint" className="flex items-center gap-1.5">
          <Lock size={12} aria-hidden />
          Only Factory admins change the runner
        </Txt>
      </PopoverContent>
    </Popover>
  );
}

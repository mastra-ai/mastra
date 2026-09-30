import type { Actor, Provider } from '../cast';
import type { CardFacts, StoryState } from '../storyState';
import { laneRunsOn } from '../storyState';
import { SECURITY_REVIEW_STAGE } from '../storyBoards';

export type WorkflowStepKind = 'agent' | 'tool' | 'approval';

export type WorkflowStep = {
  kind: WorkflowStepKind;
  title: string;
  model?: string;
  provider?: Provider;
  pinned?: boolean;
  skills?: string[];
};

export type StoryWorkflow = {
  id: string;
  title: string;
  lanes: string[];
  trigger: string;
  steps: WorkflowStep[];
  source: 'config' | 'ui';
};

export const STORY_WORKFLOWS: StoryWorkflow[] = [
  {
    id: 'pull-request-checks',
    title: 'Pull request checks',
    lanes: ['review'],
    trigger: 'Card enters Review',
    steps: [
      { kind: 'tool', title: 'Run CI' },
      { kind: 'agent', title: 'Review the diff' },
      {
        kind: 'agent',
        title: 'Check the changeset',
        model: 'Haiku 4.5',
        provider: 'anthropic',
        pinned: true,
        skills: ['changeset'],
      },
      { kind: 'approval', title: 'Maintainer approves' },
    ],
    source: 'config',
  },
  {
    id: 'security-review',
    title: 'Security review',
    lanes: [SECURITY_REVIEW_STAGE],
    trigger: 'Card enters Security review',
    steps: [
      { kind: 'tool', title: 'Run tests' },
      {
        kind: 'agent',
        title: 'Security scan',
        model: 'DeepSeek V4',
        provider: 'deepseek',
        pinned: true,
        skills: ['security-checklist'],
      },
      { kind: 'approval', title: 'Human sign-off' },
    ],
    source: 'config',
  },
  {
    id: 'incident-triage',
    title: 'Incident triage',
    lanes: ['investigate'],
    trigger: 'Card enters Investigate',
    steps: [
      { kind: 'tool', title: 'Pull logs and alerts' },
      { kind: 'agent', title: 'Find the likely cause' },
      { kind: 'approval', title: 'On-call confirms' },
    ],
    source: 'config',
  },
  {
    id: 'postmortem-draft',
    title: 'Postmortem draft',
    lanes: ['postmortem'],
    trigger: 'Card enters Postmortem',
    steps: [{ kind: 'agent', title: 'Draft the postmortem', model: 'Opus 5.5', provider: 'anthropic', pinned: true }],
    source: 'ui',
  },
];

export const WORKFLOW_SOURCE_LABELS: Record<StoryWorkflow['source'], string> = {
  config: 'Defined in factory.config.ts',
  ui: 'Built on the Rules & workflows page',
};

export function workflowsOnLane(state: StoryState, stageId: string): StoryWorkflow[] {
  return state.workflows.filter(workflow => workflow.lanes.includes(stageId));
}

export function workflowRun(state: StoryState, card: CardFacts): { workflow: StoryWorkflow; stepIndex: number } | null {
  if (!card.workflow) return null;
  const workflow = state.workflows.find(candidate => candidate.id === card.workflow?.id);
  return workflow ? { workflow, stepIndex: card.workflow.stepIndex } : null;
}

export function onWorkflowLane(state: StoryState, card: CardFacts, stage: string): CardFacts {
  const run = workflowRun(state, card);
  return run && !run.workflow.lanes.includes(stage) ? { ...card, workflow: undefined } : card;
}

export function activePin(state: StoryState, card: CardFacts): CardFacts['pinned'] {
  if (card.pinned) return card.pinned;
  const run = workflowRun(state, card);
  const step = run?.workflow.steps[run.stepIndex];
  if (!run || !step?.pinned || !step.model || !step.provider) return undefined;
  return { model: step.model, provider: step.provider, step: `${run.workflow.title} workflow` };
}

export type StepPayer = Actor | 'card-owner';

export function laneStepPayer(state: StoryState, step: WorkflowStep, stage: string | undefined): StepPayer {
  if (step.pinned || laneRunsOn(state, stage) === 'shared') return 'factory';
  return 'card-owner';
}

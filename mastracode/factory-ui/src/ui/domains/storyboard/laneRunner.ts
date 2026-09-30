import type { StoryAgent } from './storyAgents';
import { agentById } from './storyAgents';
import { skillsOnLane } from './storySkills';
import type { StoryState } from './storyState';
import { laneRunsOn } from './storyState';
import type { StoryWorkflow } from './workflows/storyWorkflows';
import { workflowsOnLane } from './workflows/storyWorkflows';

export type ResolvedRunner =
  | { kind: 'skill'; skills: string[] }
  | { kind: 'agent'; agent: StoryAgent }
  | { kind: 'workflow'; workflow: StoryWorkflow };

export function runnerName(runner: ResolvedRunner): string {
  switch (runner.kind) {
    case 'skill':
      return `Default agent · ${runner.skills[0] ?? 'no skill'}`;
    case 'agent':
      return runner.agent.name;
    case 'workflow':
      return runner.workflow.title;
  }
}

export function resolveLaneRunner(state: StoryState, stageId: string): ResolvedRunner {
  const skill: ResolvedRunner = { kind: 'skill', skills: skillsOnLane(stageId).map(one => one.name) };
  if (laneRunsOn(state, stageId) === 'owner') return skill;
  const runner = state.laneRunners[stageId];
  if (runner?.kind === 'skill') return skill;
  if (runner?.kind === 'agent') {
    const agent = agentById(runner.agentId);
    return agent ? { kind: 'agent', agent } : skill;
  }
  const workflowId = runner?.kind === 'workflow' ? runner.workflowId : workflowsOnLane(state, stageId)[0]?.id;
  const workflow = state.workflows.find(candidate => candidate.id === workflowId);
  return workflow ? { kind: 'workflow', workflow } : skill;
}

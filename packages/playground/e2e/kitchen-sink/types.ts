export type Fixtures =
  | 'text-stream'
  | 'tool-stream'
  | 'workflow-stream'
  | 'om-observation-success'
  | 'om-observation-failed'
  | 'om-reflection'
  | 'om-shared-budget'
  | 'agent-builder-support'
  | 'agent-builder-standup'
  | 'agent-builder-pr-reviewer'
  | 'agent-builder-onboarding'
  | 'agent-builder-complex'
  | 'workflow-builder-lifecycle';

export type FixtureConfig = {
  name: Fixtures;
};

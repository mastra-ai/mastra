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
  | 'workflow-builder-lifecycle'
  | 'workflow-builder-prompt-addition'
  | 'workflow-builder-prompt-customer-ticket'
  | 'workflow-builder-prompt-parallel-customer-lookup'
  | 'workflow-builder-prompt-support-answer'
  | 'workflow-builder-prompt-nested-greeting'
  | 'workflow-builder-prompt-foreach-customer-lookup'
  | 'workflow-builder-prompt-priority-support-router'
  | 'workflow-builder-prompt-mixed-support-pipeline'
  | 'workflow-builder-adversarial-customer-ticket'
  | 'workflow-builder-adversarial-parallel-lookup'
  | 'workflow-builder-adversarial-priority-router'
  | 'workflow-builder-adversarial-mixed-pipeline';

export type FixtureConfig = {
  name: Fixtures;
};

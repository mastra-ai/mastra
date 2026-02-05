export type Fixtures =
  | 'text-stream'
  | 'tool-stream'
  | 'workflow-stream'
  | 'om-observation-success'
  | 'om-observation-failed'
  | 'om-reflection'
  | 'om-shared-budget';

export type FixtureConfig = {
  name: Fixtures;
};

export type Fixtures =
  | 'text-stream'
  | 'tool-stream'
  | 'workflow-stream'
  | 'om-observation-success'
  | 'om-observation-failed'
  | 'om-reflection'
  | 'om-adaptive-threshold';

export type FixtureConfig = {
  name: Fixtures;
};

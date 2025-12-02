declare type AnimationFrameID = number;
declare type TimeoutID = number;
declare type IntervalID = number;

interface ProcessEnv {
  NODE_ENV: 'development' | 'production';
}

interface Process {
  env: ProcessEnv;
}

declare const process: Process;

declare interface Window {
  '__@hello-pangea/dnd-disable-dev-warnings'?: boolean;
}

// From the test folder we explicitly set typescript to load node.
// From the stories folder @storybook/react load NodeJS types.
// See: https://github.com/storybookjs/storybook/issues/12969#issue-733867804
// Loading node can causes issues similar to what is mention below
// See: https://github.com/Microsoft/TypeScript/issues/842
// In order to fix the problem we override some node types
declare namespace NodeJS {
  declare type Timeout = TimeoutID;
}

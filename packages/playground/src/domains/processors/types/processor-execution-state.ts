import type { ExecuteProcessorResponse } from '@mastra/client-js';

export type ProcessorExecutionState =
  | { status: 'idle' }
  | { status: 'running' }
  | { status: 'complete'; response: ExecuteProcessorResponse }
  | { status: 'error'; message: string };

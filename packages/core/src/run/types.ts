export type RunStatus = 'created' | 'running' | 'completed' | 'failed';
export type Run = {
  runId?: string;
  runStatus?: RunStatus;
};

// Public surface: only types/constants. The workflow module is loaded via
// `await import('./workflow')` from inside `Mastra.__ensureHeartbeatWorkflowRegistered`
// to keep this barrel out of the `mastra → workflows/evented → agent` cycle.
export {
  HEARTBEAT_WORKFLOW_ID,
  HEARTBEAT_SCHEDULE_PREFIX,
  HeartbeatInputSchema,
  HeartbeatOutputSchema,
  HeartbeatBroadcastModeSchema,
  type HeartbeatInput,
  type HeartbeatOutput,
  type HeartbeatRunStatus,
  type SetHeartbeatOptions,
} from './types';
export {
  HEARTBEAT_BROADCAST_PROCESSOR_NAME,
  createHeartbeatBroadcastProcessor,
  type HeartbeatBroadcastMode,
} from './broadcast-processor';

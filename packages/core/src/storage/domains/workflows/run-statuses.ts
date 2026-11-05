import type { WorkflowRunStatus } from '../../../workflows';

// A Record so adding a status to WorkflowRunStatus fails to compile until it is listed here.
const WORKFLOW_RUN_STATUS_SET: Record<WorkflowRunStatus, true> = {
  running: true,
  success: true,
  failed: true,
  tripwire: true,
  suspended: true,
  waiting: true,
  pending: true,
  canceled: true,
  bailed: true,
  paused: true,
  skipped: true,
};

/** Every workflow run status. Internal to core: not re-exported from `@mastra/core/storage`. */
export const WORKFLOW_RUN_STATUSES = Object.keys(WORKFLOW_RUN_STATUS_SET) as readonly WorkflowRunStatus[];

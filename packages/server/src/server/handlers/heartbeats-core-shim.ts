/**
 * Safe re-export of heartbeat exports from `@mastra/core/agent`.
 *
 * The heartbeat constants and input schema land in `@mastra/core` alongside
 * the dedicated `/heartbeats` server surface. Older cores ship
 * `@mastra/core/agent` without these names — a direct named import would
 * fail at ESM link time when this version of `@mastra/server` is paired
 * with an older `@mastra/core`.
 *
 * A namespace import tolerates missing names. We expose the real value when
 * available and fall back to a clear runtime error otherwise — heartbeat
 * routes are unusable without new-core support anyway.
 *
 * Typed as `any` on purpose (see ./schedules-workflows-shim.ts for the same
 * rationale): keeps the emitted `.d.ts` free of names that don't exist in
 * older cores.
 */

import * as coreAgent from '@mastra/core/agent';

const exportedPrefix = (coreAgent as Record<string, unknown>).HEARTBEAT_SCHEDULE_PREFIX;
const exportedWorkflowId = (coreAgent as Record<string, unknown>).HEARTBEAT_WORKFLOW_ID;
const exportedInputSchema = (coreAgent as Record<string, unknown>).HeartbeatInputSchema;

export const HEARTBEAT_SCHEDULE_PREFIX: any = exportedPrefix ?? 'hb_';
export const HEARTBEAT_WORKFLOW_ID: any = exportedWorkflowId ?? '__mastra_heartbeat__';

export const HeartbeatInputSchema: any = exportedInputSchema ?? {
  parse: () => {
    throw new Error(
      '`HeartbeatInputSchema` is not available in this version of @mastra/core. ' +
        'Heartbeats require a newer @mastra/core.',
    );
  },
  safeParse: () => ({
    success: false,
    error: new Error(
      '`HeartbeatInputSchema` is not available in this version of @mastra/core. ' +
        'Heartbeats require a newer @mastra/core.',
    ),
  }),
};

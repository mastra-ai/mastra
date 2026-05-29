/**
 * Safe re-export of heartbeat constants from `@mastra/core/agent`.
 *
 * The heartbeat constants land in `@mastra/core` alongside the dedicated
 * `/heartbeats` server surface. Older cores ship `@mastra/core/agent`
 * without these names — a direct named import would fail at ESM link
 * time when this version of `@mastra/server` is paired with an older
 * `@mastra/core`. A namespace import tolerates missing names.
 *
 * Typed as `any` on purpose (see ./schedules-workflows-shim.ts for the
 * same rationale): keeps the emitted `.d.ts` free of names that don't
 * exist in older cores.
 */

import * as coreAgent from '@mastra/core/agent';

const exportedPrefix = (coreAgent as Record<string, unknown>).HEARTBEAT_SCHEDULE_PREFIX;

export const HEARTBEAT_SCHEDULE_PREFIX: any = exportedPrefix ?? 'hb_';

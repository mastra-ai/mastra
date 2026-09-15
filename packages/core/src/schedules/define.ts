import type { AgentSignalAttributes, AgentSignalType } from '../agent/signals';
import { ErrorCategory, ErrorDomain, MastraError } from '../error';
import { validateCron } from '../workflows/scheduler/cron';
import { SCHEDULE_SIGNAL_TYPES, SCHEDULE_STATUSES } from './types';
import type { ScheduleEffective, ScheduleIfActive, ScheduleIfIdle, ScheduleTriggerInfo } from './types';

/**
 * Stable schedule id prefix for schedules declared by a file-based agent's
 * `schedules/` directory.
 *
 * Deliberately distinct from every other prefix in the system:
 * - `agent_`    — imperative rows from `mastra.schedules.create({ agentId })`
 * - `schedule_` — imperative rows from `mastra.schedules.create({ workflowId })`
 * - `wf_`       — declarative rows from `createWorkflow({ schedule })`
 *
 * The boot-time sync sweeps orphaned `fsa_` rows against the schedules declared
 * on disk, so sharing a prefix with any of the above would make a redeploy
 * delete schedules this feature does not own.
 */
export const FS_AGENT_SCHEDULE_PREFIX = 'fsa_';

/** Context passed to a handler-mode schedule on every fire. */
export type AgentScheduleHandlerContext<TMastra = unknown> = {
  mastra: TMastra;
  /** The agent that owns this schedule. */
  agentId: string;
  /** Storage row id of the firing schedule (`fsa_<agent>__<path>`). */
  scheduleId: string;
  /** Path-derived identity of the schedule within the agent (e.g. `billing/sweep`). */
  key: string;
  trigger: ScheduleTriggerInfo;
};

/**
 * Return value from a handler-mode schedule.
 *
 * - object      → fire the agent with these fields merged over the row defaults
 * - `null`      → skip this fire entirely (recorded with outcome `skipped`)
 * - `undefined` → fire with the row defaults verbatim
 *
 * Channel delivery goes through `ifIdle.streamOptions.requestContext`, which the
 * worker rehydrates into a `RequestContext` before the woken run starts.
 */
export type AgentScheduleHandlerResult = Partial<ScheduleEffective>;

export type AgentScheduleHandler<TMastra = unknown> = (
  ctx: AgentScheduleHandlerContext<TMastra>,
) =>
  | Promise<AgentScheduleHandlerResult | null | undefined | void>
  | AgentScheduleHandlerResult
  | null
  | undefined
  | void;

/** Fields shared by both execution modes. */
type AgentScheduleCommon = {
  /** Standard five-field cron expression (e.g. `0 * * * *` for hourly). */
  cron: string;
  /** IANA timezone the cron is evaluated in. Defaults to the host timezone. */
  timezone?: string;
  /** Free-form label shown in Studio and filterable via `mastra.schedules.list({ name })`. */
  name?: string;
  /** Threaded schedules send a signal into this thread instead of starting a fresh run. */
  threadId?: string;
  /** Required when `threadId` is set. */
  resourceId?: string;
  /** Signal category for the fire. Defaults to `'notification'`. */
  signalType?: AgentSignalType;
  /** XML tag the signal renders as. Defaults to `'schedule'`. */
  tagName?: string;
  /** Attributes rendered onto the signal's XML tag. */
  attributes?: AgentSignalAttributes;
  /** Provider options merged into the schedule signal payload on every fire. JSON-safe. */
  providerOptions?: Record<string, unknown>;
  /** Options applied when the target thread is actively streaming. Threaded only. */
  ifActive?: ScheduleIfActive;
  /** Options applied when the target thread is idle. Threaded only. */
  ifIdle?: ScheduleIfIdle;
  /** Arbitrary metadata persisted alongside the schedule row. */
  metadata?: Record<string, unknown>;
  /** Lifecycle status the row is created with. Defaults to `'active'`. */
  status?: 'active' | 'paused';
};

/** Prompt mode: fire the owning agent with a fixed prompt. */
export type AgentSchedulePromptDefinition = AgentScheduleCommon & {
  prompt: string;
  handler?: never;
};

/**
 * Handler mode: compute the fire's parameters at trigger time, skip
 * conditionally by returning `null`, and route delivery through a channel by
 * returning request context.
 */
export type AgentScheduleHandlerDefinition<TMastra = unknown> = AgentScheduleCommon & {
  handler: AgentScheduleHandler<TMastra>;
  prompt?: never;
};

/**
 * A single schedule declared under `agents/<id>/schedules/`. Exactly one
 * execution mode — `prompt` or `handler` — must be set.
 */
export type AgentScheduleDefinition<TMastra = unknown> =
  | AgentSchedulePromptDefinition
  | AgentScheduleHandlerDefinition<TMastra>;

/**
 * A schedule definition paired with its path-derived identity, as attached to
 * an assembled file-based agent. `key` comes from the file's path relative to
 * `schedules/` with the extension stripped (`billing/sweep.ts` → `billing/sweep`).
 */
export type DeclaredAgentSchedule<TMastra = unknown> = {
  key: string;
  definition: AgentScheduleDefinition<TMastra>;
};

/**
 * Identity helper for a schedule declared under `agents/<id>/schedules/`.
 * Returns the definition unchanged after validating it, so authoring mistakes
 * surface at import time rather than on the first cron fire.
 *
 * @example
 * ```ts
 * // src/mastra/agents/support/schedules/heartbeat.ts
 * import { defineSchedule } from '@mastra/core/schedules';
 *
 * export default defineSchedule({
 *   cron: '0 9 * * *',
 *   prompt: 'Check system health and report any failures.',
 * });
 * ```
 */
export function defineSchedule<TMastra = unknown>(
  definition: AgentScheduleDefinition<TMastra>,
): AgentScheduleDefinition<TMastra> {
  assertValidScheduleDefinition(definition);
  return definition;
}

/**
 * Validate a schedule definition, throwing a `MastraError` naming the offending
 * schedule. Shared by `defineSchedule` (author-time) and file-based agent
 * assembly (build-time, where markdown schedules never went through
 * `defineSchedule`).
 *
 * `label` describes the schedule in error text — `defineSchedule` has no
 * identity to report, so assembly passes `agents/<id>/schedules/<key>`.
 */
export function assertValidScheduleDefinition(definition: AgentScheduleDefinition<any>, label?: string): void {
  const where = label ? ` (${label})` : '';

  if (!definition || typeof definition !== 'object') {
    throw new MastraError({
      id: 'SCHEDULES_INVALID_DEFINITION',
      domain: ErrorDomain.AGENT,
      category: ErrorCategory.USER,
      details: { label: label ?? '' },
      text: `Schedule${where}: expected a schedule definition object, received ${definition === null ? 'null' : typeof definition}.`,
    });
  }

  const hasPrompt = typeof definition.prompt === 'string' && definition.prompt.trim() !== '';
  const hasHandler = typeof definition.handler === 'function';

  if (hasPrompt && hasHandler) {
    throw new MastraError({
      id: 'SCHEDULES_AMBIGUOUS_MODE',
      domain: ErrorDomain.AGENT,
      category: ErrorCategory.USER,
      details: { label: label ?? '' },
      text: `Schedule${where}: set exactly one execution mode — remove either 'prompt' or 'handler'.`,
    });
  }

  if (!hasPrompt && !hasHandler) {
    throw new MastraError({
      id: 'SCHEDULES_MISSING_MODE',
      domain: ErrorDomain.AGENT,
      category: ErrorCategory.USER,
      details: { label: label ?? '' },
      text: `Schedule${where}: set exactly one execution mode — provide a non-empty 'prompt' or a 'handler' function.`,
    });
  }

  try {
    validateCron(definition.cron, definition.timezone);
  } catch (error) {
    throw new MastraError(
      {
        id: 'SCHEDULES_INVALID_CRON',
        domain: ErrorDomain.AGENT,
        category: ErrorCategory.USER,
        details: { label: label ?? '', cron: String(definition.cron) },
        text: `Schedule${where}: ${error instanceof Error ? error.message : String(error)}`,
      },
      error,
    );
  }

  // Markdown schedules never pass through TypeScript, so these enum-ish fields
  // are only checked here. An unchecked value would reach schedule storage and
  // surface as a confusing runtime failure on the first fire.
  if (definition.signalType !== undefined && !SCHEDULE_SIGNAL_TYPES.includes(definition.signalType)) {
    throw new MastraError({
      id: 'SCHEDULES_INVALID_SIGNAL_TYPE',
      domain: ErrorDomain.AGENT,
      category: ErrorCategory.USER,
      details: { label: label ?? '', signalType: String(definition.signalType) },
      text: `Schedule${where}: unknown signalType "${definition.signalType}". Expected one of: ${SCHEDULE_SIGNAL_TYPES.join(', ')}.`,
    });
  }

  if (definition.status !== undefined && !SCHEDULE_STATUSES.includes(definition.status)) {
    throw new MastraError({
      id: 'SCHEDULES_INVALID_STATUS',
      domain: ErrorDomain.AGENT,
      category: ErrorCategory.USER,
      details: { label: label ?? '', status: String(definition.status) },
      text: `Schedule${where}: unknown status "${definition.status}". Expected one of: ${SCHEDULE_STATUSES.join(', ')}.`,
    });
  }

  if (definition.threadId && !definition.resourceId) {
    throw new MastraError({
      id: 'SCHEDULES_MISSING_RESOURCE_ID',
      domain: ErrorDomain.AGENT,
      category: ErrorCategory.USER,
      details: { label: label ?? '' },
      text: `Schedule${where}: 'resourceId' is required when 'threadId' is set.`,
    });
  }
}

/**
 * Encode one component of a row id so it cannot contain the `__` delimiter.
 *
 * `encodeURIComponent` leaves `_` untouched, so escaping it explicitly is what
 * actually makes the delimiter unambiguous — otherwise an agent named `a__b`
 * and one named `a` with a key starting `_b` would produce the same row id.
 * `decodeURIComponent` reverses `%5F` for free.
 */
function encodeRowIdPart(value: string): string {
  return encodeURIComponent(value).replace(/_/g, '%5F');
}

/**
 * Build the storage row id for a schedule declared on a file-based agent.
 * Both components are encoded so an agent id or nested path containing the
 * `__` delimiter can never forge another schedule's row id.
 */
export function fsAgentScheduleRowId(agentId: string, key: string): string {
  return `${FS_AGENT_SCHEDULE_PREFIX}${encodeRowIdPart(agentId)}__${encodeRowIdPart(key)}`;
}

/**
 * Decode an `fsa_<agent>__<key>` row id back into its parts. Returns
 * `undefined` when the id isn't one of ours, so callers sweeping or resolving
 * schedule rows leave other schedule sources alone.
 */
export function parseFsAgentScheduleRowId(rowId: string): { agentId: string; key: string } | undefined {
  if (!rowId.startsWith(FS_AGENT_SCHEDULE_PREFIX)) return undefined;
  const rest = rowId.slice(FS_AGENT_SCHEDULE_PREFIX.length);
  const separator = rest.indexOf('__');
  if (separator <= 0) return undefined;
  try {
    return {
      agentId: decodeURIComponent(rest.slice(0, separator)),
      key: decodeURIComponent(rest.slice(separator + 2)),
    };
  } catch {
    return undefined;
  }
}

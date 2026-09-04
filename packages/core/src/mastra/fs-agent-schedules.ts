/**
 * Boot-time sync between the schedules a file-based agent declares on disk
 * (`agents/<id>/schedules/`) and the rows in schedule storage.
 *
 * Kept out of `mastra/index.ts` because none of it needs Mastra's private
 * state: it is a function of the registered agent map, the schedules store, and
 * a logger. `Mastra` keeps only the wiring — when to run this, and where the
 * store comes from.
 */
import type { Agent } from '../agent';
import type { IMastraLogger } from '../logger';
import { FS_AGENT_SCHEDULE_PREFIX, fsAgentScheduleRowId, parseFsAgentScheduleRowId } from '../schedules/define';
import type { AgentScheduleDefinition, AgentScheduleHandler, DeclaredAgentSchedule } from '../schedules/define';
import { metadataEqual, targetsEqual } from '../schedules/row-diff';
import type { Schedule, ScheduleUpdate, SchedulesStorage } from '../storage/domains/schedules/base';
import { computeNextFireAt } from '../workflows/scheduler';

/**
 * Mastra's registered agent map: registration key to agent. The key is not the
 * agent's `id` — schedules key off `agent.id`, because that is what the worker
 * resolves against at fire time.
 */
export type RegisteredAgents = Record<string, Agent<any>>;

/** One declared schedule resolved to the storage row it owns. */
export interface ResolvedFsAgentSchedule {
  scheduleId: string;
  agentId: string;
  key: string;
  definition: AgentScheduleDefinition;
}

/**
 * Two agents registered under different keys can still share an `id`, which
 * would map their schedules onto one row. The collector keeps the first and
 * reports the rest here so the caller can log once, at sync time, rather than
 * on every lookup.
 */
export interface FsAgentScheduleCollection {
  schedules: ResolvedFsAgentSchedule[];
  duplicates: Array<{ agentId: string; key: string }>;
}

/**
 * Reads the file-based schedules declared on a registered agent.
 *
 * Wrappers around an inner `Agent` (durable execution) delegate this
 * explicitly — see `DurableAgent.getDeclaredSchedules` — so there is nothing to
 * unwrap here. The optional call covers registrable shapes that are not
 * `Agent`s at all (`ToolLoopAgentLike`).
 */
export function declaredSchedulesOf(agent: unknown): DeclaredAgentSchedule[] {
  return (agent as { getDeclaredSchedules?: () => DeclaredAgentSchedule[] } | null)?.getDeclaredSchedules?.() ?? [];
}

/** True when any registered agent declares schedules on disk. */
export function hasFsAgentSchedule(agents: RegisteredAgents | undefined): boolean {
  return Object.values(agents ?? {}).some(agent => declaredSchedulesOf(agent).length > 0);
}

/**
 * Collect every declared schedule across the registered agents, keyed by
 * `fsa_<encoded(agentId)>__<encoded(key)>` so the prefix uniquely identifies
 * "all rows owned by this agent's schedules/ directory" even when ids contain
 * delimiter-like characters.
 *
 * Pure: duplicates are returned rather than logged, so callers that run per
 * fire don't re-emit the same warning forever.
 */
export function collectFsAgentSchedules(agents: RegisteredAgents | undefined): FsAgentScheduleCollection {
  const schedules: ResolvedFsAgentSchedule[] = [];
  const duplicates: Array<{ agentId: string; key: string }> = [];
  const seen = new Set<string>();

  for (const agent of Object.values(agents ?? {})) {
    // `agent.id` (not the registration key) is what `getAgentById` matches on,
    // and that's how the schedule worker resolves the target at fire time.
    for (const { key, definition } of declaredSchedulesOf(agent)) {
      const scheduleId = fsAgentScheduleRowId(agent.id, key);
      if (seen.has(scheduleId)) {
        duplicates.push({ agentId: agent.id, key });
        continue;
      }
      seen.add(scheduleId);
      schedules.push({ scheduleId, agentId: agent.id, key, definition });
    }
  }

  return { schedules, duplicates };
}

/**
 * Resolve the handler for a handler-mode file-based schedule. Handlers are
 * functions and therefore cannot be persisted on the JSON schedule row, so the
 * agent-schedule worker looks them up in-process by row id at fire time.
 *
 * The row id already encodes the agent and the key, so this decodes it and
 * reads that one agent rather than rebuilding the whole cross-agent collection
 * on every fire. When two agents share an id the first wins, matching
 * {@link collectFsAgentSchedules}.
 */
export function findFsAgentScheduleHandler<TMastra>(
  agents: RegisteredAgents | undefined,
  scheduleId: string,
): AgentScheduleHandler<TMastra> | undefined {
  const parsed = parseFsAgentScheduleRowId(scheduleId);
  if (!parsed) return undefined;

  // `find`, not a filter: the first agent with this id owns the row, matching
  // how the collector resolves a duplicate id.
  const owner = Object.values(agents ?? {}).find(agent => agent.id === parsed.agentId);
  const declared = declaredSchedulesOf(owner).find(entry => entry.key === parsed.key);
  const handler = declared?.definition.handler;

  return typeof handler === 'function' ? (handler as AgentScheduleHandler<TMastra>) : undefined;
}

/** Build the storage `target` for a declared schedule. */
function buildTarget(agentId: string, definition: AgentScheduleDefinition): Schedule['target'] {
  // Handler-mode schedules carry no stored prompt: the handler computes the
  // fire's parameters in-process at trigger time. Undefined fields drop out on
  // serialization, so they need no conditional spreads.
  return {
    type: 'agent',
    agentId,
    prompt: definition.prompt ?? '',
    name: definition.name,
    threadId: definition.threadId,
    resourceId: definition.resourceId,
    signalType: definition.signalType,
    tagName: definition.tagName,
    attributes: definition.attributes,
    providerOptions: definition.providerOptions,
    ifActive: definition.ifActive,
    ifIdle: definition.ifIdle,
  };
}

export interface SyncFsAgentSchedulesOptions {
  agents: RegisteredAgents | undefined;
  store: SchedulesStorage;
  logger?: IMastraLogger;
  /**
   * Rows already read by the caller, reused for both the upsert diff and the
   * orphan sweep instead of a second `listSchedules()` pass.
   */
  knownRows?: Schedule[];
}

/**
 * Sync schedules declared by file-based agents' `schedules/` directories into
 * schedule storage.
 *
 * Mirrors the declarative workflow sync: upsert declared rows, diff the config
 * fields and patch what changed, leave `status` alone so an out-of-band pause
 * survives a redeploy, and delete orphaned `fsa_` rows that code no longer
 * declares. Rows created imperatively through `mastra.schedules.create(...)`
 * use the `agent_` prefix and are never touched here.
 */
export async function syncFsAgentSchedules({
  agents,
  store,
  logger,
  knownRows,
}: SyncFsAgentSchedulesOptions): Promise<void> {
  const { schedules: declared, duplicates } = collectFsAgentSchedules(agents);

  for (const { agentId, key } of duplicates) {
    logger?.warn(
      `Duplicate schedule "${key}" for agent id "${agentId}": two registered agents share that id. Keeping the first and ignoring the rest.`,
    );
  }

  const declaredIds = new Set(declared.map(d => d.scheduleId));

  // One read for both the upsert diff and the orphan sweep, instead of a
  // `getSchedule` round-trip per declared schedule on every boot.
  const allRows = knownRows ?? (await store.listSchedules());
  const rowsById = new Map(allRows.map(row => [row.id, row]));

  for (const { scheduleId, agentId, key, definition } of declared) {
    try {
      const now = Date.now();
      const target = buildTarget(agentId, definition);
      const existing = rowsById.get(scheduleId);

      if (!existing) {
        await store.createSchedule({
          id: scheduleId,
          target,
          cron: definition.cron,
          timezone: definition.timezone,
          status: definition.status ?? 'active',
          nextFireAt: computeNextFireAt(definition.cron, { timezone: definition.timezone, after: now }),
          createdAt: now,
          updatedAt: now,
          metadata: definition.metadata,
          ownerType: 'agent',
          ownerId: agentId,
        });
        continue;
      }

      const patch: ScheduleUpdate = {};
      const cronChanged = existing.cron !== definition.cron;
      const timezoneChanged = (existing.timezone ?? undefined) !== (definition.timezone ?? undefined);

      if (cronChanged) patch.cron = definition.cron;
      if (timezoneChanged) patch.timezone = definition.timezone;
      if (!targetsEqual(existing.target, target)) patch.target = target;
      if (!metadataEqual(existing.metadata, definition.metadata)) patch.metadata = definition.metadata;

      // Cron or timezone change invalidates the stored nextFireAt — recompute
      // from now so we don't fire on the old schedule.
      if (cronChanged || timezoneChanged) {
        patch.nextFireAt = computeNextFireAt(definition.cron, { timezone: definition.timezone, after: now });
      }

      if (Object.keys(patch).length > 0) {
        await store.updateSchedule(scheduleId, patch);
      }
    } catch (error) {
      logger?.error('Failed to register file-based agent schedule', { scheduleId, agentId, key, error });
    }
  }

  // Orphan deletion: drop `fsa_` rows whose owning agent is registered here but
  // no longer declares that schedule — a file deleted or renamed.
  //
  // Scoped to agents registered in THIS process on purpose. A process holding
  // only a subset of the agents (a standalone worker, a partial registry after
  // a failed import) must not delete another agent's schedules. Rows whose
  // agent is gone from the project entirely are already self-healing: the
  // agent-schedule worker deletes a row when it can't resolve the target
  // (`agent-missing` → `selfClean`), so nothing is left firing forever.
  const registeredAgentIds = new Set(Object.values(agents ?? {}).map(a => a.id));
  for (const row of allRows) {
    if (declaredIds.has(row.id)) continue;
    if (!row.id.startsWith(FS_AGENT_SCHEDULE_PREFIX)) continue;
    const ownerAgentId = parseFsAgentScheduleRowId(row.id)?.agentId;
    if (!ownerAgentId || !registeredAgentIds.has(ownerAgentId)) continue;
    try {
      await store.deleteSchedule(row.id);
    } catch (error) {
      logger?.error('Failed to delete orphaned file-based agent schedule', {
        scheduleId: row.id,
        agentId: ownerAgentId,
        error,
      });
    }
  }
}

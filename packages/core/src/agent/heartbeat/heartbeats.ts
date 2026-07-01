import { randomUUID } from 'node:crypto';
import slugify from '@sindresorhus/slugify';
import { ErrorCategory, ErrorDomain, MastraError } from '../../error';
import type { Mastra } from '../../mastra';
import type { Schedule } from '../../storage/domains/schedules/base';
import { computeNextFireAt, validateCron } from '../../workflows/scheduler/cron';
import type { AgentSignalAttributes, AgentSignalType } from '../signals';
import type { HeartbeatIfActive, HeartbeatIfIdle } from './types';
import { HEARTBEAT_SCHEDULE_PREFIX } from './types';

type HeartbeatTarget = Extract<Schedule['target'], { type: 'heartbeat' }>;

/**
 * Slugify the caller-facing portion of a heartbeat id into the canonical
 * `hb_<slug>` shape. The slug part is lowercased and stripped of characters
 * that are unsafe in storage keys / URLs; the `hb_` prefix is added only if
 * missing so a caller can pass either `nightly-summary` or
 * `hb_nightly-summary` and get the same canonical id. Returns an empty string
 * when nothing slug-able remains.
 */
function canonicalizeHeartbeatId(rawId: string): string {
  const trimmed = rawId.trim();
  const withoutPrefix = trimmed.startsWith(HEARTBEAT_SCHEDULE_PREFIX)
    ? trimmed.slice(HEARTBEAT_SCHEDULE_PREFIX.length)
    : trimmed;
  const slug = slugify(withoutPrefix);
  if (!slug) return '';
  return `${HEARTBEAT_SCHEDULE_PREFIX}${slug}`;
}

/**
 * Normalize a caller-supplied heartbeat id for `create`. Throws
 * `HEARTBEATS_INVALID_ID` when the id is empty after normalization so callers
 * cannot create an unaddressable heartbeat.
 */
function normalizeHeartbeatId(rawId: string): string {
  const canonical = canonicalizeHeartbeatId(rawId);
  if (!canonical) {
    throw new MastraError({
      id: 'HEARTBEATS_INVALID_ID',
      domain: ErrorDomain.AGENT,
      category: ErrorCategory.USER,
      text: `createHeartbeat: id "${rawId}" is empty after normalization. Provide an id with at least one alphanumeric character.`,
    });
  }
  return canonical;
}

/**
 * Resolve a caller-supplied heartbeat id for read / mutate lookups so callers
 * can pass the id in whichever form they used at create time.
 *
 * An id that already carries the `hb_` prefix is treated as a fully-formed
 * stored id and returned verbatim — re-slugifying it would mangle characters
 * `create` already accepted (e.g. underscores), making the heartbeat
 * unaddressable. A bare caller id is canonicalized to `hb_<slug>` to match what
 * `create` persisted; when nothing slug-able remains the raw id is returned so
 * the caller gets a `not found` rather than a surprise match.
 */
function resolveHeartbeatId(rawId: string): string {
  const trimmed = rawId.trim();
  if (trimmed.startsWith(HEARTBEAT_SCHEDULE_PREFIX)) return trimmed;
  return canonicalizeHeartbeatId(trimmed) || rawId;
}

/**
 * Flat heartbeat view returned by the {@link Heartbeats} service. Projects
 * the underlying `Schedule` row + `target.type === 'heartbeat'` payload
 * onto a single object so callers never have to know about the schedules
 * storage shape.
 */
export interface Heartbeat {
  id: string;
  agentId: string;
  name?: string;
  threadId?: string;
  resourceId?: string;
  prompt: string;
  cron: string;
  timezone?: string;
  status: 'active' | 'paused';
  nextFireAt: number;
  lastFireAt?: number;
  lastRunId?: string;
  signalType?: AgentSignalType;
  tagName?: string;
  attributes?: AgentSignalAttributes;
  providerOptions?: Record<string, unknown>;
  ifActive?: HeartbeatIfActive;
  ifIdle?: HeartbeatIfIdle;
  metadata?: Record<string, unknown>;
  createdAt: number;
  updatedAt: number;
}

/** Input to {@link Heartbeats.create}. */
export interface CreateHeartbeatInput {
  /**
   * Optional stable id. Normalized to `hb_<slug>` (the `hb_` prefix is added
   * if missing and the rest is slugified). When omitted, a random
   * `hb_<uuid>` id is generated. Creating a heartbeat with an id that already
   * exists throws.
   */
  id?: string;
  agentId: string;
  cron: string;
  prompt: string;
  /** Optional free-form label for distinguishing multiple heartbeats on the same agent/thread. */
  name?: string;
  timezone?: string;
  threadId?: string;
  resourceId?: string;
  /** Signal category for the fire. Defaults to `'notification'`. */
  signalType?: AgentSignalType;
  /** XML tag the signal renders as. Defaults to `'heartbeat'` (so a fire surfaces as `<heartbeat>…</heartbeat>`). */
  tagName?: string;
  /** Attributes rendered onto the signal's XML tag. */
  attributes?: AgentSignalAttributes;
  /** Provider options merged into the heartbeat signal payload on every fire. JSON-safe. */
  providerOptions?: Record<string, unknown>;
  ifActive?: HeartbeatIfActive;
  ifIdle?: HeartbeatIfIdle;
  metadata?: Record<string, unknown>;
  /** Schedule lifecycle status. Defaults to `'active'`. */
  status?: 'active' | 'paused';
}

/** Patch input to {@link Heartbeats.update}. */
export interface UpdateHeartbeatInput {
  cron?: string;
  timezone?: string;
  prompt?: string;
  name?: string;
  signalType?: AgentSignalType;
  tagName?: string;
  attributes?: AgentSignalAttributes;
  providerOptions?: Record<string, unknown>;
  ifActive?: HeartbeatIfActive;
  ifIdle?: HeartbeatIfIdle;
  metadata?: Record<string, unknown>;
  status?: 'active' | 'paused';
}

/** Filter for {@link Heartbeats.list}. */
export interface ListHeartbeatsFilter {
  agentId?: string;
  threadId?: string;
  resourceId?: string;
  name?: string;
}

/**
 * Canonical service for the heartbeat use case. Heartbeats are persisted as
 * `Schedule` rows with `target.type === 'heartbeat'`; this class is a typed
 * projection over `SchedulesStorage` that knows how to build the target,
 * filter by `target.type`, and surface the heartbeat-specific fields on a
 * flat {@link Heartbeat} view.
 *
 * Use via `mastra.heartbeats` (the canonical CRUD surface). To scope to a
 * single agent, pass `agentId` to `create` / `list`.
 */
export class Heartbeats {
  #mastra: Mastra;

  constructor(mastra: Mastra) {
    this.#mastra = mastra;
  }

  async #getStore() {
    const storage = this.#mastra.getStorage();
    const store = await storage?.getStore('schedules');
    if (!store) {
      throw new MastraError({
        id: 'HEARTBEATS_NO_SCHEDULES_STORAGE',
        domain: ErrorDomain.AGENT,
        category: ErrorCategory.USER,
        text: 'Heartbeats require a storage adapter that implements the schedules domain.',
      });
    }
    return store;
  }

  async create(input: CreateHeartbeatInput): Promise<Heartbeat> {
    validateCron(input.cron, input.timezone);

    if (!input.agentId) {
      throw new MastraError({
        id: 'HEARTBEATS_MISSING_AGENT_ID',
        domain: ErrorDomain.AGENT,
        category: ErrorCategory.USER,
        text: 'createHeartbeat requires `agentId`.',
      });
    }

    if (input.threadId && !input.resourceId) {
      throw new MastraError({
        id: 'HEARTBEATS_MISSING_RESOURCE_ID',
        domain: ErrorDomain.AGENT,
        category: ErrorCategory.USER,
        text: 'createHeartbeat requires `resourceId` when `threadId` is set.',
      });
    }
    if (!input.threadId) {
      const offenders: string[] = [];
      if (input.signalType !== undefined) offenders.push('signalType');
      if (input.ifActive !== undefined) offenders.push('ifActive');
      if (input.ifIdle !== undefined) offenders.push('ifIdle');
      if (input.resourceId !== undefined) offenders.push('resourceId');
      if (offenders.length > 0) {
        throw new MastraError({
          id: 'HEARTBEATS_THREADLESS_OPTIONS',
          domain: ErrorDomain.AGENT,
          category: ErrorCategory.USER,
          text: `createHeartbeat: ${offenders.join(', ')} require a threadId.`,
        });
      }
    }

    const store = await this.#getStore();
    // Make sure the scheduler + heartbeat worker are running. Boot-time
    // detection covers existing rows; imperative creates after
    // startWorkers() need to flip the request flag and lazily inject.
    await this.#mastra.__ensureHeartbeatRuntimeReady();

    const id = input.id !== undefined ? normalizeHeartbeatId(input.id) : `${HEARTBEAT_SCHEDULE_PREFIX}${randomUUID()}`;
    if (input.id !== undefined) {
      const existing = await store.getSchedule(id);
      if (existing) {
        throw new MastraError({
          id: 'HEARTBEATS_ID_EXISTS',
          domain: ErrorDomain.AGENT,
          category: ErrorCategory.USER,
          text: `createHeartbeat: a heartbeat with id "${id}" already exists. Use update() to modify it or choose a different id.`,
        });
      }
    }
    const now = Date.now();
    const nextFireAt = computeNextFireAt(input.cron, { timezone: input.timezone, after: now });

    const target: HeartbeatTarget = {
      type: 'heartbeat',
      agentId: input.agentId,
      prompt: input.prompt,
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.threadId ? { threadId: input.threadId } : {}),
      ...(input.resourceId ? { resourceId: input.resourceId } : {}),
      ...(input.signalType ? { signalType: input.signalType } : {}),
      ...(input.tagName ? { tagName: input.tagName } : {}),
      ...(input.attributes ? { attributes: input.attributes } : {}),
      ...(input.providerOptions ? { providerOptions: input.providerOptions } : {}),
      ...(input.ifActive ? { ifActive: input.ifActive } : {}),
      ...(input.ifIdle ? { ifIdle: input.ifIdle } : {}),
    };

    const schedule: Schedule = {
      id,
      target,
      cron: input.cron,
      timezone: input.timezone,
      status: input.status ?? 'active',
      nextFireAt,
      createdAt: now,
      updatedAt: now,
      ownerType: 'agent',
      ownerId: input.agentId,
      ...(input.metadata ? { metadata: input.metadata } : {}),
    };

    const created = await store.createSchedule(schedule);
    return toHeartbeat(created)!;
  }

  async get(id: string): Promise<Heartbeat | null> {
    const store = await this.#getStore();
    const resolvedId = resolveHeartbeatId(id);
    const schedule = await store.getSchedule(resolvedId);
    if (!schedule) return null;
    return toHeartbeat(schedule);
  }

  async list(filter?: ListHeartbeatsFilter): Promise<Heartbeat[]> {
    const store = await this.#getStore();
    const schedules = await store.listSchedules({
      ownerType: 'agent',
      ...(filter?.agentId ? { ownerId: filter.agentId } : {}),
    });
    const heartbeats = schedules.map(toHeartbeat).filter((h): h is Heartbeat => h !== null);
    return heartbeats.filter(h => {
      if (filter?.threadId !== undefined && h.threadId !== filter.threadId) return false;
      if (filter?.resourceId !== undefined && h.resourceId !== filter.resourceId) return false;
      if (filter?.name !== undefined && h.name !== filter.name) return false;
      return true;
    });
  }

  async update(id: string, patch: UpdateHeartbeatInput): Promise<Heartbeat> {
    const store = await this.#getStore();
    const resolvedId = resolveHeartbeatId(id);
    const existing = await store.getSchedule(resolvedId);
    if (!existing || existing.target?.type !== 'heartbeat') {
      throw new MastraError({
        id: 'HEARTBEATS_NOT_FOUND',
        domain: ErrorDomain.AGENT,
        category: ErrorCategory.USER,
        text: `Heartbeat "${id}" not found.`,
      });
    }

    const nextCron = patch.cron ?? existing.cron;
    const nextTimezone = patch.timezone !== undefined ? patch.timezone : existing.timezone;
    if (patch.cron !== undefined || patch.timezone !== undefined) {
      validateCron(nextCron, nextTimezone);
    }

    const existingTarget = existing.target as HeartbeatTarget;

    // Threadless heartbeats run `agent.generate` in isolation, so thread-scoped
    // signal options are meaningless and would be silently ignored on every
    // fire. `create()` rejects them upfront; mirror that here so `update()`
    // can't sneak the same invalid state onto a threadless heartbeat after the
    // fact. `threadId`/`resourceId` are not patchable, so the thread-ness of a
    // heartbeat is fixed at create time.
    if (!existingTarget.threadId) {
      const offenders: string[] = [];
      if (patch.signalType !== undefined) offenders.push('signalType');
      if (patch.ifActive !== undefined) offenders.push('ifActive');
      if (patch.ifIdle !== undefined) offenders.push('ifIdle');
      if (offenders.length > 0) {
        throw new MastraError({
          id: 'HEARTBEATS_THREADLESS_OPTIONS',
          domain: ErrorDomain.AGENT,
          category: ErrorCategory.USER,
          text: `updateHeartbeat: ${offenders.join(', ')} require a threadId.`,
        });
      }
    }

    const nextTarget: HeartbeatTarget = {
      ...existingTarget,
      ...(patch.prompt !== undefined ? { prompt: patch.prompt } : {}),
      ...(patch.name !== undefined ? { name: patch.name } : {}),
      ...(patch.signalType !== undefined ? { signalType: patch.signalType } : {}),
      ...(patch.tagName !== undefined ? { tagName: patch.tagName } : {}),
      ...(patch.attributes !== undefined ? { attributes: patch.attributes } : {}),
      ...(patch.providerOptions !== undefined ? { providerOptions: patch.providerOptions } : {}),
      ...(patch.ifActive !== undefined ? { ifActive: patch.ifActive } : {}),
      ...(patch.ifIdle !== undefined ? { ifIdle: patch.ifIdle } : {}),
    };

    // Recompute the next fire when the cadence changes OR when this patch
    // resumes a paused heartbeat. Resuming must follow the same semantics as
    // resume(): a paused row carries a stale nextFireAt (often in the past),
    // so flipping status back to 'active' without recomputing would trigger
    // an immediate spurious fire instead of waiting for the next cron tick.
    const resuming = patch.status === 'active' && existing.status === 'paused';
    const nextFireAt =
      patch.cron !== undefined || patch.timezone !== undefined || resuming
        ? computeNextFireAt(nextCron, { timezone: nextTimezone, after: Date.now() })
        : undefined;

    const updated = await store.updateSchedule(resolvedId, {
      ...(patch.cron !== undefined ? { cron: patch.cron } : {}),
      ...(patch.timezone !== undefined ? { timezone: patch.timezone } : {}),
      target: nextTarget,
      ...(nextFireAt !== undefined ? { nextFireAt } : {}),
      ...(patch.metadata !== undefined ? { metadata: patch.metadata } : {}),
      ...(patch.status !== undefined ? { status: patch.status } : {}),
    });
    return toHeartbeat(updated)!;
  }

  async delete(id: string): Promise<void> {
    const store = await this.#getStore();
    const resolvedId = resolveHeartbeatId(id);
    const existing = await store.getSchedule(resolvedId);
    if (!existing) return;
    if (existing.target?.type !== 'heartbeat') {
      throw new MastraError({
        id: 'HEARTBEATS_NOT_A_HEARTBEAT',
        domain: ErrorDomain.AGENT,
        category: ErrorCategory.USER,
        text: `Schedule "${id}" is not a heartbeat.`,
      });
    }
    await store.deleteSchedule(resolvedId);
  }

  async pause(id: string): Promise<Heartbeat> {
    const store = await this.#getStore();
    const resolvedId = resolveHeartbeatId(id);
    const existing = await store.getSchedule(resolvedId);
    if (!existing || existing.target?.type !== 'heartbeat') {
      throw new MastraError({
        id: 'HEARTBEATS_NOT_FOUND',
        domain: ErrorDomain.AGENT,
        category: ErrorCategory.USER,
        text: `Heartbeat "${id}" not found.`,
      });
    }
    if (existing.status === 'paused') return toHeartbeat(existing)!;
    const updated = await store.updateSchedule(resolvedId, { status: 'paused' });
    return toHeartbeat(updated)!;
  }

  async resume(id: string): Promise<Heartbeat> {
    const store = await this.#getStore();
    const resolvedId = resolveHeartbeatId(id);
    const existing = await store.getSchedule(resolvedId);
    if (!existing || existing.target?.type !== 'heartbeat') {
      throw new MastraError({
        id: 'HEARTBEATS_NOT_FOUND',
        domain: ErrorDomain.AGENT,
        category: ErrorCategory.USER,
        text: `Heartbeat "${id}" not found.`,
      });
    }
    if (existing.status === 'active') return toHeartbeat(existing)!;
    const nextFireAt = computeNextFireAt(existing.cron, {
      timezone: existing.timezone,
      after: Date.now(),
    });
    const updated = await store.updateSchedule(resolvedId, { status: 'active', nextFireAt });
    return toHeartbeat(updated)!;
  }

  async run(id: string): Promise<{ scheduleId: string; claimId: string; scheduledFireAt: number }> {
    const store = await this.#getStore();
    const resolvedId = resolveHeartbeatId(id);
    const existing = await store.getSchedule(resolvedId);
    if (!existing || existing.target?.type !== 'heartbeat') {
      throw new MastraError({
        id: 'HEARTBEATS_NOT_FOUND',
        domain: ErrorDomain.AGENT,
        category: ErrorCategory.USER,
        text: `Heartbeat "${id}" not found.`,
      });
    }
    const target = existing.target as HeartbeatTarget;
    const now = Date.now();
    const claimId = `manual_${existing.id}_${now}`;
    await this.#mastra.pubsub.publish('heartbeats', {
      type: 'heartbeat.fire',
      runId: claimId,
      data: {
        scheduleId: existing.id,
        claimId,
        scheduledFireAt: now,
        target,
        triggerKind: 'manual',
      },
    });
    return { scheduleId: existing.id, claimId, scheduledFireAt: now };
  }
}

/**
 * Project a `Schedule` row to a flat {@link Heartbeat} view. Returns `null`
 * when the schedule is not a heartbeat (`target.type !== 'heartbeat'`),
 * allowing callers to filter mixed result sets in one pass.
 */
export function toHeartbeat(schedule: Schedule): Heartbeat | null {
  if (schedule.target?.type !== 'heartbeat') return null;
  const target = schedule.target as HeartbeatTarget;
  return {
    id: schedule.id,
    agentId: target.agentId,
    ...(target.name !== undefined ? { name: target.name } : {}),
    ...(target.threadId ? { threadId: target.threadId } : {}),
    ...(target.resourceId ? { resourceId: target.resourceId } : {}),
    prompt: target.prompt,
    cron: schedule.cron,
    ...(schedule.timezone ? { timezone: schedule.timezone } : {}),
    status: schedule.status,
    nextFireAt: schedule.nextFireAt,
    ...(schedule.lastFireAt !== undefined ? { lastFireAt: schedule.lastFireAt } : {}),
    ...(schedule.lastRunId ? { lastRunId: schedule.lastRunId } : {}),
    ...(target.signalType ? { signalType: target.signalType } : {}),
    ...(target.tagName ? { tagName: target.tagName } : {}),
    ...(target.attributes ? { attributes: target.attributes } : {}),
    ...(target.providerOptions ? { providerOptions: target.providerOptions } : {}),
    ...(target.ifActive ? { ifActive: target.ifActive } : {}),
    ...(target.ifIdle ? { ifIdle: target.ifIdle } : {}),
    ...(schedule.metadata ? { metadata: schedule.metadata } : {}),
    createdAt: schedule.createdAt,
    updatedAt: schedule.updatedAt,
  };
}

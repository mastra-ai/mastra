import { randomUUID } from 'node:crypto';
import { ErrorCategory, ErrorDomain, MastraError } from '../../error';
import type { Mastra } from '../../mastra';
import type { Schedule } from '../../storage/domains/schedules/base';
import { computeNextFireAt, validateCron } from '../../workflows/scheduler/cron';
import type { AgentSignalType } from '../signals';
import type { HeartbeatActiveHours, HeartbeatBroadcastMode, HeartbeatIfActive, HeartbeatIfIdle } from './types';
import { HEARTBEAT_SCHEDULE_PREFIX } from './types';

type HeartbeatTarget = Extract<Schedule['target'], { type: 'heartbeat' }>;

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
  ifActive?: HeartbeatIfActive;
  ifIdle?: HeartbeatIfIdle;
  activeHours?: HeartbeatActiveHours;
  idleThresholdMs?: number;
  broadcast?: HeartbeatBroadcastMode;
  metadata?: Record<string, unknown>;
  createdAt: number;
  updatedAt: number;
}

/** Input to {@link Heartbeats.create}. */
export interface CreateHeartbeatInput {
  agentId: string;
  cron: string;
  prompt: string;
  /** Optional free-form label for distinguishing multiple heartbeats on the same agent/thread. */
  name?: string;
  timezone?: string;
  threadId?: string;
  resourceId?: string;
  signalType?: AgentSignalType;
  ifActive?: HeartbeatIfActive;
  ifIdle?: HeartbeatIfIdle;
  activeHours?: HeartbeatActiveHours;
  idleThresholdMs?: number;
  broadcast?: HeartbeatBroadcastMode;
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
  ifActive?: HeartbeatIfActive;
  ifIdle?: HeartbeatIfIdle;
  activeHours?: HeartbeatActiveHours;
  idleThresholdMs?: number;
  broadcast?: HeartbeatBroadcastMode;
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
      if (input.idleThresholdMs !== undefined) offenders.push('idleThresholdMs');
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

    const id = `${HEARTBEAT_SCHEDULE_PREFIX}${randomUUID()}`;
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
      ...(input.ifActive ? { ifActive: input.ifActive } : {}),
      ...(input.ifIdle ? { ifIdle: input.ifIdle } : {}),
      ...(input.activeHours ? { activeHours: input.activeHours } : {}),
      ...(input.idleThresholdMs !== undefined ? { idleThresholdMs: input.idleThresholdMs } : {}),
      ...(input.broadcast ? { broadcast: input.broadcast } : {}),
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
    const schedule = await store.getSchedule(id);
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
    const existing = await store.getSchedule(id);
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
    const nextTarget: HeartbeatTarget = {
      ...existingTarget,
      ...(patch.prompt !== undefined ? { prompt: patch.prompt } : {}),
      ...(patch.name !== undefined ? { name: patch.name } : {}),
      ...(patch.signalType !== undefined ? { signalType: patch.signalType } : {}),
      ...(patch.ifActive !== undefined ? { ifActive: patch.ifActive } : {}),
      ...(patch.ifIdle !== undefined ? { ifIdle: patch.ifIdle } : {}),
      ...(patch.activeHours !== undefined ? { activeHours: patch.activeHours } : {}),
      ...(patch.idleThresholdMs !== undefined ? { idleThresholdMs: patch.idleThresholdMs } : {}),
      ...(patch.broadcast !== undefined ? { broadcast: patch.broadcast } : {}),
    };

    const nextFireAt =
      patch.cron !== undefined || patch.timezone !== undefined
        ? computeNextFireAt(nextCron, { timezone: nextTimezone, after: Date.now() })
        : undefined;

    const updated = await store.updateSchedule(id, {
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
    const existing = await store.getSchedule(id);
    if (!existing) return;
    if (existing.target?.type !== 'heartbeat') {
      throw new MastraError({
        id: 'HEARTBEATS_NOT_A_HEARTBEAT',
        domain: ErrorDomain.AGENT,
        category: ErrorCategory.USER,
        text: `Schedule "${id}" is not a heartbeat.`,
      });
    }
    await store.deleteSchedule(id);
  }

  async pause(id: string): Promise<Heartbeat> {
    const store = await this.#getStore();
    const existing = await store.getSchedule(id);
    if (!existing || existing.target?.type !== 'heartbeat') {
      throw new MastraError({
        id: 'HEARTBEATS_NOT_FOUND',
        domain: ErrorDomain.AGENT,
        category: ErrorCategory.USER,
        text: `Heartbeat "${id}" not found.`,
      });
    }
    if (existing.status === 'paused') return toHeartbeat(existing)!;
    const updated = await store.updateSchedule(id, { status: 'paused' });
    return toHeartbeat(updated)!;
  }

  async resume(id: string): Promise<Heartbeat> {
    const store = await this.#getStore();
    const existing = await store.getSchedule(id);
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
    const updated = await store.updateSchedule(id, { status: 'active', nextFireAt });
    return toHeartbeat(updated)!;
  }

  async run(id: string): Promise<{ scheduleId: string; claimId: string; scheduledFireAt: number }> {
    const store = await this.#getStore();
    const existing = await store.getSchedule(id);
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
    ...(target.ifActive ? { ifActive: target.ifActive } : {}),
    ...(target.ifIdle ? { ifIdle: target.ifIdle } : {}),
    ...(target.activeHours ? { activeHours: target.activeHours } : {}),
    ...(target.idleThresholdMs !== undefined ? { idleThresholdMs: target.idleThresholdMs } : {}),
    ...(target.broadcast ? { broadcast: target.broadcast } : {}),
    ...(schedule.metadata ? { metadata: schedule.metadata } : {}),
    createdAt: schedule.createdAt,
    updatedAt: schedule.updatedAt,
  };
}

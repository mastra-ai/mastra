import slugify from '@sindresorhus/slugify';
import type { AgentSignalAttributes, AgentSignalType } from '../agent/signals';
import { ErrorCategory, ErrorDomain, MastraError } from '../error';
import type { Mastra } from '../mastra';
import type { Schedule, SchedulesStorage } from '../storage/domains/schedules/base';
import { computeNextFireAt, validateCron } from '../workflows/scheduler/cron';
import type { ScheduleIfActive, ScheduleIfIdle } from './types';
import { AGENT_SCHEDULE_PREFIX, WORKFLOW_SCHEDULE_PREFIX } from './types';

type AgentTarget = Extract<Schedule['target'], { type: 'agent' }>;
type WorkflowTarget = Extract<Schedule['target'], { type: 'workflow' }>;

/** PubSub topic consumed by the workflow event processor. */
const TOPIC_WORKFLOWS = 'workflows';

/**
 * Slugify the caller-facing portion of a schedule id into a canonical
 * `<prefix><slug>` shape. The slug part is lowercased and stripped of
 * characters that are unsafe in storage keys / URLs; the prefix is added only
 * if missing so a caller can pass either `nightly-summary` or
 * `agent_nightly-summary` and get the same canonical id. Returns an empty
 * string when nothing slug-able remains.
 */
function canonicalizeScheduleId(rawId: string, prefix: string): string {
  const trimmed = rawId.trim();
  const withoutPrefix = trimmed.startsWith(prefix) ? trimmed.slice(prefix.length) : trimmed;
  const slug = slugify(withoutPrefix);
  if (!slug) return '';
  return `${prefix}${slug}`;
}

/**
 * Normalize a caller-supplied schedule id for `create`. Throws
 * `SCHEDULES_INVALID_ID` when the id is empty after normalization so callers
 * cannot create an unaddressable schedule.
 */
function normalizeScheduleId(rawId: string, prefix: string): string {
  const canonical = canonicalizeScheduleId(rawId, prefix);
  if (!canonical) {
    throw new MastraError({
      id: 'SCHEDULES_INVALID_ID',
      domain: ErrorDomain.AGENT,
      category: ErrorCategory.USER,
      text: `schedules.create: id "${rawId}" is empty after normalization. Provide an id with at least one alphanumeric character.`,
    });
  }
  return canonical;
}

/**
 * Flat agent-schedule view returned by the {@link Schedules} service.
 * Projects the underlying `Schedule` row + `target.type === 'agent'` payload
 * onto a single object so callers never have to know about the schedules
 * storage shape. Discriminate from {@link WorkflowSchedule} via the
 * `agentId` field.
 */
export interface AgentSchedule {
  id: string;
  agentId: string;
  /** Discriminant mirror — always absent on agent schedules. Check `workflowId` to narrow {@link AnySchedule}. */
  workflowId?: undefined;
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
  ifActive?: ScheduleIfActive;
  ifIdle?: ScheduleIfIdle;
  metadata?: Record<string, unknown>;
  createdAt: number;
  updatedAt: number;
}

/**
 * Flat workflow-schedule view returned by the {@link Schedules} service.
 * Discriminate from {@link AgentSchedule} via the `workflowId` field.
 */
export interface WorkflowSchedule {
  id: string;
  workflowId: string;
  /** Discriminant mirror — always absent on workflow schedules. Check `agentId` to narrow {@link AnySchedule}. */
  agentId?: undefined;
  cron: string;
  timezone?: string;
  status: 'active' | 'paused';
  nextFireAt: number;
  lastFireAt?: number;
  lastRunId?: string;
  inputData?: unknown;
  initialState?: unknown;
  requestContext?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  createdAt: number;
  updatedAt: number;
}

/** Union of the flat views returned by the {@link Schedules} service. */
export type AnySchedule = AgentSchedule | WorkflowSchedule;

/** Agent variant of {@link CreateScheduleInput}. */
export interface CreateAgentScheduleInput {
  /**
   * Optional stable id. Normalized to `agent_<slug>` (the `agent_` prefix is
   * added if missing and the rest is slugified). When omitted, a random
   * `agent_<uuid>` id is generated. Creating a schedule with an id that
   * already exists throws.
   */
  id?: string;
  agentId: string;
  cron: string;
  prompt: string;
  /** Optional free-form label for distinguishing multiple schedules on the same agent/thread. */
  name?: string;
  timezone?: string;
  threadId?: string;
  resourceId?: string;
  /** Signal category for the fire. Defaults to `'notification'`. */
  signalType?: AgentSignalType;
  /** XML tag the signal renders as. Defaults to `'schedule'` (so a fire surfaces as `<schedule>…</schedule>`). */
  tagName?: string;
  /** Attributes rendered onto the signal's XML tag. */
  attributes?: AgentSignalAttributes;
  /** Provider options merged into the schedule signal payload on every fire. JSON-safe. */
  providerOptions?: Record<string, unknown>;
  ifActive?: ScheduleIfActive;
  ifIdle?: ScheduleIfIdle;
  metadata?: Record<string, unknown>;
  /** Schedule lifecycle status. Defaults to `'active'`. */
  status?: 'active' | 'paused';
}

/** Workflow variant of {@link CreateScheduleInput}. */
export interface CreateWorkflowScheduleInput {
  /**
   * Optional stable id. Normalized to `schedule_<slug>`. When omitted, a
   * random `schedule_<uuid>` id is generated. Imperative workflow schedules
   * intentionally never use the `wf_` prefix — that prefix is reserved for
   * declarative `createWorkflow({ schedule })` rows, which the boot-time
   * sync sweeps against the in-code config.
   */
  id?: string;
  workflowId: string;
  cron: string;
  timezone?: string;
  inputData?: unknown;
  initialState?: unknown;
  requestContext?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  /** Schedule lifecycle status. Defaults to `'active'`. */
  status?: 'active' | 'paused';
}

/**
 * Input to {@link Schedules.create}. Discriminated by `agentId` vs
 * `workflowId`.
 */
export type CreateScheduleInput = CreateAgentScheduleInput | CreateWorkflowScheduleInput;

/** Agent variant of {@link UpdateScheduleInput}. */
export interface UpdateAgentScheduleInput {
  cron?: string;
  timezone?: string;
  prompt?: string;
  name?: string;
  signalType?: AgentSignalType;
  tagName?: string;
  attributes?: AgentSignalAttributes;
  providerOptions?: Record<string, unknown>;
  ifActive?: ScheduleIfActive;
  ifIdle?: ScheduleIfIdle;
  metadata?: Record<string, unknown>;
  status?: 'active' | 'paused';
}

/** Workflow variant of {@link UpdateScheduleInput}. */
export interface UpdateWorkflowScheduleInput {
  cron?: string;
  timezone?: string;
  inputData?: unknown;
  initialState?: unknown;
  requestContext?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  status?: 'active' | 'paused';
}

/** Patch input to {@link Schedules.update}. */
export type UpdateScheduleInput = UpdateAgentScheduleInput | UpdateWorkflowScheduleInput;

/** Filter for {@link Schedules.list}. */
export interface ListSchedulesFilter {
  /** Return only agent schedules for this agent. */
  agentId?: string;
  /** Return only workflow schedules for this workflow. */
  workflowId?: string;
  /** Agent-schedule only: match the target threadId. */
  threadId?: string;
  /** Agent-schedule only: match the target resourceId. */
  resourceId?: string;
  /** Agent-schedule only: match the free-form target name. */
  name?: string;
  status?: 'active' | 'paused';
}

/**
 * Unified service for cron schedules. Schedules are persisted as `Schedule`
 * rows whose `target` discriminates what fires: `type: 'agent'` rows run an
 * agent (via signal or `agent.generate`), `type: 'workflow'` rows start a
 * workflow run. This class is a typed projection over `SchedulesStorage`
 * that knows how to build targets and surface flat
 * {@link AgentSchedule} / {@link WorkflowSchedule} views.
 *
 * Use via `mastra.schedules` (the canonical CRUD surface).
 */
export class Schedules {
  #mastra: Mastra;

  constructor(mastra: Mastra) {
    this.#mastra = mastra;
  }

  async #getStore() {
    const storage = this.#mastra.getStorage();
    const store = await storage?.getStore('schedules');
    if (!store) {
      throw new MastraError({
        id: 'SCHEDULES_NO_SCHEDULES_STORAGE',
        domain: ErrorDomain.AGENT,
        category: ErrorCategory.USER,
        text: 'Schedules require a storage adapter that implements the schedules domain.',
      });
    }
    return store;
  }

  /**
   * Resolve a caller-supplied id to a stored row. An id is first looked up
   * verbatim (covering `agent_`, `schedule_`, `wf_`, and legacy `hb_` ids);
   * when that misses, a bare caller id is canonicalized to `agent_<slug>` to
   * match what agent-schedule `create` persisted.
   */
  async #load(id: string): Promise<Schedule | null> {
    const store = await this.#getStore();
    const trimmed = id.trim();
    const exact = trimmed ? await store.getSchedule(trimmed) : null;
    if (exact) return exact;
    const canonical = canonicalizeScheduleId(trimmed, AGENT_SCHEDULE_PREFIX);
    if (!canonical || canonical === trimmed) return null;
    return store.getSchedule(canonical);
  }

  async create(input: CreateAgentScheduleInput): Promise<AgentSchedule>;
  async create(input: CreateWorkflowScheduleInput): Promise<WorkflowSchedule>;
  async create(input: CreateScheduleInput): Promise<AnySchedule> {
    if ('workflowId' in input && input.workflowId) {
      return this.#createWorkflowSchedule(input);
    }
    return this.#createAgentSchedule(input as CreateAgentScheduleInput);
  }

  async #createAgentSchedule(input: CreateAgentScheduleInput): Promise<AgentSchedule> {
    validateCron(input.cron, input.timezone);

    if (!input.agentId) {
      throw new MastraError({
        id: 'SCHEDULES_MISSING_TARGET_ID',
        domain: ErrorDomain.AGENT,
        category: ErrorCategory.USER,
        text: 'schedules.create requires `agentId` or `workflowId`.',
      });
    }

    if (input.threadId && !input.resourceId) {
      throw new MastraError({
        id: 'SCHEDULES_MISSING_RESOURCE_ID',
        domain: ErrorDomain.AGENT,
        category: ErrorCategory.USER,
        text: 'schedules.create requires `resourceId` when `threadId` is set.',
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
          id: 'SCHEDULES_THREADLESS_OPTIONS',
          domain: ErrorDomain.AGENT,
          category: ErrorCategory.USER,
          text: `schedules.create: ${offenders.join(', ')} require a threadId.`,
        });
      }
    }

    const store = await this.#getStore();
    // Make sure the scheduler + agent-schedule worker are running. Boot-time
    // detection covers existing rows; imperative creates after
    // startWorkers() need to flip the request flag and lazily inject.
    await this.#mastra.__ensureScheduleRuntimeReady();

    const id =
      input.id !== undefined
        ? normalizeScheduleId(input.id, AGENT_SCHEDULE_PREFIX)
        : `${AGENT_SCHEDULE_PREFIX}${crypto.randomUUID()}`;
    await this.#assertIdAvailable(store, id, input.id !== undefined);
    const now = Date.now();
    const nextFireAt = computeNextFireAt(input.cron, { timezone: input.timezone, after: now });

    const target: AgentTarget = {
      type: 'agent',
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
    return toAgentSchedule(created)!;
  }

  async #createWorkflowSchedule(input: CreateWorkflowScheduleInput): Promise<WorkflowSchedule> {
    validateCron(input.cron, input.timezone);

    const store = await this.#getStore();
    // Imperative workflow schedules need the scheduler tick loop running,
    // same as agent schedules created after startWorkers().
    await this.#mastra.__ensureScheduleRuntimeReady();

    const id =
      input.id !== undefined
        ? normalizeScheduleId(input.id, WORKFLOW_SCHEDULE_PREFIX)
        : `${WORKFLOW_SCHEDULE_PREFIX}${crypto.randomUUID()}`;
    await this.#assertIdAvailable(store, id, input.id !== undefined);
    const now = Date.now();
    const nextFireAt = computeNextFireAt(input.cron, { timezone: input.timezone, after: now });

    const target: WorkflowTarget = {
      type: 'workflow',
      workflowId: input.workflowId,
      ...(input.inputData !== undefined ? { inputData: input.inputData } : {}),
      ...(input.initialState !== undefined ? { initialState: input.initialState } : {}),
      ...(input.requestContext !== undefined ? { requestContext: input.requestContext } : {}),
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
      ...(input.metadata ? { metadata: input.metadata } : {}),
    };

    const created = await store.createSchedule(schedule);
    return toWorkflowSchedule(created)!;
  }

  async #assertIdAvailable(store: SchedulesStorage, id: string, callerProvided: boolean): Promise<void> {
    if (!callerProvided) return;
    const existing = await store.getSchedule(id);
    if (existing) {
      throw new MastraError({
        id: 'SCHEDULES_ID_EXISTS',
        domain: ErrorDomain.AGENT,
        category: ErrorCategory.USER,
        text: `schedules.create: a schedule with id "${id}" already exists. Use update() to modify it or choose a different id.`,
      });
    }
  }

  async get(id: string): Promise<AnySchedule | null> {
    const schedule = await this.#load(id);
    if (!schedule) return null;
    return toScheduleView(schedule);
  }

  async list(filter?: ListSchedulesFilter): Promise<AnySchedule[]> {
    const store = await this.#getStore();
    const schedules = await store.listSchedules({
      ...(filter?.agentId ? { ownerType: 'agent', ownerId: filter.agentId } : {}),
      ...(filter?.workflowId ? { workflowId: filter.workflowId } : {}),
      ...(filter?.status ? { status: filter.status } : {}),
    });
    const views = schedules
      .map(toScheduleView)
      .filter((s): s is AnySchedule => s !== null)
      // `workflowId` filters at the store level, but an `agentId` filter must
      // not surface workflow rows (and vice versa when both are set).
      .filter(s => (filter?.agentId ? s.agentId !== undefined : true));
    const agentOnly = filter?.threadId !== undefined || filter?.resourceId !== undefined || filter?.name !== undefined;
    if (!agentOnly) return views;
    return views.filter(s => {
      if (s.agentId === undefined) return false;
      if (filter?.threadId !== undefined && s.threadId !== filter.threadId) return false;
      if (filter?.resourceId !== undefined && s.resourceId !== filter.resourceId) return false;
      if (filter?.name !== undefined && s.name !== filter.name) return false;
      return true;
    });
  }

  async update(id: string, patch: UpdateScheduleInput): Promise<AnySchedule> {
    const store = await this.#getStore();
    const existing = await this.#load(id);
    if (!existing) {
      throw new MastraError({
        id: 'SCHEDULES_NOT_FOUND',
        domain: ErrorDomain.AGENT,
        category: ErrorCategory.USER,
        text: `Schedule "${id}" not found.`,
      });
    }

    const nextCron = patch.cron ?? existing.cron;
    const nextTimezone = patch.timezone !== undefined ? patch.timezone : existing.timezone;
    if (patch.cron !== undefined || patch.timezone !== undefined) {
      validateCron(nextCron, nextTimezone);
    }

    const nextTarget =
      existing.target.type === 'agent'
        ? this.#patchAgentTarget(existing.target, patch as UpdateAgentScheduleInput)
        : this.#patchWorkflowTarget(existing.target, patch);

    // Recompute the next fire when the cadence changes OR when this patch
    // resumes a paused schedule. Resuming must follow the same semantics as
    // resume(): a paused row carries a stale nextFireAt (often in the past),
    // so flipping status back to 'active' without recomputing would trigger
    // an immediate spurious fire instead of waiting for the next cron tick.
    const resuming = patch.status === 'active' && existing.status === 'paused';
    const nextFireAt =
      patch.cron !== undefined || patch.timezone !== undefined || resuming
        ? computeNextFireAt(nextCron, { timezone: nextTimezone, after: Date.now() })
        : undefined;

    const updated = await store.updateSchedule(existing.id, {
      ...(patch.cron !== undefined ? { cron: patch.cron } : {}),
      ...(patch.timezone !== undefined ? { timezone: patch.timezone } : {}),
      target: nextTarget,
      ...(nextFireAt !== undefined ? { nextFireAt } : {}),
      ...(patch.metadata !== undefined ? { metadata: patch.metadata } : {}),
      ...(patch.status !== undefined ? { status: patch.status } : {}),
    });
    return toScheduleView(updated)!;
  }

  #patchAgentTarget(existingTarget: AgentTarget, patch: UpdateAgentScheduleInput): AgentTarget {
    // Threadless agent schedules run `agent.generate` in isolation, so
    // thread-scoped signal options are meaningless and would be silently
    // ignored on every fire. `create()` rejects them upfront; mirror that
    // here so `update()` can't sneak the same invalid state onto a
    // threadless schedule after the fact. `threadId`/`resourceId` are not
    // patchable, so the thread-ness of a schedule is fixed at create time.
    if (!existingTarget.threadId) {
      const offenders: string[] = [];
      if (patch.signalType !== undefined) offenders.push('signalType');
      if (patch.ifActive !== undefined) offenders.push('ifActive');
      if (patch.ifIdle !== undefined) offenders.push('ifIdle');
      if (offenders.length > 0) {
        throw new MastraError({
          id: 'SCHEDULES_THREADLESS_OPTIONS',
          domain: ErrorDomain.AGENT,
          category: ErrorCategory.USER,
          text: `schedules.update: ${offenders.join(', ')} require a threadId.`,
        });
      }
    }

    return {
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
  }

  #patchWorkflowTarget(existingTarget: WorkflowTarget, patch: UpdateScheduleInput): WorkflowTarget {
    const agentOnly = [
      'prompt',
      'name',
      'signalType',
      'tagName',
      'attributes',
      'providerOptions',
      'ifActive',
      'ifIdle',
    ];
    const offenders = agentOnly.filter(key => (patch as Record<string, unknown>)[key] !== undefined);
    if (offenders.length > 0) {
      throw new MastraError({
        id: 'SCHEDULES_INVALID_WORKFLOW_PATCH',
        domain: ErrorDomain.AGENT,
        category: ErrorCategory.USER,
        text: `schedules.update: ${offenders.join(', ')} only apply to agent schedules.`,
      });
    }
    const wfPatch = patch as UpdateWorkflowScheduleInput;
    return {
      ...existingTarget,
      ...(wfPatch.inputData !== undefined ? { inputData: wfPatch.inputData } : {}),
      ...(wfPatch.initialState !== undefined ? { initialState: wfPatch.initialState } : {}),
      ...(wfPatch.requestContext !== undefined ? { requestContext: wfPatch.requestContext } : {}),
    };
  }

  async delete(id: string): Promise<void> {
    const store = await this.#getStore();
    const existing = await this.#load(id);
    if (!existing) return;
    await store.deleteSchedule(existing.id);
  }

  async pause(id: string): Promise<AnySchedule> {
    const store = await this.#getStore();
    const existing = await this.#load(id);
    if (!existing) {
      throw new MastraError({
        id: 'SCHEDULES_NOT_FOUND',
        domain: ErrorDomain.AGENT,
        category: ErrorCategory.USER,
        text: `Schedule "${id}" not found.`,
      });
    }
    if (existing.status === 'paused') return toScheduleView(existing)!;
    const updated = await store.updateSchedule(existing.id, { status: 'paused' });
    return toScheduleView(updated)!;
  }

  async resume(id: string): Promise<AnySchedule> {
    const store = await this.#getStore();
    const existing = await this.#load(id);
    if (!existing) {
      throw new MastraError({
        id: 'SCHEDULES_NOT_FOUND',
        domain: ErrorDomain.AGENT,
        category: ErrorCategory.USER,
        text: `Schedule "${id}" not found.`,
      });
    }
    if (existing.status === 'active') return toScheduleView(existing)!;
    const nextFireAt = computeNextFireAt(existing.cron, {
      timezone: existing.timezone,
      after: Date.now(),
    });
    const updated = await store.updateSchedule(existing.id, { status: 'active', nextFireAt });
    return toScheduleView(updated)!;
  }

  async run(id: string): Promise<{ scheduleId: string; claimId: string; scheduledFireAt: number }> {
    const existing = await this.#load(id);
    if (!existing) {
      throw new MastraError({
        id: 'SCHEDULES_NOT_FOUND',
        domain: ErrorDomain.AGENT,
        category: ErrorCategory.USER,
        text: `Schedule "${id}" not found.`,
      });
    }
    const now = Date.now();
    if (existing.target.type === 'agent') {
      const claimId = `manual_${existing.id}_${now}`;
      await this.#mastra.pubsub.publish('agent-schedules', {
        type: 'agent-schedule.fire',
        runId: claimId,
        data: {
          scheduleId: existing.id,
          claimId,
          scheduledFireAt: now,
          target: existing.target,
          triggerKind: 'manual',
        },
      });
      return { scheduleId: existing.id, claimId, scheduledFireAt: now };
    }

    // Workflow target: mirror the scheduler's fire path. The workflow event
    // processor consumes `workflow.start` and reuses the claim id as the run
    // id, so record the trigger row here (the scheduler is not involved in
    // manual fires).
    const { workflowId, inputData, initialState, requestContext } = existing.target;
    const claimId = `sched_${existing.id}_${now}`;
    await this.#mastra.pubsub.publish(TOPIC_WORKFLOWS, {
      type: 'workflow.start',
      runId: claimId,
      data: {
        workflowId,
        runId: claimId,
        prevResult: { status: 'success', output: inputData ?? {} },
        requestContext: requestContext ?? {},
        initialState: initialState ?? {},
      },
    });
    const store = await this.#getStore();
    try {
      await store.recordTrigger({
        scheduleId: existing.id,
        runId: claimId,
        scheduledFireAt: now,
        actualFireAt: now,
        outcome: 'published',
        triggerKind: 'manual',
      });
    } catch {
      // Trigger rows are best-effort audit records; the run already fired.
    }
    return { scheduleId: existing.id, claimId, scheduledFireAt: now };
  }
}

/**
 * Project a `Schedule` row to a flat {@link AgentSchedule} view. Returns
 * `null` when the schedule is not an agent schedule
 * (`target.type !== 'agent'`), allowing callers to filter mixed result sets
 * in one pass.
 */
export function toAgentSchedule(schedule: Schedule): AgentSchedule | null {
  if (schedule.target?.type !== 'agent') return null;
  const target = schedule.target as AgentTarget;
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

/**
 * Project a `Schedule` row to a flat {@link WorkflowSchedule} view. Returns
 * `null` when the schedule is not a workflow schedule.
 */
export function toWorkflowSchedule(schedule: Schedule): WorkflowSchedule | null {
  if (schedule.target?.type !== 'workflow') return null;
  const target = schedule.target as WorkflowTarget;
  return {
    id: schedule.id,
    workflowId: target.workflowId,
    cron: schedule.cron,
    ...(schedule.timezone ? { timezone: schedule.timezone } : {}),
    status: schedule.status,
    nextFireAt: schedule.nextFireAt,
    ...(schedule.lastFireAt !== undefined ? { lastFireAt: schedule.lastFireAt } : {}),
    ...(schedule.lastRunId ? { lastRunId: schedule.lastRunId } : {}),
    ...(target.inputData !== undefined ? { inputData: target.inputData } : {}),
    ...(target.initialState !== undefined ? { initialState: target.initialState } : {}),
    ...(target.requestContext !== undefined ? { requestContext: target.requestContext } : {}),
    ...(schedule.metadata ? { metadata: schedule.metadata } : {}),
    createdAt: schedule.createdAt,
    updatedAt: schedule.updatedAt,
  };
}

/** Project a `Schedule` row to whichever flat view matches its target type. */
export function toScheduleView(schedule: Schedule): AnySchedule | null {
  return toAgentSchedule(schedule) ?? toWorkflowSchedule(schedule);
}

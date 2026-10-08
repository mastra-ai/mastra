import { FactoryStorageDomain } from '@mastra/core/storage';
import type { CollectionSchema, FactoryStorageOps } from '@mastra/core/storage';

export interface FactoryProject {
  id: string;
  orgId: string;
  createdBy: string;
  name: string;
  description: string | null;
  /** Default model for sessions/runs started under this Factory (null = harness default). */
  defaultModelId: string | null;
  /** Whether new Slack sessions create Work-board items for this Factory. */
  slackWorkItemsEnabled: boolean;
  /** Whether rules may start agent runs on their own; off, a run waits for approval on its card. */
  autoRunEnabled: boolean;
  /** Whether the Factory answers a run's plan itself instead of waiting for a person. */
  autoApprovePlans: boolean;
  /** Workspace root in the sandbox; linked repositories are checked out beneath it. */
  sandboxWorkdir: string | null;
  sandboxCpuCount: number | null;
  sandboxMemoryMb: number | null;
  sandboxIdleTimeoutMinutes: number | null;
  /** Command run once in the workspace root after every repository's own setup. */
  workspaceSetupCommand: string | null;
  /** Template id of the environment's current build, written by the build path. */
  activeTemplateId: string | null;
  /** Repository slug → commit the active template was built at. */
  activeTemplateHeads: Record<string, string> | null;
  /** Rebuild the environment every `buildScheduleHours` when a base-branch head moved. */
  buildScheduleEnabled: boolean;
  buildScheduleHours: number;
  /** Rebuild after a push to a base branch, once the debounce window passes. */
  buildOnPushEnabled: boolean;
  buildPushDebounceMinutes: number;
  /** Push-triggered builds per trailing hour; 0 means unlimited (the API reads it back as null). */
  buildPushMaxPerHour: number;
  /** Outcome of the most recent build attempt (null = never attempted). */
  lastBuildStatus: FactoryProjectBuildStatus | null;
  lastBuildError: string | null;
  /** Most recent successful build. */
  lastBuiltAt: Date | null;
  /** Most recent attempt, success or failure; the schedule and the retry backoff read this. */
  lastBuildAttemptedAt: Date | null;
  /** A build is wanted (config change, Build now, push trigger fired); cleared by the build that serves it. */
  buildRequestedAt: Date | null;
  /** Most recent push to a base branch; the debounce reads it. */
  lastPushAt: Date | null;
  /** Trailing-hour push-build cap window, persisted so replicas and restarts agree. */
  buildWindowStartedAt: Date | null;
  buildWindowCount: number;
  /** Consecutive failed builds since the last `ready`; the retry backoff doubles on it. */
  buildFailureCount: number;
  /** Worker lease on the build; null when no build is running. */
  buildClaimedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export type FactoryProjectBuildStatus = 'ready' | 'partial' | 'failed' | 'building';

export const BUILD_SCHEDULE_HOURS_DEFAULT = 24;
export const BUILD_PUSH_DEBOUNCE_MINUTES_DEFAULT = 10;
export const BUILD_PUSH_MAX_PER_HOUR_DEFAULT = 4;

export interface CreateFactoryProjectInput {
  name: string;
  description?: string | null;
  defaultModelId?: string | null;
}

export interface UpdateFactoryProjectInput {
  name?: string;
  description?: string | null;
  defaultModelId?: string | null;
  slackWorkItemsEnabled?: boolean;
  autoRunEnabled?: boolean;
  autoApprovePlans?: boolean;
  sandboxWorkdir?: string | null;
  sandboxCpuCount?: number | null;
  sandboxMemoryMb?: number | null;
  sandboxIdleTimeoutMinutes?: number | null;
  workspaceSetupCommand?: string | null;
  activeTemplateId?: string | null;
  activeTemplateHeads?: Record<string, string> | null;
  buildScheduleEnabled?: boolean;
  buildScheduleHours?: number;
  buildOnPushEnabled?: boolean;
  buildPushDebounceMinutes?: number;
  buildPushMaxPerHour?: number;
  lastBuildStatus?: FactoryProjectBuildStatus | null;
  lastBuildError?: string | null;
  lastBuiltAt?: Date | null;
  lastBuildAttemptedAt?: Date | null;
  buildRequestedAt?: Date | null;
  lastPushAt?: Date | null;
  buildWindowStartedAt?: Date | null;
  buildWindowCount?: number;
  buildFailureCount?: number;
  buildClaimedAt?: Date | null;
}

export interface RecordFactoryProjectBuildInput {
  /** When the attempt finished; also stamps `last_build_attempted_at`. */
  now: Date;
  /** The claim the attempt ran under; a request made after it stays pending. */
  claimedAt: Date;
  /**
   * `skipped`: the attempt found nothing to build (every head still matches
   * the recorded template); the lease is released and the attempt stamped,
   * the template, status and failure count stay as they were.
   */
  result:
    | { status: 'ready'; templateId: string; heads: Record<string, string> }
    | { status: 'failed'; error: string }
    | { status: 'skipped' };
}

export const FACTORY_PROJECTS_SCHEMA: CollectionSchema = {
  name: 'factory_projects',
  columns: {
    id: { type: 'uuid-pk' },
    org_id: { type: 'text' },
    created_by: { type: 'text' },
    name: { type: 'text' },
    description: { type: 'text', nullable: true },
    default_model_id: { type: 'text', nullable: true },
    slack_work_items_enabled: { type: 'boolean', default: false },
    auto_run_enabled: { type: 'boolean', default: false },
    auto_approve_plans: { type: 'boolean', default: false },
    sandbox_workdir: { type: 'text', nullable: true },
    sandbox_cpu_count: { type: 'integer', nullable: true },
    sandbox_memory_mb: { type: 'integer', nullable: true },
    sandbox_idle_timeout_minutes: { type: 'integer', nullable: true },
    workspace_setup_command: { type: 'text', nullable: true },
    active_template_id: { type: 'text', nullable: true },
    active_template_heads: { type: 'json', nullable: true },
    build_schedule_enabled: { type: 'boolean', default: true },
    build_schedule_hours: { type: 'integer', default: BUILD_SCHEDULE_HOURS_DEFAULT },
    build_on_push_enabled: { type: 'boolean', default: true },
    build_push_debounce_minutes: { type: 'integer', default: BUILD_PUSH_DEBOUNCE_MINUTES_DEFAULT },
    build_push_max_per_hour: { type: 'integer', default: BUILD_PUSH_MAX_PER_HOUR_DEFAULT },
    last_build_status: { type: 'text', nullable: true },
    last_build_error: { type: 'text', nullable: true },
    last_built_at: { type: 'timestamp', nullable: true },
    last_build_attempted_at: { type: 'timestamp', nullable: true },
    build_requested_at: { type: 'timestamp', nullable: true },
    last_push_at: { type: 'timestamp', nullable: true },
    build_window_started_at: { type: 'timestamp', nullable: true },
    build_window_count: { type: 'integer', default: 0 },
    build_failure_count: { type: 'integer', default: 0 },
    build_claimed_at: { type: 'timestamp', nullable: true },
    /** Set once the source-control domain has backfilled positions and the oldest link's workdir onto the project. */
    environment_backfilled_at: { type: 'timestamp', nullable: true },
    created_at: { type: 'timestamp' },
    updated_at: { type: 'timestamp' },
  },
  indexes: [{ name: 'factory_projects_org_updated_at_idx', columns: ['org_id', 'updated_at'] }],
};

interface FactoryProjectDbRow extends Record<string, unknown> {
  id: string;
  org_id: string;
  created_by: string;
  name: string;
  description: string | null;
  default_model_id: string | null;
  slack_work_items_enabled: boolean;
  auto_run_enabled: boolean;
  auto_approve_plans: boolean;
  sandbox_workdir: string | null;
  sandbox_cpu_count: number | null;
  sandbox_memory_mb: number | null;
  sandbox_idle_timeout_minutes: number | null;
  workspace_setup_command: string | null;
  active_template_id: string | null;
  active_template_heads: Record<string, string> | null;
  build_schedule_enabled: boolean | null;
  build_schedule_hours: number | null;
  build_on_push_enabled: boolean | null;
  build_push_debounce_minutes: number | null;
  build_push_max_per_hour: number | null;
  last_build_status: FactoryProjectBuildStatus | null;
  last_build_error: string | null;
  last_built_at: Date | null;
  last_build_attempted_at: Date | null;
  build_requested_at: Date | null;
  last_push_at: Date | null;
  build_window_started_at: Date | null;
  build_window_count: number | null;
  build_failure_count: number | null;
  build_claimed_at: Date | null;
  environment_backfilled_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

function toFactoryProject(row: FactoryProjectDbRow): FactoryProject {
  return {
    id: row.id,
    orgId: row.org_id,
    createdBy: row.created_by,
    name: row.name,
    description: row.description,
    defaultModelId: row.default_model_id,
    slackWorkItemsEnabled: row.slack_work_items_enabled,
    autoRunEnabled: row.auto_run_enabled,
    autoApprovePlans: row.auto_approve_plans ?? false,
    sandboxWorkdir: row.sandbox_workdir ?? null,
    sandboxCpuCount: row.sandbox_cpu_count ?? null,
    sandboxMemoryMb: row.sandbox_memory_mb ?? null,
    sandboxIdleTimeoutMinutes: row.sandbox_idle_timeout_minutes ?? null,
    workspaceSetupCommand: row.workspace_setup_command ?? null,
    activeTemplateId: row.active_template_id ?? null,
    activeTemplateHeads: row.active_template_heads ?? null,
    buildScheduleEnabled: row.build_schedule_enabled ?? true,
    buildScheduleHours: row.build_schedule_hours ?? BUILD_SCHEDULE_HOURS_DEFAULT,
    buildOnPushEnabled: row.build_on_push_enabled ?? true,
    buildPushDebounceMinutes: row.build_push_debounce_minutes ?? BUILD_PUSH_DEBOUNCE_MINUTES_DEFAULT,
    buildPushMaxPerHour: row.build_push_max_per_hour ?? BUILD_PUSH_MAX_PER_HOUR_DEFAULT,
    lastBuildStatus: row.last_build_status ?? null,
    lastBuildError: row.last_build_error ?? null,
    lastBuiltAt: row.last_built_at ?? null,
    lastBuildAttemptedAt: row.last_build_attempted_at ?? null,
    buildRequestedAt: row.build_requested_at ?? null,
    lastPushAt: row.last_push_at ?? null,
    buildWindowStartedAt: row.build_window_started_at ?? null,
    buildWindowCount: row.build_window_count ?? 0,
    buildFailureCount: row.build_failure_count ?? 0,
    buildClaimedAt: row.build_claimed_at ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class FactoryProjectsStorage extends FactoryStorageDomain {
  constructor() {
    super('projects');
  }

  async init(): Promise<void> {
    await this.ensureCollections([FACTORY_PROJECTS_SCHEMA]);
  }

  async dangerouslyClearAll(): Promise<void> {
    await this.ops.deleteMany('factory_projects', {});
  }

  get #db(): FactoryStorageOps {
    return this.ops;
  }

  async create({
    orgId,
    userId,
    input,
  }: {
    orgId: string;
    userId: string;
    input: CreateFactoryProjectInput;
  }): Promise<FactoryProject> {
    const now = new Date();
    const row = await this.#db.insertOne<FactoryProjectDbRow>('factory_projects', {
      org_id: orgId,
      created_by: userId,
      name: input.name,
      description: input.description ?? null,
      default_model_id: input.defaultModelId ?? null,
      slack_work_items_enabled: false,
      auto_run_enabled: false,
      auto_approve_plans: false,
      build_schedule_enabled: true,
      build_schedule_hours: BUILD_SCHEDULE_HOURS_DEFAULT,
      build_on_push_enabled: true,
      build_push_debounce_minutes: BUILD_PUSH_DEBOUNCE_MINUTES_DEFAULT,
      build_push_max_per_hour: BUILD_PUSH_MAX_PER_HOUR_DEFAULT,
      build_window_count: 0,
      build_failure_count: 0,
      created_at: now,
      updated_at: now,
    });
    return toFactoryProject(row);
  }

  async list({ orgId }: { orgId: string }): Promise<FactoryProject[]> {
    const rows = await this.#db.findMany<FactoryProjectDbRow>(
      'factory_projects',
      { org_id: orgId },
      { orderBy: [['updated_at', 'desc']] },
    );
    return rows.map(toFactoryProject);
  }

  async listAll(): Promise<FactoryProject[]> {
    const rows = await this.#db.findMany<FactoryProjectDbRow>(
      'factory_projects',
      {},
      { orderBy: [['updated_at', 'desc']] },
    );
    return rows.map(toFactoryProject);
  }

  async get({ orgId, id }: { orgId: string; id: string }): Promise<FactoryProject | null> {
    const row = await this.#db.findOne<FactoryProjectDbRow>('factory_projects', { org_id: orgId, id });
    return row ? toFactoryProject(row) : null;
  }

  async getById({ id }: { id: string }): Promise<FactoryProject | null> {
    const row = await this.#db.findOne<FactoryProjectDbRow>('factory_projects', { id });
    return row ? toFactoryProject(row) : null;
  }

  async update({
    orgId,
    id,
    input,
  }: {
    orgId: string;
    id: string;
    input: UpdateFactoryProjectInput;
  }): Promise<FactoryProject | null> {
    const row = await this.#db.updateAtomic<FactoryProjectDbRow>('factory_projects', { org_id: orgId, id }, () => ({
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.defaultModelId !== undefined ? { default_model_id: input.defaultModelId } : {}),
      ...(input.slackWorkItemsEnabled !== undefined ? { slack_work_items_enabled: input.slackWorkItemsEnabled } : {}),
      ...(input.autoRunEnabled !== undefined ? { auto_run_enabled: input.autoRunEnabled } : {}),
      ...(input.autoApprovePlans !== undefined ? { auto_approve_plans: input.autoApprovePlans } : {}),
      ...(input.sandboxWorkdir !== undefined ? { sandbox_workdir: input.sandboxWorkdir } : {}),
      ...(input.sandboxCpuCount !== undefined ? { sandbox_cpu_count: input.sandboxCpuCount } : {}),
      ...(input.sandboxMemoryMb !== undefined ? { sandbox_memory_mb: input.sandboxMemoryMb } : {}),
      ...(input.sandboxIdleTimeoutMinutes !== undefined
        ? { sandbox_idle_timeout_minutes: input.sandboxIdleTimeoutMinutes }
        : {}),
      ...(input.workspaceSetupCommand !== undefined ? { workspace_setup_command: input.workspaceSetupCommand } : {}),
      ...(input.activeTemplateId !== undefined ? { active_template_id: input.activeTemplateId } : {}),
      ...(input.activeTemplateHeads !== undefined ? { active_template_heads: input.activeTemplateHeads } : {}),
      ...(input.buildScheduleEnabled !== undefined ? { build_schedule_enabled: input.buildScheduleEnabled } : {}),
      ...(input.buildScheduleHours !== undefined ? { build_schedule_hours: input.buildScheduleHours } : {}),
      ...(input.buildOnPushEnabled !== undefined ? { build_on_push_enabled: input.buildOnPushEnabled } : {}),
      ...(input.buildPushDebounceMinutes !== undefined
        ? { build_push_debounce_minutes: input.buildPushDebounceMinutes }
        : {}),
      ...(input.buildPushMaxPerHour !== undefined ? { build_push_max_per_hour: input.buildPushMaxPerHour } : {}),
      ...(input.lastBuildStatus !== undefined ? { last_build_status: input.lastBuildStatus } : {}),
      ...(input.lastBuildError !== undefined ? { last_build_error: input.lastBuildError } : {}),
      ...(input.lastBuiltAt !== undefined ? { last_built_at: input.lastBuiltAt } : {}),
      ...(input.lastBuildAttemptedAt !== undefined ? { last_build_attempted_at: input.lastBuildAttemptedAt } : {}),
      ...(input.buildRequestedAt !== undefined ? { build_requested_at: input.buildRequestedAt } : {}),
      ...(input.lastPushAt !== undefined ? { last_push_at: input.lastPushAt } : {}),
      ...(input.buildWindowStartedAt !== undefined ? { build_window_started_at: input.buildWindowStartedAt } : {}),
      ...(input.buildWindowCount !== undefined ? { build_window_count: input.buildWindowCount } : {}),
      ...(input.buildFailureCount !== undefined ? { build_failure_count: input.buildFailureCount } : {}),
      ...(input.buildClaimedAt !== undefined ? { build_claimed_at: input.buildClaimedAt } : {}),
      updated_at: new Date(),
    }));
    return row ? toFactoryProject(row) : null;
  }

  /**
   * Take the build lease on a project. Resolves the project with
   * `build_claimed_at = now` when no build holds it (or the holder is older
   * than `staleAfterMs`), else null; the read and the write run under one
   * `updateAtomic`, so two workers never both win.
   */
  async claimBuild({
    orgId,
    id,
    now,
    staleAfterMs,
    when,
  }: {
    orgId: string;
    id: string;
    now: Date;
    staleAfterMs: number;
    /** Re-checked on the locked row, so a decision made on a stale listing cannot claim. */
    when?: (current: FactoryProject) => boolean;
  }): Promise<FactoryProject | null> {
    let claimed = false;
    const row = await this.#db.updateAtomic<FactoryProjectDbRow>('factory_projects', { org_id: orgId, id }, current => {
      const held = current.build_claimed_at;
      if (held && now.getTime() - held.getTime() < staleAfterMs) return null;
      if (when && !when(toFactoryProject(current))) return null;
      claimed = true;
      return { build_claimed_at: now, last_build_status: 'building', updated_at: now };
    });
    return claimed && row ? toFactoryProject(row) : null;
  }

  /**
   * Record the outcome of a claimed build and release the lease. Every
   * attempt stamps `last_build_attempted_at` with the claim time (so a push
   * that landed while the build ran stays newer than the attempt and is
   * served next); only `ready` moves the template id, heads and
   * `last_built_at`. A request made after the claim stays pending so the
   * next tick serves it. Writes nothing (and resolves null) when the row no
   * longer carries this attempt's claim: a holder whose lease went stale and
   * was taken over must not overwrite the new holder's result.
   */
  async recordBuild({
    orgId,
    id,
    input,
  }: {
    orgId: string;
    id: string;
    input: RecordFactoryProjectBuildInput;
  }): Promise<FactoryProject | null> {
    let recorded = false;
    const row = await this.#db.updateAtomic<FactoryProjectDbRow>('factory_projects', { org_id: orgId, id }, current => {
      if (current.build_claimed_at?.getTime() !== input.claimedAt.getTime()) return null;
      recorded = true;
      const requested = current.build_requested_at;
      const stillRequested = requested !== null && requested.getTime() > input.claimedAt.getTime();
      const result = input.result;
      return {
        last_build_attempted_at: input.claimedAt,
        build_claimed_at: null,
        build_requested_at: stillRequested ? requested : null,
        ...(result.status === 'skipped'
          ? { last_build_status: current.active_template_id ? 'ready' : null }
          : result.status === 'ready'
            ? {
                last_build_status: 'ready',
                last_build_error: null,
                last_built_at: input.now,
                active_template_id: result.templateId,
                active_template_heads: result.heads,
                build_failure_count: 0,
              }
            : {
                last_build_status: 'failed',
                last_build_error: result.error,
                build_failure_count: (current.build_failure_count ?? 0) + 1,
              }),
        updated_at: input.now,
      };
    });
    return recorded && row ? toFactoryProject(row) : null;
  }

  async delete({ orgId, id }: { orgId: string; id: string }): Promise<FactoryProject | null> {
    const project = await this.get({ orgId, id });
    if (!project) return null;
    const deleted = await this.#db.deleteMany('factory_projects', { org_id: orgId, id });
    return deleted > 0 ? project : null;
  }
}

import { isThinkingLevelSetting } from '@mastra/code-sdk/thinking';
import type { ThinkingLevelSetting } from '@mastra/code-sdk/thinking';
import { FactoryStorageDomain } from '@mastra/core/storage';
import type { CollectionSchema, FactoryStorageOps } from '@mastra/core/storage';

import { DEFAULT_THINKING_LEVEL } from '../../../default-thinking-level.js';

export const DEFAULT_BUILD_PUSH_DEBOUNCE_MINUTES = 10;
export const FACTORY_MODEL_SCOPES = ['factory', 'user', 'hybrid'] as const;
export type FactoryModelScope = (typeof FACTORY_MODEL_SCOPES)[number];
/** The single credential scope one session or run resolves from; `hybrid` is never effective. */
export type EffectiveModelScope = Exclude<FactoryModelScope, 'hybrid'>;

/**
 * Resolve the scope one context runs under. `hybrid` splits by context: work-item runs use the
 * Factory's model and credentials, interactive sessions use the session owner's.
 */
export function effectiveModelScope(scope: FactoryModelScope, context: 'run' | 'session'): EffectiveModelScope {
  if (scope === 'hybrid') return context === 'run' ? 'factory' : 'user';
  return scope;
}

export interface FactoryProject {
  id: string;
  orgId: string;
  createdBy: string;
  name: string;
  description: string | null;
  /** Default model for sessions/runs started under this Factory (null = harness default). */
  defaultModelId: string | null;
  /**
   * Whose model and credentials sessions and runs use: the Factory's, the session owner's, or
   * `hybrid` (owner's for interactive sessions, the Factory's for work-item runs).
   */
  modelScope: FactoryModelScope;
  /** Thinking level for this Factory's sessions and runs that have not picked their own. */
  defaultThinkingLevel: ThinkingLevelSetting;
  /** Whether rules may start agent runs on their own; off, a run waits for approval on its card. */
  autoRunEnabled: boolean;
  /** Whether the Factory answers a run's plan itself instead of waiting for a person. */
  autoApprovePlans: boolean;
  /** Workspace root in the sandbox; linked repositories are checked out beneath it. */
  sandboxWorkingDirectory: string | null;
  /** Provider settings document validated by the configured FactorySandbox. Only keys the user set. */
  sandboxSettings: Record<string, unknown> | null;
  /** Command run once in the workspace root after every repository's own setup. */
  workspaceSetupCommand: string | null;
  /** Template id of the environment's current build, written by the build path. */
  activeTemplateId: string | null;
  /** Repository slug → commit the active template was built at. */
  activeTemplateHeads: Record<string, string> | null;
  /** Provider build id of the most recent build attempt; its status is read live from the provider. */
  lastBuildId: string | null;
  /** Repository slug → commit the most recent build attempt pinned, so its status can be read back. */
  lastBuildHeads: Record<string, string> | null;
  /** Fingerprint of the settings, repositories and setup commands the most recent build attempt used. */
  lastBuildInputs: string | null;
  /** When the most recent build attempt started, whatever triggered it. */
  lastBuildAttemptedAt: Date | null;
  /** When a push last started a build: the leading edge of the push debounce window. */
  lastPushBuildAt: Date | null;
  /**
   * A run's build-start lease lapsed, so a build it may have started is not
   * on record. Cleared once a run reconciles it with a provider that lists builds.
   */
  buildStartUncertain: boolean;
  /** Whether a push to an environment repository's default branch starts a build. */
  buildOnPushEnabled: boolean;
  /** Minutes after a push-triggered attempt during which further pushes do not build. */
  buildPushDebounceMinutes: number;
  /** Whether Review agents publish their test results as a commit check. Defaults to off. */
  reviewTestChecksEnabled: boolean;
  /** Whether Work items get an independent self-review before the change request opens. Defaults to off. */
  selfReviewEnabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateFactoryProjectInput {
  name: string;
  description?: string | null;
  defaultModelId?: string | null;
  modelScope?: FactoryModelScope;
}

export interface UpdateFactoryProjectInput {
  name?: string;
  description?: string | null;
  defaultModelId?: string | null;
  modelScope?: FactoryModelScope;
  defaultThinkingLevel?: ThinkingLevelSetting;
  autoRunEnabled?: boolean;
  autoApprovePlans?: boolean;
  sandboxWorkingDirectory?: string | null;
  sandboxSettings?: Record<string, unknown> | null;
  workspaceSetupCommand?: string | null;
  activeTemplateId?: string | null;
  activeTemplateHeads?: Record<string, string> | null;
  lastBuildId?: string | null;
  lastBuildHeads?: Record<string, string> | null;
  lastBuildInputs?: string | null;
  lastBuildAttemptedAt?: Date | null;
  buildOnPushEnabled?: boolean;
  buildPushDebounceMinutes?: number;
  reviewTestChecksEnabled?: boolean;
  selfReviewEnabled?: boolean;
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
    model_scope: { type: 'text', default: 'hybrid' },
    default_thinking_level: { type: 'text', default: DEFAULT_THINKING_LEVEL },
    // Deprecated: no longer read or written. Kept so existing databases need no
    // migration. Old rows may still hold `true`, so never read it to bring Slack
    // work items back. Drop it in a later migration.
    slack_work_items_enabled: { type: 'boolean', default: false },
    auto_run_enabled: { type: 'boolean', default: false },
    auto_approve_plans: { type: 'boolean', default: false },
    sandbox_working_directory: { type: 'text', nullable: true },
    sandbox_settings: { type: 'json', nullable: true },
    workspace_setup_command: { type: 'text', nullable: true },
    active_template_id: { type: 'text', nullable: true },
    active_template_heads: { type: 'json', nullable: true },
    last_build_id: { type: 'text', nullable: true },
    last_build_heads: { type: 'json', nullable: true },
    last_build_inputs: { type: 'text', nullable: true },
    last_build_attempted_at: { type: 'timestamp', nullable: true },
    last_push_build_at: { type: 'timestamp', nullable: true },
    build_start_uncertain: { type: 'boolean', default: false },
    build_start_claim: { type: 'text', nullable: true },
    build_start_claim_expires_at: { type: 'timestamp', nullable: true },
    build_on_push_enabled: { type: 'boolean', default: false },
    build_push_debounce_minutes: { type: 'integer', default: DEFAULT_BUILD_PUSH_DEBOUNCE_MINUTES },
    review_test_checks_enabled: { type: 'boolean', default: false },
    self_review_enabled: { type: 'boolean', default: false },
    /** Set once the source-control domain has backfilled repository positions and environment membership. */
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
  model_scope: string;
  default_thinking_level: string | null;
  auto_run_enabled: boolean;
  auto_approve_plans: boolean;
  sandbox_working_directory: string | null;
  sandbox_settings: Record<string, unknown> | null;
  workspace_setup_command: string | null;
  active_template_id: string | null;
  active_template_heads: Record<string, string> | null;
  last_build_id: string | null;
  last_build_heads: Record<string, string> | null;
  last_build_inputs: string | null;
  last_build_attempted_at: Date | null;
  last_push_build_at: Date | null;
  build_start_uncertain: boolean | null;
  build_start_claim: string | null;
  build_start_claim_expires_at: Date | null;
  build_on_push_enabled: boolean | null;
  build_push_debounce_minutes: number | null;
  review_test_checks_enabled: boolean | null;
  self_review_enabled: boolean | null;
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
    modelScope: row.model_scope === 'factory' || row.model_scope === 'user' ? row.model_scope : 'hybrid',
    defaultThinkingLevel: isThinkingLevelSetting(row.default_thinking_level)
      ? row.default_thinking_level
      : DEFAULT_THINKING_LEVEL,
    autoRunEnabled: row.auto_run_enabled,
    autoApprovePlans: row.auto_approve_plans ?? false,
    sandboxWorkingDirectory: row.sandbox_working_directory ?? null,
    sandboxSettings: row.sandbox_settings ?? null,
    workspaceSetupCommand: row.workspace_setup_command ?? null,
    activeTemplateId: row.active_template_id ?? null,
    activeTemplateHeads: row.active_template_heads ?? null,
    lastBuildId: row.last_build_id ?? null,
    lastBuildHeads: row.last_build_heads ?? null,
    lastBuildInputs: row.last_build_inputs ?? null,
    lastBuildAttemptedAt: row.last_build_attempted_at ?? null,
    lastPushBuildAt: row.last_push_build_at ?? null,
    buildStartUncertain: row.build_start_uncertain ?? false,
    buildOnPushEnabled: row.build_on_push_enabled ?? false,
    buildPushDebounceMinutes: row.build_push_debounce_minutes ?? DEFAULT_BUILD_PUSH_DEBOUNCE_MINUTES,
    reviewTestChecksEnabled: row.review_test_checks_enabled ?? false,
    selfReviewEnabled: row.self_review_enabled ?? false,
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
      model_scope: input.modelScope ?? 'hybrid',
      auto_run_enabled: false,
      auto_approve_plans: false,
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
    /** A function input runs in a transaction; writes through its `ops` commit or roll back with the project. */
    input:
      | UpdateFactoryProjectInput
      | ((current: FactoryProject, ops: FactoryStorageOps) => Promise<UpdateFactoryProjectInput | null>);
  }): Promise<FactoryProject | null> {
    const update = (ops: FactoryStorageOps) =>
      ops.updateAtomic<FactoryProjectDbRow>('factory_projects', { org_id: orgId, id }, async current => {
        const changes = typeof input === 'function' ? await input(toFactoryProject(current), ops) : input;
        if (changes === null) return null;
        return {
          ...(changes.name !== undefined ? { name: changes.name } : {}),
          ...(changes.description !== undefined ? { description: changes.description } : {}),
          ...(changes.defaultModelId !== undefined ? { default_model_id: changes.defaultModelId } : {}),
          ...(changes.modelScope !== undefined ? { model_scope: changes.modelScope } : {}),
          ...(changes.defaultThinkingLevel !== undefined
            ? { default_thinking_level: changes.defaultThinkingLevel }
            : {}),
          ...(changes.autoRunEnabled !== undefined ? { auto_run_enabled: changes.autoRunEnabled } : {}),
          ...(changes.autoApprovePlans !== undefined ? { auto_approve_plans: changes.autoApprovePlans } : {}),
          ...(changes.sandboxWorkingDirectory !== undefined
            ? { sandbox_working_directory: changes.sandboxWorkingDirectory }
            : {}),
          ...(changes.sandboxSettings !== undefined ? { sandbox_settings: changes.sandboxSettings } : {}),
          ...(changes.workspaceSetupCommand !== undefined
            ? { workspace_setup_command: changes.workspaceSetupCommand }
            : {}),
          ...(changes.activeTemplateId !== undefined ? { active_template_id: changes.activeTemplateId } : {}),
          ...(changes.activeTemplateHeads !== undefined ? { active_template_heads: changes.activeTemplateHeads } : {}),
          ...(changes.lastBuildId !== undefined ? { last_build_id: changes.lastBuildId } : {}),
          ...(changes.lastBuildHeads !== undefined ? { last_build_heads: changes.lastBuildHeads } : {}),
          ...(changes.lastBuildInputs !== undefined ? { last_build_inputs: changes.lastBuildInputs } : {}),
          ...(changes.lastBuildAttemptedAt !== undefined
            ? { last_build_attempted_at: changes.lastBuildAttemptedAt }
            : {}),
          ...(changes.buildOnPushEnabled !== undefined ? { build_on_push_enabled: changes.buildOnPushEnabled } : {}),
          ...(changes.buildPushDebounceMinutes !== undefined
            ? { build_push_debounce_minutes: changes.buildPushDebounceMinutes }
            : {}),
          ...(changes.reviewTestChecksEnabled !== undefined
            ? { review_test_checks_enabled: changes.reviewTestChecksEnabled }
            : {}),
          ...(changes.selfReviewEnabled !== undefined ? { self_review_enabled: changes.selfReviewEnabled } : {}),
          updated_at: new Date(),
        };
      });
    // LibSQL's standalone updateAtomic only serializes one client; a transaction
    // also protects a read-dependent update against other database connections.
    const row = typeof input === 'function' ? await this.storage.withTransaction(update) : await update(this.#db);
    return row ? toFactoryProject(row) : null;
  }

  /**
   * Leading-edge debounce for push-triggered builds: stamps
   * `last_push_build_at = now` and resolves true when no push started a build
   * within the last `debounceMinutes`, else writes nothing and resolves
   * false. Taken right before the provider start, so a push that skips
   * (another run starting, a build in progress) never closes the window. The read and the write run in one transaction, so two concurrent
   * webhooks never both win, even on different database connections.
   */
  async claimBuildAttempt({
    id,
    debounceMinutes,
    now = new Date(),
  }: {
    id: string;
    debounceMinutes: number;
    now?: Date;
  }): Promise<boolean> {
    let claimed = false;
    await this.storage.withTransaction(ops =>
      ops.updateAtomic<FactoryProjectDbRow>('factory_projects', { id }, current => {
        const last = current.last_push_build_at;
        if (last && now.getTime() - last.getTime() < debounceMinutes * 60_000) return null;
        claimed = true;
        return { last_push_build_at: now, updated_at: now };
      }),
    );
    return claimed;
  }

  /**
   * Takes the project's build-start lease for `token`. Every trigger (manual,
   * schedule, push) takes it before reading build state and holds it through
   * `builds.start` and recording the result, so two runs never both start a
   * build. `claimed` is false while another run holds an unexpired lease. The
   * holder renews the lease while it works (`renewBuildStart`), so a lease
   * only expires when its run died or stalled. Taking over an expired lease
   * marks the start uncertain (that run's build may have reached the provider
   * unrecorded), and the mark stays until a release resolves it; `uncertain`
   * reports it. Only the claim is transactional; provider calls run outside it.
   */
  async claimBuildStart({
    id,
    token,
    leaseMs,
    now = new Date(),
  }: {
    id: string;
    token: string;
    leaseMs: number;
    now?: Date;
  }): Promise<{ claimed: boolean; uncertain: boolean }> {
    const result = { claimed: false, uncertain: false };
    await this.storage.withTransaction(ops =>
      ops.updateAtomic<FactoryProjectDbRow>('factory_projects', { id }, current => {
        const expiresAt = current.build_start_claim_expires_at;
        if (current.build_start_claim && expiresAt && expiresAt.getTime() > now.getTime()) return null;
        result.claimed = true;
        result.uncertain = Boolean(current.build_start_claim) || current.build_start_uncertain === true;
        return {
          build_start_claim: token,
          build_start_claim_expires_at: new Date(now.getTime() + leaseMs),
          ...(result.uncertain ? { build_start_uncertain: true } : {}),
          updated_at: now,
        };
      }),
    );
    return result;
  }

  /**
   * Extends the build-start lease held by `token` to `now + leaseMs`. Resolves
   * false, writing nothing, when `token` no longer holds it.
   */
  async renewBuildStart({
    id,
    token,
    leaseMs,
    now = new Date(),
  }: {
    id: string;
    token: string;
    leaseMs: number;
    now?: Date;
  }): Promise<boolean> {
    let renewed = false;
    await this.storage.withTransaction(ops =>
      ops.updateAtomic<FactoryProjectDbRow>('factory_projects', { id }, current => {
        if (current.build_start_claim !== token) return null;
        renewed = true;
        return { build_start_claim_expires_at: new Date(now.getTime() + leaseMs), updated_at: now };
      }),
    );
    return renewed;
  }

  /**
   * Releases the build-start lease taken with `token` and writes `changes` in
   * the same transaction, but only while `token` still holds the lease. A run
   * whose lease expired and was taken by a newer run writes nothing, so it
   * never clears or overwrites that run's build. `resolved` clears an
   * uncertain start. Resolves false when skipped.
   */
  async releaseBuildStart({
    id,
    token,
    changes = {},
    resolved = false,
    now = new Date(),
  }: {
    id: string;
    token: string;
    resolved?: boolean;
    changes?: Pick<
      UpdateFactoryProjectInput,
      'lastBuildId' | 'lastBuildHeads' | 'lastBuildInputs' | 'lastBuildAttemptedAt'
    >;
    now?: Date;
  }): Promise<boolean> {
    let released = false;
    await this.storage.withTransaction(ops =>
      ops.updateAtomic<FactoryProjectDbRow>('factory_projects', { id }, current => {
        if (current.build_start_claim !== token) return null;
        released = true;
        return {
          ...(changes.lastBuildId !== undefined ? { last_build_id: changes.lastBuildId } : {}),
          ...(changes.lastBuildHeads !== undefined ? { last_build_heads: changes.lastBuildHeads } : {}),
          ...(changes.lastBuildInputs !== undefined ? { last_build_inputs: changes.lastBuildInputs } : {}),
          ...(changes.lastBuildAttemptedAt !== undefined
            ? { last_build_attempted_at: changes.lastBuildAttemptedAt }
            : {}),
          ...(resolved ? { build_start_uncertain: false } : {}),
          build_start_claim: null,
          build_start_claim_expires_at: null,
          updated_at: now,
        };
      }),
    );
    return released;
  }

  /**
   * Pins the active template to a finished build, but only while that build is
   * still the project's last one. Overlapping runs (Build now during a push
   * build) can finish out of order; the write and the `last_build_id` check
   * run in one transaction so a stale run never overwrites a newer build's
   * pin. Resolves false when the pin was skipped.
   */
  async pinActiveTemplate({
    id,
    buildId,
    templateId,
    heads,
    now = new Date(),
  }: {
    id: string;
    buildId: string;
    templateId: string;
    heads: Record<string, string>;
    now?: Date;
  }): Promise<boolean> {
    let pinned = false;
    await this.storage.withTransaction(ops =>
      ops.updateAtomic<FactoryProjectDbRow>('factory_projects', { id }, current => {
        if (current.last_build_id !== buildId) return null;
        pinned = true;
        return { active_template_id: templateId, active_template_heads: heads, updated_at: now };
      }),
    );
    return pinned;
  }

  async delete({ orgId, id }: { orgId: string; id: string }): Promise<FactoryProject | null> {
    const project = await this.get({ orgId, id });
    if (!project) return null;
    const deleted = await this.#db.deleteMany('factory_projects', { org_id: orgId, id });
    return deleted > 0 ? project : null;
  }
}

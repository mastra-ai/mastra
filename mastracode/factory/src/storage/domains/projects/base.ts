import { FactoryStorageDomain } from '@mastra/core/storage';
import type { CollectionSchema, FactoryStorageOps } from '@mastra/core/storage';

export const DEFAULT_BUILD_PUSH_DEBOUNCE_MINUTES = 10;

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
  /** When the most recent build attempt started (also the leading edge of the push debounce window). */
  lastBuildAttemptedAt: Date | null;
  /** Whether a push to an environment repository's default branch starts a build. */
  buildOnPushEnabled: boolean;
  /** Minutes after a push-triggered attempt during which further pushes do not build. */
  buildPushDebounceMinutes: number;
  createdAt: Date;
  updatedAt: Date;
}

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
  sandboxSettings?: Record<string, unknown> | null;
  workspaceSetupCommand?: string | null;
  activeTemplateId?: string | null;
  activeTemplateHeads?: Record<string, string> | null;
  lastBuildId?: string | null;
  lastBuildAttemptedAt?: Date | null;
  buildOnPushEnabled?: boolean;
  buildPushDebounceMinutes?: number;
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
    sandbox_settings: { type: 'json', nullable: true },
    workspace_setup_command: { type: 'text', nullable: true },
    active_template_id: { type: 'text', nullable: true },
    active_template_heads: { type: 'json', nullable: true },
    last_build_id: { type: 'text', nullable: true },
    last_build_attempted_at: { type: 'timestamp', nullable: true },
    build_on_push_enabled: { type: 'boolean', default: false },
    build_push_debounce_minutes: { type: 'integer', default: DEFAULT_BUILD_PUSH_DEBOUNCE_MINUTES },
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
  sandbox_settings: Record<string, unknown> | null;
  workspace_setup_command: string | null;
  active_template_id: string | null;
  active_template_heads: Record<string, string> | null;
  last_build_id: string | null;
  last_build_attempted_at: Date | null;
  build_on_push_enabled: boolean | null;
  build_push_debounce_minutes: number | null;
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
    sandboxSettings: row.sandbox_settings ?? null,
    workspaceSetupCommand: row.workspace_setup_command ?? null,
    activeTemplateId: row.active_template_id ?? null,
    activeTemplateHeads: row.active_template_heads ?? null,
    lastBuildId: row.last_build_id ?? null,
    lastBuildAttemptedAt: row.last_build_attempted_at ?? null,
    buildOnPushEnabled: row.build_on_push_enabled ?? false,
    buildPushDebounceMinutes: row.build_push_debounce_minutes ?? DEFAULT_BUILD_PUSH_DEBOUNCE_MINUTES,
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
      ...(input.sandboxSettings !== undefined ? { sandbox_settings: input.sandboxSettings } : {}),
      ...(input.workspaceSetupCommand !== undefined ? { workspace_setup_command: input.workspaceSetupCommand } : {}),
      ...(input.activeTemplateId !== undefined ? { active_template_id: input.activeTemplateId } : {}),
      ...(input.activeTemplateHeads !== undefined ? { active_template_heads: input.activeTemplateHeads } : {}),
      ...(input.lastBuildId !== undefined ? { last_build_id: input.lastBuildId } : {}),
      ...(input.lastBuildAttemptedAt !== undefined ? { last_build_attempted_at: input.lastBuildAttemptedAt } : {}),
      ...(input.buildOnPushEnabled !== undefined ? { build_on_push_enabled: input.buildOnPushEnabled } : {}),
      ...(input.buildPushDebounceMinutes !== undefined
        ? { build_push_debounce_minutes: input.buildPushDebounceMinutes }
        : {}),
      updated_at: new Date(),
    }));
    return row ? toFactoryProject(row) : null;
  }

  /**
   * Leading-edge debounce for push-triggered builds: stamps
   * `last_build_attempted_at = now` and resolves true when no attempt started
   * within the last `debounceMinutes`, else writes nothing and resolves
   * false. The read and the write run under one `updateAtomic`, so two
   * concurrent webhooks never both win.
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
    await this.#db.updateAtomic<FactoryProjectDbRow>('factory_projects', { id }, current => {
      const last = current.last_build_attempted_at;
      if (last && now.getTime() - last.getTime() < debounceMinutes * 60_000) return null;
      claimed = true;
      return { last_build_attempted_at: now, updated_at: now };
    });
    return claimed;
  }

  async delete({ orgId, id }: { orgId: string; id: string }): Promise<FactoryProject | null> {
    const project = await this.get({ orgId, id });
    if (!project) return null;
    const deleted = await this.#db.deleteMany('factory_projects', { org_id: orgId, id });
    return deleted > 0 ? project : null;
  }
}

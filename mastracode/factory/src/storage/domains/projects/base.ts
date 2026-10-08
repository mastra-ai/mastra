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
  /** Sandbox provider for the Factory's environment (null = never configured). */
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
  sandboxCpuCount?: number | null;
  sandboxMemoryMb?: number | null;
  sandboxIdleTimeoutMinutes?: number | null;
  workspaceSetupCommand?: string | null;
  activeTemplateId?: string | null;
  activeTemplateHeads?: Record<string, string> | null;
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
      ...(input.sandboxCpuCount !== undefined ? { sandbox_cpu_count: input.sandboxCpuCount } : {}),
      ...(input.sandboxMemoryMb !== undefined ? { sandbox_memory_mb: input.sandboxMemoryMb } : {}),
      ...(input.sandboxIdleTimeoutMinutes !== undefined
        ? { sandbox_idle_timeout_minutes: input.sandboxIdleTimeoutMinutes }
        : {}),
      ...(input.workspaceSetupCommand !== undefined ? { workspace_setup_command: input.workspaceSetupCommand } : {}),
      ...(input.activeTemplateId !== undefined ? { active_template_id: input.activeTemplateId } : {}),
      ...(input.activeTemplateHeads !== undefined ? { active_template_heads: input.activeTemplateHeads } : {}),
      updated_at: new Date(),
    }));
    return row ? toFactoryProject(row) : null;
  }

  async delete({ orgId, id }: { orgId: string; id: string }): Promise<FactoryProject | null> {
    const project = await this.get({ orgId, id });
    if (!project) return null;
    const deleted = await this.#db.deleteMany('factory_projects', { org_id: orgId, id });
    return deleted > 0 ? project : null;
  }
}

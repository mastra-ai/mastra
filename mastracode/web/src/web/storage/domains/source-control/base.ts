import { FactoryStorageDomain, UniqueViolationError } from '@mastra/core/storage';
import type { CollectionSchema, FactoryStorageOps } from '@mastra/core/storage';

const INSTALLATIONS = 'source_control_installations';
const PROJECTS = 'source_control_projects';
const SANDBOXES = 'source_control_project_sandboxes';
const WORKTREES = 'source_control_worktrees';

export const SOURCE_CONTROL_SCHEMAS: CollectionSchema[] = [
  {
    name: INSTALLATIONS,
    columns: {
      id: { type: 'uuid-pk' },
      integration_id: { type: 'text' },
      org_id: { type: 'text' },
      connected_by_user_id: { type: 'text' },
      external_id: { type: 'text' },
      account_name: { type: 'text', nullable: true },
      account_type: { type: 'text', nullable: true },
      provider_metadata: { type: 'json' },
      created_at: { type: 'timestamp' },
    },
    uniqueIndexes: [
      {
        name: 'source_control_installations_integration_org_external_unique',
        columns: ['integration_id', 'org_id', 'external_id'],
      },
    ],
  },
  {
    name: PROJECTS,
    columns: {
      id: { type: 'uuid-pk' },
      integration_id: { type: 'text' },
      org_id: { type: 'text' },
      created_by_user_id: { type: 'text' },
      installation_external_id: { type: 'text' },
      repository_external_id: { type: 'text' },
      repository_slug: { type: 'text' },
      default_branch: { type: 'text', default: 'main' },
      sandbox_provider: { type: 'text' },
      sandbox_workdir: { type: 'text' },
      setup_command: { type: 'text', nullable: true },
      provider_metadata: { type: 'json' },
      created_at: { type: 'timestamp' },
    },
    uniqueIndexes: [
      {
        name: 'source_control_projects_integration_org_repository_unique',
        columns: ['integration_id', 'org_id', 'repository_external_id'],
      },
    ],
    indexes: [
      {
        name: 'source_control_projects_org_repository_lookup',
        columns: ['integration_id', 'org_id', 'installation_external_id', 'repository_slug'],
      },
      {
        name: 'source_control_projects_repository_lookup',
        columns: ['integration_id', 'installation_external_id', 'repository_slug'],
      },
    ],
  },
  {
    name: SANDBOXES,
    columns: {
      id: { type: 'uuid-pk' },
      project_id: { type: 'text' },
      user_id: { type: 'text' },
      sandbox_id: { type: 'text', nullable: true },
      sandbox_workdir: { type: 'text' },
      materialized_at: { type: 'timestamp', nullable: true },
      created_at: { type: 'timestamp' },
    },
    uniqueIndexes: [
      {
        name: 'source_control_project_sandboxes_project_user_unique',
        columns: ['project_id', 'user_id'],
      },
    ],
  },
  {
    name: WORKTREES,
    columns: {
      id: { type: 'uuid-pk' },
      project_id: { type: 'text' },
      org_id: { type: 'text' },
      user_id: { type: 'text' },
      branch: { type: 'text' },
      base_branch: { type: 'text' },
      worktree_path: { type: 'text' },
      created_at: { type: 'timestamp' },
    },
    uniqueIndexes: [
      {
        name: 'source_control_worktrees_project_user_branch_unique',
        columns: ['project_id', 'user_id', 'branch'],
      },
    ],
  },
];

export type SourceControlProviderMetadata = Record<string, unknown>;

export interface SourceControlInstallation {
  id: string;
  integrationId: string;
  orgId: string;
  connectedByUserId: string;
  externalId: string;
  accountName: string | null;
  accountType: string | null;
  providerMetadata: SourceControlProviderMetadata;
  createdAt: Date;
}

export interface NewSourceControlInstallation {
  orgId: string;
  connectedByUserId: string;
  externalId: string;
  accountName?: string | null;
  accountType?: string | null;
  providerMetadata?: SourceControlProviderMetadata;
}

export interface SourceControlProject {
  id: string;
  integrationId: string;
  orgId: string;
  createdByUserId: string;
  installationExternalId: string;
  repositoryExternalId: string;
  repositorySlug: string;
  defaultBranch: string;
  sandboxProvider: string;
  sandboxWorkdir: string;
  setupCommand: string | null;
  providerMetadata: SourceControlProviderMetadata;
  createdAt: Date;
}

export interface UpsertSourceControlProjectInput {
  orgId: string;
  createdByUserId: string;
  installationExternalId: string;
  repositoryExternalId: string;
  repositorySlug: string;
  defaultBranch: string;
  sandboxProvider: string;
  sandboxWorkdir: string;
  providerMetadata?: SourceControlProviderMetadata;
}

export interface SourceControlProjectSandbox {
  id: string;
  projectId: string;
  userId: string;
  sandboxId: string | null;
  sandboxWorkdir: string;
  materializedAt: Date | null;
  createdAt: Date;
}

export interface SourceControlWorktree {
  id: string;
  projectId: string;
  orgId: string;
  userId: string;
  branch: string;
  baseBranch: string;
  worktreePath: string;
  createdAt: Date;
}

export interface UpsertSourceControlWorktreeInput {
  projectId: string;
  orgId: string;
  userId: string;
  branch: string;
  baseBranch: string;
  worktreePath: string;
}

export interface SourceControlStorageHandle {
  readonly integrationId: string;
  readonly installations: {
    list(orgId: string): Promise<SourceControlInstallation[]>;
    get(orgId: string, externalId: string): Promise<SourceControlInstallation | null>;
    insert(input: NewSourceControlInstallation): Promise<void>;
    delete(orgId: string, externalId: string): Promise<void>;
  };
  readonly projects: {
    list(orgId: string): Promise<SourceControlProject[]>;
    getOrg(orgId: string, projectId: string): Promise<SourceControlProject | null>;
    getById(projectId: string): Promise<SourceControlProject | null>;
    findByRepository(
      orgId: string,
      installationExternalId: string,
      repositorySlug: string,
    ): Promise<SourceControlProject | null>;
    listByRepository(installationExternalId: string, repositorySlug: string): Promise<SourceControlProject[]>;
    upsert(input: UpsertSourceControlProjectInput): Promise<SourceControlProject>;
    setSetupCommand(projectId: string, setupCommand: string | null): Promise<void>;
    delete(orgId: string, projectId: string): Promise<void>;
  };
  readonly sandboxes: {
    list(projectId: string): Promise<SourceControlProjectSandbox[]>;
    get(projectId: string, userId: string): Promise<SourceControlProjectSandbox | null>;
    getOrCreate(project: { id: string; sandboxWorkdir: string }, userId: string): Promise<SourceControlProjectSandbox>;
    getById(id: string): Promise<SourceControlProjectSandbox | null>;
    setSandboxId(id: string, sandboxId: string): Promise<void>;
    clearBinding(id: string): Promise<void>;
    markMaterialized(id: string): Promise<void>;
  };
  readonly worktrees: {
    list(projectId: string, userId: string): Promise<SourceControlWorktree[]>;
    upsert(input: UpsertSourceControlWorktreeInput): Promise<void>;
    get(projectId: string, userId: string, branch: string): Promise<SourceControlWorktree | null>;
    findByPath(projectId: string, userId: string, worktreePath: string): Promise<SourceControlWorktree | null>;
    delete(projectId: string, userId: string, branch: string): Promise<void>;
  };
}

interface InstallationDbRow extends Record<string, unknown> {
  id: string;
  integration_id: string;
  org_id: string;
  connected_by_user_id: string;
  external_id: string;
  account_name: string | null;
  account_type: string | null;
  provider_metadata: SourceControlProviderMetadata;
  created_at: Date;
}

interface ProjectDbRow extends Record<string, unknown> {
  id: string;
  integration_id: string;
  org_id: string;
  created_by_user_id: string;
  installation_external_id: string;
  repository_external_id: string;
  repository_slug: string;
  default_branch: string;
  sandbox_provider: string;
  sandbox_workdir: string;
  setup_command: string | null;
  provider_metadata: SourceControlProviderMetadata;
  created_at: Date;
}

interface SandboxDbRow extends Record<string, unknown> {
  id: string;
  project_id: string;
  user_id: string;
  sandbox_id: string | null;
  sandbox_workdir: string;
  materialized_at: Date | null;
  created_at: Date;
}

interface WorktreeDbRow extends Record<string, unknown> {
  id: string;
  project_id: string;
  org_id: string;
  user_id: string;
  branch: string;
  base_branch: string;
  worktree_path: string;
  created_at: Date;
}

function toInstallation(row: InstallationDbRow): SourceControlInstallation {
  return {
    id: row.id,
    integrationId: row.integration_id,
    orgId: row.org_id,
    connectedByUserId: row.connected_by_user_id,
    externalId: row.external_id,
    accountName: row.account_name,
    accountType: row.account_type,
    providerMetadata: row.provider_metadata,
    createdAt: row.created_at,
  };
}

function toProject(row: ProjectDbRow): SourceControlProject {
  return {
    id: row.id,
    integrationId: row.integration_id,
    orgId: row.org_id,
    createdByUserId: row.created_by_user_id,
    installationExternalId: row.installation_external_id,
    repositoryExternalId: row.repository_external_id,
    repositorySlug: row.repository_slug,
    defaultBranch: row.default_branch,
    sandboxProvider: row.sandbox_provider,
    sandboxWorkdir: row.sandbox_workdir,
    setupCommand: row.setup_command,
    providerMetadata: row.provider_metadata,
    createdAt: row.created_at,
  };
}

function toSandbox(row: SandboxDbRow): SourceControlProjectSandbox {
  return {
    id: row.id,
    projectId: row.project_id,
    userId: row.user_id,
    sandboxId: row.sandbox_id,
    sandboxWorkdir: row.sandbox_workdir,
    materializedAt: row.materialized_at,
    createdAt: row.created_at,
  };
}

function toWorktree(row: WorktreeDbRow): SourceControlWorktree {
  return {
    id: row.id,
    projectId: row.project_id,
    orgId: row.org_id,
    userId: row.user_id,
    branch: row.branch,
    baseBranch: row.base_branch,
    worktreePath: row.worktree_path,
    createdAt: row.created_at,
  };
}

export class SourceControlStorage extends FactoryStorageDomain {
  constructor() {
    super('source-control');
  }

  async init(): Promise<void> {
    await this.ensureCollections(SOURCE_CONTROL_SCHEMAS);
  }

  async dangerouslyClearAll(): Promise<void> {
    await this.ops.deleteMany(WORKTREES, {});
    await this.ops.deleteMany(SANDBOXES, {});
    await this.ops.deleteMany(PROJECTS, {});
    await this.ops.deleteMany(INSTALLATIONS, {});
  }

  forIntegration(integrationId: string): SourceControlStorageHandle {
    if (!integrationId.trim()) throw new Error('[SourceControlStorage] integrationId must not be empty.');
    const db = (): FactoryStorageOps => this.ops;

    const getProject = async (projectId: string): Promise<SourceControlProject | null> => {
      const row = await db().findOne<ProjectDbRow>(PROJECTS, { id: projectId, integration_id: integrationId });
      return row ? toProject(row) : null;
    };

    const requireProject = async (projectId: string): Promise<SourceControlProject> => {
      const project = await getProject(projectId);
      if (!project) throw new Error('Source-control project not found for this integration.');
      return project;
    };

    const getSandbox = async (id: string): Promise<SourceControlProjectSandbox | null> => {
      const row = await db().findOne<SandboxDbRow>(SANDBOXES, { id });
      if (!row || !(await getProject(row.project_id))) return null;
      return toSandbox(row);
    };

    const requireSandbox = async (id: string): Promise<SourceControlProjectSandbox> => {
      const sandbox = await getSandbox(id);
      if (!sandbox) throw new Error('Source-control sandbox not found for this integration.');
      return sandbox;
    };

    return {
      integrationId,
      installations: {
        list: async orgId =>
          (
            await db().findMany<InstallationDbRow>(INSTALLATIONS, {
              integration_id: integrationId,
              org_id: orgId,
            })
          ).map(toInstallation),
        get: async (orgId, externalId) => {
          const row = await db().findOne<InstallationDbRow>(INSTALLATIONS, {
            integration_id: integrationId,
            org_id: orgId,
            external_id: externalId,
          });
          return row ? toInstallation(row) : null;
        },
        insert: async input => {
          try {
            await db().insertOne(INSTALLATIONS, {
              integration_id: integrationId,
              org_id: input.orgId,
              connected_by_user_id: input.connectedByUserId,
              external_id: input.externalId,
              account_name: input.accountName ?? null,
              account_type: input.accountType ?? null,
              provider_metadata: input.providerMetadata ?? {},
              created_at: new Date(),
            });
          } catch (error) {
            if (!(error instanceof UniqueViolationError)) throw error;
          }
        },
        delete: async (orgId, externalId) => {
          await db().deleteMany(INSTALLATIONS, {
            integration_id: integrationId,
            org_id: orgId,
            external_id: externalId,
          });
        },
      },
      projects: {
        list: async orgId =>
          (
            await db().findMany<ProjectDbRow>(PROJECTS, {
              integration_id: integrationId,
              org_id: orgId,
            })
          ).map(toProject),
        getOrg: async (orgId, projectId) => {
          const row = await db().findOne<ProjectDbRow>(PROJECTS, {
            id: projectId,
            integration_id: integrationId,
            org_id: orgId,
          });
          return row ? toProject(row) : null;
        },
        getById: getProject,
        findByRepository: async (orgId, installationExternalId, repositorySlug) => {
          const row = await db().findOne<ProjectDbRow>(PROJECTS, {
            integration_id: integrationId,
            org_id: orgId,
            installation_external_id: installationExternalId,
            repository_slug: repositorySlug,
          });
          return row ? toProject(row) : null;
        },
        listByRepository: async (installationExternalId, repositorySlug) =>
          (
            await db().findMany<ProjectDbRow>(PROJECTS, {
              integration_id: integrationId,
              installation_external_id: installationExternalId,
              repository_slug: repositorySlug,
            })
          ).map(toProject),
        upsert: async input => {
          const row = await db().upsertOne<ProjectDbRow>(
            PROJECTS,
            ['integration_id', 'org_id', 'repository_external_id'],
            {
              integration_id: integrationId,
              org_id: input.orgId,
              created_by_user_id: input.createdByUserId,
              installation_external_id: input.installationExternalId,
              repository_external_id: input.repositoryExternalId,
              repository_slug: input.repositorySlug,
              default_branch: input.defaultBranch,
              sandbox_provider: input.sandboxProvider,
              sandbox_workdir: input.sandboxWorkdir,
              provider_metadata: input.providerMetadata ?? {},
              created_at: new Date(),
            },
          );
          return toProject(row);
        },
        setSetupCommand: async (projectId, setupCommand) => {
          await requireProject(projectId);
          await db().updateMany(
            PROJECTS,
            { id: projectId, integration_id: integrationId },
            { setup_command: setupCommand },
          );
        },
        delete: async (orgId, projectId) => {
          const project = await db().findOne<ProjectDbRow>(PROJECTS, {
            id: projectId,
            integration_id: integrationId,
            org_id: orgId,
          });
          if (!project) return;
          await db().deleteMany(WORKTREES, { project_id: projectId });
          await db().deleteMany(SANDBOXES, { project_id: projectId });
          await db().deleteMany(PROJECTS, { id: projectId, integration_id: integrationId, org_id: orgId });
        },
      },
      sandboxes: {
        list: async projectId => {
          if (!(await getProject(projectId))) return [];
          return (await db().findMany<SandboxDbRow>(SANDBOXES, { project_id: projectId })).map(toSandbox);
        },
        get: async (projectId, userId) => {
          if (!(await getProject(projectId))) return null;
          const row = await db().findOne<SandboxDbRow>(SANDBOXES, { project_id: projectId, user_id: userId });
          return row ? toSandbox(row) : null;
        },
        getOrCreate: async (project, userId) => {
          const persistedProject = await requireProject(project.id);
          const sandboxWorkdir = persistedProject.sandboxWorkdir;
          const where = { project_id: project.id, user_id: userId };
          const existing = await db().findOne<SandboxDbRow>(SANDBOXES, where);
          if (existing) {
            if (existing.sandbox_workdir !== sandboxWorkdir) {
              await db().updateMany(SANDBOXES, where, {
                sandbox_id: null,
                sandbox_workdir: sandboxWorkdir,
                materialized_at: null,
              });
              return toSandbox({
                ...existing,
                sandbox_id: null,
                sandbox_workdir: sandboxWorkdir,
                materialized_at: null,
              });
            }
            return toSandbox(existing);
          }
          try {
            return toSandbox(
              await db().insertOne<SandboxDbRow>(SANDBOXES, {
                ...where,
                sandbox_id: null,
                sandbox_workdir: sandboxWorkdir,
                materialized_at: null,
                created_at: new Date(),
              }),
            );
          } catch (error) {
            if (!(error instanceof UniqueViolationError)) throw error;
            const raced = await db().findOne<SandboxDbRow>(SANDBOXES, where);
            if (!raced) throw error;
            return toSandbox(raced);
          }
        },
        getById: getSandbox,
        setSandboxId: async (id, sandboxId) => {
          await requireSandbox(id);
          await db().updateMany(SANDBOXES, { id }, { sandbox_id: sandboxId });
        },
        clearBinding: async id => {
          await requireSandbox(id);
          await db().updateMany(SANDBOXES, { id }, { sandbox_id: null, materialized_at: null });
        },
        markMaterialized: async id => {
          await requireSandbox(id);
          await db().updateMany(SANDBOXES, { id }, { materialized_at: new Date() });
        },
      },
      worktrees: {
        list: async (projectId, userId) => {
          if (!(await getProject(projectId))) return [];
          return (
            await db().findMany<WorktreeDbRow>(WORKTREES, {
              project_id: projectId,
              user_id: userId,
            })
          ).map(toWorktree);
        },
        upsert: async input => {
          const project = await requireProject(input.projectId);
          if (project.orgId !== input.orgId) throw new Error('Source-control project not found for this organization.');
          await db().upsertOne(WORKTREES, ['project_id', 'user_id', 'branch'], {
            project_id: input.projectId,
            org_id: input.orgId,
            user_id: input.userId,
            branch: input.branch,
            base_branch: input.baseBranch,
            worktree_path: input.worktreePath,
            created_at: new Date(),
          });
        },
        get: async (projectId, userId, branch) => {
          if (!(await getProject(projectId))) return null;
          const row = await db().findOne<WorktreeDbRow>(WORKTREES, {
            project_id: projectId,
            user_id: userId,
            branch,
          });
          return row ? toWorktree(row) : null;
        },
        findByPath: async (projectId, userId, worktreePath) => {
          if (!(await getProject(projectId))) return null;
          const row = await db().findOne<WorktreeDbRow>(WORKTREES, {
            project_id: projectId,
            user_id: userId,
            worktree_path: worktreePath,
          });
          return row ? toWorktree(row) : null;
        },
        delete: async (projectId, userId, branch) => {
          await requireProject(projectId);
          await db().deleteMany(WORKTREES, { project_id: projectId, user_id: userId, branch });
        },
      },
    };
  }
}

import { FactoryStorageDomain, UniqueViolationError } from '@mastra/core/storage';
import type { CollectionSchema, FactoryStorageOps } from '@mastra/core/storage';

const FACTORY_PROJECTS = 'factory_projects';
const INSTALLATIONS = 'source_control_installations';
const REPOSITORIES = 'source_control_repositories';
const CONNECTIONS = 'factory_project_source_control_connections';
const PROJECT_REPOSITORIES = 'factory_project_repositories';
const SANDBOXES = 'source_control_project_repository_sandboxes';
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
    name: REPOSITORIES,
    columns: {
      id: { type: 'uuid-pk' },
      installation_id: { type: 'text' },
      external_id: { type: 'text' },
      slug: { type: 'text' },
      default_branch: { type: 'text', default: 'main' },
      provider_metadata: { type: 'json' },
      created_at: { type: 'timestamp' },
      updated_at: { type: 'timestamp' },
    },
    uniqueIndexes: [
      {
        name: 'source_control_repositories_installation_external_unique',
        columns: ['installation_id', 'external_id'],
      },
    ],
    indexes: [
      {
        name: 'source_control_repositories_installation_slug_idx',
        columns: ['installation_id', 'slug'],
      },
    ],
  },
  {
    name: CONNECTIONS,
    columns: {
      id: { type: 'uuid-pk' },
      factory_project_id: { type: 'text' },
      integration_id: { type: 'text' },
      installation_id: { type: 'text' },
      created_by_user_id: { type: 'text' },
      created_at: { type: 'timestamp' },
    },
    uniqueIndexes: [
      {
        name: 'factory_project_source_control_connections_project_integration_installation_unique',
        columns: ['factory_project_id', 'integration_id', 'installation_id'],
      },
    ],
    indexes: [
      {
        name: 'factory_project_source_control_connections_project_idx',
        columns: ['factory_project_id'],
      },
    ],
  },
  {
    name: PROJECT_REPOSITORIES,
    columns: {
      id: { type: 'uuid-pk' },
      connection_id: { type: 'text' },
      repository_id: { type: 'text' },
      created_by_user_id: { type: 'text' },
      branch: { type: 'text', nullable: true },
      sandbox_provider: { type: 'text' },
      sandbox_workdir: { type: 'text' },
      setup_command: { type: 'text', nullable: true },
      created_at: { type: 'timestamp' },
      updated_at: { type: 'timestamp' },
    },
    uniqueIndexes: [
      {
        name: 'factory_project_repositories_connection_repository_unique',
        columns: ['connection_id', 'repository_id'],
      },
    ],
    indexes: [
      {
        name: 'factory_project_repositories_connection_idx',
        columns: ['connection_id'],
      },
    ],
  },
  {
    name: SANDBOXES,
    columns: {
      id: { type: 'uuid-pk' },
      project_repository_id: { type: 'text' },
      user_id: { type: 'text' },
      sandbox_id: { type: 'text', nullable: true },
      sandbox_workdir: { type: 'text' },
      materialized_at: { type: 'timestamp', nullable: true },
      created_at: { type: 'timestamp' },
    },
    uniqueIndexes: [
      {
        name: 'source_control_project_repository_sandboxes_link_user_unique',
        columns: ['project_repository_id', 'user_id'],
      },
    ],
  },
  {
    name: WORKTREES,
    columns: {
      id: { type: 'uuid-pk' },
      project_repository_id: { type: 'text' },
      user_id: { type: 'text' },
      branch: { type: 'text' },
      base_branch: { type: 'text' },
      worktree_path: { type: 'text' },
      created_at: { type: 'timestamp' },
    },
    uniqueIndexes: [
      {
        name: 'source_control_worktrees_project_repository_user_branch_unique',
        columns: ['project_repository_id', 'user_id', 'branch'],
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

export interface UpsertSourceControlInstallationInput {
  orgId: string;
  connectedByUserId: string;
  externalId: string;
  accountName?: string | null;
  accountType?: string | null;
  providerMetadata?: SourceControlProviderMetadata;
}

export interface SourceControlRepository {
  id: string;
  installationId: string;
  externalId: string;
  slug: string;
  defaultBranch: string;
  providerMetadata: SourceControlProviderMetadata;
  createdAt: Date;
  updatedAt: Date;
}

export interface UpsertSourceControlRepositoryInput {
  installationId: string;
  externalId: string;
  slug: string;
  defaultBranch: string;
  providerMetadata?: SourceControlProviderMetadata;
}

export interface ProjectSourceControlConnection {
  id: string;
  factoryProjectId: string;
  integrationId: string;
  installationId: string;
  createdByUserId: string;
  createdAt: Date;
}

export interface CreateProjectSourceControlConnectionInput {
  orgId: string;
  factoryProjectId: string;
  installationId: string;
  createdByUserId: string;
}

export interface ProjectRepository {
  id: string;
  connectionId: string;
  repositoryId: string;
  createdByUserId: string;
  branch: string | null;
  sandboxProvider: string;
  sandboxWorkdir: string;
  setupCommand: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ExternalRepositoryProjectTarget {
  orgId: string;
  factoryProjectId: string;
  projectRepository: ProjectRepository;
}

export interface LinkProjectRepositoryInput {
  orgId: string;
  connectionId: string;
  repositoryId: string;
  createdByUserId: string;
  branch?: string | null;
  sandboxProvider: string;
  sandboxWorkdir: string;
  setupCommand?: string | null;
}

export interface UpdateProjectRepositoryInput {
  branch?: string | null;
  sandboxProvider?: string;
  sandboxWorkdir?: string;
  setupCommand?: string | null;
}

export interface ProjectRepositorySandbox {
  id: string;
  projectRepositoryId: string;
  userId: string;
  sandboxId: string | null;
  sandboxWorkdir: string;
  materializedAt: Date | null;
  createdAt: Date;
}

export interface SourceControlWorktree {
  id: string;
  projectRepositoryId: string;
  userId: string;
  branch: string;
  baseBranch: string;
  worktreePath: string;
  createdAt: Date;
}

export interface UpsertSourceControlWorktreeInput {
  projectRepositoryId: string;
  userId: string;
  branch: string;
  baseBranch: string;
  worktreePath: string;
}

export interface SourceControlStorageHandle {
  readonly integrationId: string;
  readonly installations: {
    list(args: { orgId: string }): Promise<SourceControlInstallation[]>;
    get(args: { orgId: string; id: string }): Promise<SourceControlInstallation | null>;
    findByExternalId(args: { orgId: string; externalId: string }): Promise<SourceControlInstallation | null>;
    upsert(args: UpsertSourceControlInstallationInput): Promise<SourceControlInstallation>;
    delete(args: { orgId: string; id: string }): Promise<boolean>;
  };
  readonly repositories: {
    list(args: { orgId: string; installationId: string }): Promise<SourceControlRepository[]>;
    get(args: { orgId: string; id: string }): Promise<SourceControlRepository | null>;
    findByExternalId(args: {
      orgId: string;
      installationId: string;
      externalId: string;
    }): Promise<SourceControlRepository | null>;
    findBySlug(args: { orgId: string; installationId: string; slug: string }): Promise<SourceControlRepository | null>;
    upsert(args: { orgId: string; input: UpsertSourceControlRepositoryInput }): Promise<SourceControlRepository>;
  };
  readonly connections: {
    list(args: { orgId: string; factoryProjectId: string }): Promise<ProjectSourceControlConnection[]>;
    get(args: { orgId: string; id: string }): Promise<ProjectSourceControlConnection | null>;
    create(args: CreateProjectSourceControlConnectionInput): Promise<ProjectSourceControlConnection>;
    delete(args: { orgId: string; id: string }): Promise<boolean>;
  };
  readonly projectRepositories: {
    list(args: { orgId: string; connectionId: string }): Promise<ProjectRepository[]>;
    listByExternalRepository(args: {
      installationExternalId: string;
      repositoryExternalId: string;
    }): Promise<ExternalRepositoryProjectTarget[]>;
    get(args: { orgId: string; id: string }): Promise<ProjectRepository | null>;
    link(args: LinkProjectRepositoryInput): Promise<ProjectRepository>;
    update(args: { orgId: string; id: string; input: UpdateProjectRepositoryInput }): Promise<ProjectRepository | null>;
    unlink(args: { orgId: string; id: string }): Promise<boolean>;
  };
  readonly sandboxes: {
    getOrCreate(args: { projectRepository: ProjectRepository; userId: string }): Promise<ProjectRepositorySandbox>;
    getById(args: { id: string }): Promise<ProjectRepositorySandbox | null>;
    setSandboxId(args: { id: string; sandboxId: string }): Promise<void>;
    clearBinding(args: { id: string }): Promise<void>;
    markMaterialized(args: { id: string }): Promise<void>;
  };
  readonly worktrees: {
    upsert(args: UpsertSourceControlWorktreeInput): Promise<void>;
    get(args: { projectRepositoryId: string; userId: string; branch: string }): Promise<SourceControlWorktree | null>;
    findByPath(args: {
      projectRepositoryId: string;
      userId: string;
      worktreePath: string;
    }): Promise<SourceControlWorktree | null>;
    delete(args: { projectRepositoryId: string; userId: string; branch: string }): Promise<void>;
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

interface RepositoryDbRow extends Record<string, unknown> {
  id: string;
  installation_id: string;
  external_id: string;
  slug: string;
  default_branch: string;
  provider_metadata: SourceControlProviderMetadata;
  created_at: Date;
  updated_at: Date;
}

interface ConnectionDbRow extends Record<string, unknown> {
  id: string;
  factory_project_id: string;
  integration_id: string;
  installation_id: string;
  created_by_user_id: string;
  created_at: Date;
}

interface ProjectRepositoryDbRow extends Record<string, unknown> {
  id: string;
  connection_id: string;
  repository_id: string;
  created_by_user_id: string;
  branch: string | null;
  sandbox_provider: string;
  sandbox_workdir: string;
  setup_command: string | null;
  created_at: Date;
  updated_at: Date;
}

interface SandboxDbRow extends Record<string, unknown> {
  id: string;
  project_repository_id: string;
  user_id: string;
  sandbox_id: string | null;
  sandbox_workdir: string;
  materialized_at: Date | null;
  created_at: Date;
}

interface WorktreeDbRow extends Record<string, unknown> {
  id: string;
  project_repository_id: string;
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

function toRepository(row: RepositoryDbRow): SourceControlRepository {
  return {
    id: row.id,
    installationId: row.installation_id,
    externalId: row.external_id,
    slug: row.slug,
    defaultBranch: row.default_branch,
    providerMetadata: row.provider_metadata,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toConnection(row: ConnectionDbRow): ProjectSourceControlConnection {
  return {
    id: row.id,
    factoryProjectId: row.factory_project_id,
    integrationId: row.integration_id,
    installationId: row.installation_id,
    createdByUserId: row.created_by_user_id,
    createdAt: row.created_at,
  };
}

function toProjectRepository(row: ProjectRepositoryDbRow): ProjectRepository {
  return {
    id: row.id,
    connectionId: row.connection_id,
    repositoryId: row.repository_id,
    createdByUserId: row.created_by_user_id,
    branch: row.branch,
    sandboxProvider: row.sandbox_provider,
    sandboxWorkdir: row.sandbox_workdir,
    setupCommand: row.setup_command,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toSandbox(row: SandboxDbRow): ProjectRepositorySandbox {
  return {
    id: row.id,
    projectRepositoryId: row.project_repository_id,
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
    projectRepositoryId: row.project_repository_id,
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
    await this.ops.deleteMany(PROJECT_REPOSITORIES, {});
    await this.ops.deleteMany(CONNECTIONS, {});
    await this.ops.deleteMany(REPOSITORIES, {});
    await this.ops.deleteMany(INSTALLATIONS, {});
  }

  forIntegration(integrationId: string): SourceControlStorageHandle {
    if (!integrationId.trim()) throw new Error('[SourceControlStorage] integrationId must not be empty.');
    const db = (): FactoryStorageOps => this.ops;

    const getInstallation = async (args: { orgId: string; id: string }): Promise<SourceControlInstallation | null> => {
      const row = await db().findOne<InstallationDbRow>(INSTALLATIONS, {
        id: args.id,
        integration_id: integrationId,
        org_id: args.orgId,
      });
      return row ? toInstallation(row) : null;
    };

    const requireInstallation = async (args: { orgId: string; id: string }): Promise<SourceControlInstallation> => {
      const installation = await getInstallation(args);
      if (!installation)
        throw new Error('Source-control installation not found for this organization and integration.');
      return installation;
    };

    const getRepository = async (args: { orgId: string; id: string }): Promise<SourceControlRepository | null> => {
      const row = await db().findOne<RepositoryDbRow>(REPOSITORIES, { id: args.id });
      if (!row || !(await getInstallation({ orgId: args.orgId, id: row.installation_id }))) return null;
      return toRepository(row);
    };

    const requireRepository = async (args: { orgId: string; id: string }): Promise<SourceControlRepository> => {
      const repository = await getRepository(args);
      if (!repository) throw new Error('Source-control repository not found for this organization and integration.');
      return repository;
    };

    const getConnection = async (args: {
      orgId: string;
      id: string;
    }): Promise<ProjectSourceControlConnection | null> => {
      const row = await db().findOne<ConnectionDbRow>(CONNECTIONS, { id: args.id, integration_id: integrationId });
      if (!row) return null;
      const project = await db().findOne<Record<string, unknown>>(FACTORY_PROJECTS, {
        id: row.factory_project_id,
        org_id: args.orgId,
      });
      if (!project || !(await getInstallation({ orgId: args.orgId, id: row.installation_id }))) return null;
      return toConnection(row);
    };

    const requireConnection = async (args: { orgId: string; id: string }): Promise<ProjectSourceControlConnection> => {
      const connection = await getConnection(args);
      if (!connection)
        throw new Error('Project source-control connection not found for this organization and integration.');
      return connection;
    };

    const getProjectRepository = async (args: { orgId: string; id: string }): Promise<ProjectRepository | null> => {
      const row = await db().findOne<ProjectRepositoryDbRow>(PROJECT_REPOSITORIES, { id: args.id });
      if (!row || !(await getConnection({ orgId: args.orgId, id: row.connection_id }))) return null;
      return toProjectRepository(row);
    };

    const getProjectRepositoryById = async (id: string): Promise<ProjectRepository | null> => {
      const row = await db().findOne<ProjectRepositoryDbRow>(PROJECT_REPOSITORIES, { id });
      if (!row) return null;
      const connection = await db().findOne<ConnectionDbRow>(CONNECTIONS, {
        id: row.connection_id,
        integration_id: integrationId,
      });
      return connection ? toProjectRepository(row) : null;
    };

    const requireProjectRepositoryById = async (id: string): Promise<ProjectRepository> => {
      const projectRepository = await getProjectRepositoryById(id);
      if (!projectRepository) throw new Error('Project repository not found for this integration.');
      return projectRepository;
    };

    const getSandbox = async (id: string): Promise<ProjectRepositorySandbox | null> => {
      const row = await db().findOne<SandboxDbRow>(SANDBOXES, { id });
      if (!row || !(await getProjectRepositoryById(row.project_repository_id))) return null;
      return toSandbox(row);
    };

    const requireSandbox = async (id: string): Promise<ProjectRepositorySandbox> => {
      const sandbox = await getSandbox(id);
      if (!sandbox) throw new Error('Project-repository sandbox not found for this integration.');
      return sandbox;
    };

    return {
      integrationId,
      installations: {
        list: async ({ orgId }) =>
          (
            await db().findMany<InstallationDbRow>(INSTALLATIONS, {
              integration_id: integrationId,
              org_id: orgId,
            })
          ).map(toInstallation),
        get: getInstallation,
        findByExternalId: async ({ orgId, externalId }) => {
          const row = await db().findOne<InstallationDbRow>(INSTALLATIONS, {
            integration_id: integrationId,
            org_id: orgId,
            external_id: externalId,
          });
          return row ? toInstallation(row) : null;
        },
        upsert: async input => {
          const row = await db().upsertOne<InstallationDbRow>(
            INSTALLATIONS,
            ['integration_id', 'org_id', 'external_id'],
            {
              integration_id: integrationId,
              org_id: input.orgId,
              connected_by_user_id: input.connectedByUserId,
              external_id: input.externalId,
              account_name: input.accountName ?? null,
              account_type: input.accountType ?? null,
              provider_metadata: input.providerMetadata ?? {},
              created_at: new Date(),
            },
          );
          return toInstallation(row);
        },
        delete: async ({ orgId, id }) => {
          const installation = await getInstallation({ orgId, id });
          if (!installation) return false;
          await db().deleteMany(INSTALLATIONS, { id, integration_id: integrationId, org_id: orgId });
          return true;
        },
      },
      repositories: {
        list: async ({ orgId, installationId }) => {
          await requireInstallation({ orgId, id: installationId });
          return (await db().findMany<RepositoryDbRow>(REPOSITORIES, { installation_id: installationId })).map(
            toRepository,
          );
        },
        get: getRepository,
        findByExternalId: async ({ orgId, installationId, externalId }) => {
          await requireInstallation({ orgId, id: installationId });
          const row = await db().findOne<RepositoryDbRow>(REPOSITORIES, {
            installation_id: installationId,
            external_id: externalId,
          });
          return row ? toRepository(row) : null;
        },
        findBySlug: async ({ orgId, installationId, slug }) => {
          await requireInstallation({ orgId, id: installationId });
          const row = await db().findOne<RepositoryDbRow>(REPOSITORIES, { installation_id: installationId, slug });
          return row ? toRepository(row) : null;
        },
        upsert: async ({ orgId, input }) => {
          await requireInstallation({ orgId, id: input.installationId });
          const now = new Date();
          const row = await db().upsertOne<RepositoryDbRow>(REPOSITORIES, ['installation_id', 'external_id'], {
            installation_id: input.installationId,
            external_id: input.externalId,
            slug: input.slug,
            default_branch: input.defaultBranch,
            provider_metadata: input.providerMetadata ?? {},
            created_at: now,
            updated_at: now,
          });
          return toRepository(row);
        },
      },
      connections: {
        list: async ({ orgId, factoryProjectId }) => {
          const project = await db().findOne<Record<string, unknown>>(FACTORY_PROJECTS, {
            id: factoryProjectId,
            org_id: orgId,
          });
          if (!project) return [];
          return (
            await db().findMany<ConnectionDbRow>(CONNECTIONS, {
              factory_project_id: factoryProjectId,
              integration_id: integrationId,
            })
          ).map(toConnection);
        },
        get: getConnection,
        create: async input => {
          const project = await db().findOne<Record<string, unknown>>(FACTORY_PROJECTS, {
            id: input.factoryProjectId,
            org_id: input.orgId,
          });
          if (!project) throw new Error('Factory project not found for this organization.');
          await requireInstallation({ orgId: input.orgId, id: input.installationId });
          try {
            const row = await db().insertOne<ConnectionDbRow>(CONNECTIONS, {
              factory_project_id: input.factoryProjectId,
              integration_id: integrationId,
              installation_id: input.installationId,
              created_by_user_id: input.createdByUserId,
              created_at: new Date(),
            });
            return toConnection(row);
          } catch (error) {
            if (!(error instanceof UniqueViolationError)) throw error;
            const row = await db().findOne<ConnectionDbRow>(CONNECTIONS, {
              factory_project_id: input.factoryProjectId,
              integration_id: integrationId,
              installation_id: input.installationId,
            });
            if (!row) throw error;
            return toConnection(row);
          }
        },
        delete: async ({ orgId, id }) => {
          const connection = await getConnection({ orgId, id });
          if (!connection) return false;
          const projectRepositories = await db().findMany<ProjectRepositoryDbRow>(PROJECT_REPOSITORIES, {
            connection_id: id,
          });
          for (const projectRepository of projectRepositories) {
            await db().deleteMany(WORKTREES, { project_repository_id: projectRepository.id });
            await db().deleteMany(SANDBOXES, { project_repository_id: projectRepository.id });
          }
          await db().deleteMany(PROJECT_REPOSITORIES, { connection_id: id });
          await db().deleteMany(CONNECTIONS, { id, integration_id: integrationId });
          return true;
        },
      },
      projectRepositories: {
        list: async ({ orgId, connectionId }) => {
          await requireConnection({ orgId, id: connectionId });
          return (
            await db().findMany<ProjectRepositoryDbRow>(PROJECT_REPOSITORIES, { connection_id: connectionId })
          ).map(toProjectRepository);
        },
        listByExternalRepository: async ({ installationExternalId, repositoryExternalId }) => {
          const targets: ExternalRepositoryProjectTarget[] = [];
          const installations = await db().findMany<InstallationDbRow>(INSTALLATIONS, {
            integration_id: integrationId,
            external_id: installationExternalId,
          });
          for (const installation of installations) {
            const repository = await db().findOne<RepositoryDbRow>(REPOSITORIES, {
              installation_id: installation.id,
              external_id: repositoryExternalId,
            });
            if (!repository) continue;
            const links = await db().findMany<ProjectRepositoryDbRow>(PROJECT_REPOSITORIES, {
              repository_id: repository.id,
            });
            for (const link of links) {
              const connection = await db().findOne<ConnectionDbRow>(CONNECTIONS, {
                id: link.connection_id,
                integration_id: integrationId,
                installation_id: installation.id,
              });
              if (!connection) continue;
              const project = await db().findOne<Record<string, unknown>>(FACTORY_PROJECTS, {
                id: connection.factory_project_id,
                org_id: installation.org_id,
              });
              if (!project) continue;
              targets.push({
                orgId: installation.org_id,
                factoryProjectId: connection.factory_project_id,
                projectRepository: toProjectRepository(link),
              });
            }
          }
          return targets;
        },
        get: getProjectRepository,
        link: async input => {
          const connection = await requireConnection({ orgId: input.orgId, id: input.connectionId });
          const repository = await requireRepository({ orgId: input.orgId, id: input.repositoryId });
          if (repository.installationId !== connection.installationId) {
            throw new Error('Repository does not belong to the connection installation.');
          }
          const now = new Date();
          const row = await db().upsertOne<ProjectRepositoryDbRow>(
            PROJECT_REPOSITORIES,
            ['connection_id', 'repository_id'],
            {
              connection_id: input.connectionId,
              repository_id: input.repositoryId,
              created_by_user_id: input.createdByUserId,
              branch: input.branch ?? null,
              sandbox_provider: input.sandboxProvider,
              sandbox_workdir: input.sandboxWorkdir,
              setup_command: input.setupCommand ?? null,
              created_at: now,
              updated_at: now,
            },
          );
          return toProjectRepository(row);
        },
        update: async ({ orgId, id, input }) => {
          const existing = await getProjectRepository({ orgId, id });
          if (!existing) return null;
          const patch: Record<string, unknown> = { updated_at: new Date() };
          if (input.branch !== undefined) patch.branch = input.branch;
          if (input.sandboxProvider !== undefined) patch.sandbox_provider = input.sandboxProvider;
          if (input.sandboxWorkdir !== undefined) patch.sandbox_workdir = input.sandboxWorkdir;
          if (input.setupCommand !== undefined) patch.setup_command = input.setupCommand;
          await db().updateMany(PROJECT_REPOSITORIES, { id }, patch);
          return getProjectRepository({ orgId, id });
        },
        unlink: async ({ orgId, id }) => {
          const existing = await getProjectRepository({ orgId, id });
          if (!existing) return false;
          await db().deleteMany(WORKTREES, { project_repository_id: id });
          await db().deleteMany(SANDBOXES, { project_repository_id: id });
          await db().deleteMany(PROJECT_REPOSITORIES, { id });
          return true;
        },
      },
      sandboxes: {
        getOrCreate: async ({ projectRepository, userId }) => {
          await requireProjectRepositoryById(projectRepository.id);
          const where = { project_repository_id: projectRepository.id, user_id: userId };
          const existing = await db().findOne<SandboxDbRow>(SANDBOXES, where);
          if (existing) return toSandbox(existing);
          try {
            const row = await db().insertOne<SandboxDbRow>(SANDBOXES, {
              ...where,
              sandbox_id: null,
              sandbox_workdir: projectRepository.sandboxWorkdir,
              materialized_at: null,
              created_at: new Date(),
            });
            return toSandbox(row);
          } catch (error) {
            if (!(error instanceof UniqueViolationError)) throw error;
            const row = await db().findOne<SandboxDbRow>(SANDBOXES, where);
            if (!row) throw error;
            return toSandbox(row);
          }
        },
        getById: ({ id }) => getSandbox(id),
        setSandboxId: async ({ id, sandboxId }) => {
          await requireSandbox(id);
          await db().updateMany(SANDBOXES, { id }, { sandbox_id: sandboxId });
        },
        clearBinding: async ({ id }) => {
          await requireSandbox(id);
          await db().updateMany(SANDBOXES, { id }, { sandbox_id: null, materialized_at: null });
        },
        markMaterialized: async ({ id }) => {
          await requireSandbox(id);
          await db().updateMany(SANDBOXES, { id }, { materialized_at: new Date() });
        },
      },
      worktrees: {
        upsert: async input => {
          await requireProjectRepositoryById(input.projectRepositoryId);
          await db().upsertOne<WorktreeDbRow>(WORKTREES, ['project_repository_id', 'user_id', 'branch'], {
            project_repository_id: input.projectRepositoryId,
            user_id: input.userId,
            branch: input.branch,
            base_branch: input.baseBranch,
            worktree_path: input.worktreePath,
            created_at: new Date(),
          });
        },
        get: async ({ projectRepositoryId, userId, branch }) => {
          if (!(await getProjectRepositoryById(projectRepositoryId))) return null;
          const row = await db().findOne<WorktreeDbRow>(WORKTREES, {
            project_repository_id: projectRepositoryId,
            user_id: userId,
            branch,
          });
          return row ? toWorktree(row) : null;
        },
        findByPath: async ({ projectRepositoryId, userId, worktreePath }) => {
          if (!(await getProjectRepositoryById(projectRepositoryId))) return null;
          const row = await db().findOne<WorktreeDbRow>(WORKTREES, {
            project_repository_id: projectRepositoryId,
            user_id: userId,
            worktree_path: worktreePath,
          });
          return row ? toWorktree(row) : null;
        },
        delete: async ({ projectRepositoryId, userId, branch }) => {
          await requireProjectRepositoryById(projectRepositoryId);
          await db().deleteMany(WORKTREES, {
            project_repository_id: projectRepositoryId,
            user_id: userId,
            branch,
          });
        },
      },
    };
  }
}

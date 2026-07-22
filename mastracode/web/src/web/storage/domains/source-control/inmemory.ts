import { randomUUID } from 'node:crypto';

import type {
  CreateProjectSourceControlConnectionInput,
  ExternalRepositoryProjectTarget,
  LinkProjectRepositoryInput,
  ProjectRepository,
  ProjectRepositorySandbox,
  ProjectSourceControlConnection,
  SourceControlInstallation,
  SourceControlRepository,
  SourceControlStorageHandle,
  SourceControlWorktree,
  UpdateProjectRepositoryInput,
  UpsertSourceControlInstallationInput,
  UpsertSourceControlRepositoryInput,
  UpsertSourceControlWorktreeInput,
} from './base';

/** In-memory provider-scoped source-control handle for route tests. */
export class SourceControlStorageInMemory implements SourceControlStorageHandle {
  readonly integrationId: string;
  installationsRows: SourceControlInstallation[] = [];
  repositoriesRows: SourceControlRepository[] = [];
  connectionsRows: ProjectSourceControlConnection[] = [];
  projectRepositoriesRows: ProjectRepository[] = [];
  sandboxesRows: ProjectRepositorySandbox[] = [];
  worktreesRows: SourceControlWorktree[] = [];

  constructor(integrationId = 'github') {
    this.integrationId = integrationId;
  }

  readonly installations = {
    list: async ({ orgId }: { orgId: string }): Promise<SourceControlInstallation[]> =>
      this.installationsRows.filter(row => row.orgId === orgId),
    get: async ({ orgId, id }: { orgId: string; id: string }): Promise<SourceControlInstallation | null> =>
      this.installationsRows.find(row => row.orgId === orgId && row.id === id) ?? null,
    findByExternalId: async ({
      orgId,
      externalId,
    }: {
      orgId: string;
      externalId: string;
    }): Promise<SourceControlInstallation | null> =>
      this.installationsRows.find(row => row.orgId === orgId && row.externalId === externalId) ?? null,
    upsert: async (input: UpsertSourceControlInstallationInput): Promise<SourceControlInstallation> => {
      const existing = this.installationsRows.find(
        row => row.orgId === input.orgId && row.externalId === input.externalId,
      );
      if (existing) {
        Object.assign(existing, {
          connectedByUserId: input.connectedByUserId,
          accountName: input.accountName ?? null,
          accountType: input.accountType ?? null,
          providerMetadata: input.providerMetadata ?? {},
        });
        return existing;
      }
      const created: SourceControlInstallation = {
        id: randomUUID(),
        integrationId: this.integrationId,
        orgId: input.orgId,
        connectedByUserId: input.connectedByUserId,
        externalId: input.externalId,
        accountName: input.accountName ?? null,
        accountType: input.accountType ?? null,
        providerMetadata: input.providerMetadata ?? {},
        createdAt: new Date(),
      };
      this.installationsRows.push(created);
      return created;
    },
    delete: async ({ orgId, id }: { orgId: string; id: string }): Promise<boolean> => {
      const index = this.installationsRows.findIndex(row => row.orgId === orgId && row.id === id);
      if (index < 0) return false;
      this.installationsRows.splice(index, 1);
      return true;
    },
  };

  readonly repositories = {
    list: async ({ orgId, installationId }: { orgId: string; installationId: string }) => {
      const installation = await this.installations.get({ orgId, id: installationId });
      return installation ? this.repositoriesRows.filter(row => row.installationId === installationId) : [];
    },
    get: async ({ orgId, id }: { orgId: string; id: string }): Promise<SourceControlRepository | null> => {
      const row = this.repositoriesRows.find(candidate => candidate.id === id);
      if (!row) return null;
      return (await this.installations.get({ orgId, id: row.installationId })) ? row : null;
    },
    findByExternalId: async ({
      orgId,
      installationId,
      externalId,
    }: {
      orgId: string;
      installationId: string;
      externalId: string;
    }) => {
      const rows = await this.repositories.list({ orgId, installationId });
      return rows.find(row => row.externalId === externalId) ?? null;
    },
    findBySlug: async ({ orgId, installationId, slug }: { orgId: string; installationId: string; slug: string }) => {
      const rows = await this.repositories.list({ orgId, installationId });
      return rows.find(row => row.slug === slug) ?? null;
    },
    upsert: async ({
      orgId,
      input,
    }: {
      orgId: string;
      input: UpsertSourceControlRepositoryInput;
    }): Promise<SourceControlRepository> => {
      if (!(await this.installations.get({ orgId, id: input.installationId }))) {
        throw new Error('Source-control installation not found');
      }
      const existing = this.repositoriesRows.find(
        row => row.installationId === input.installationId && row.externalId === input.externalId,
      );
      const now = new Date();
      if (existing) {
        Object.assign(existing, {
          slug: input.slug,
          defaultBranch: input.defaultBranch,
          providerMetadata: input.providerMetadata ?? {},
          updatedAt: now,
        });
        return existing;
      }
      const created: SourceControlRepository = {
        id: randomUUID(),
        installationId: input.installationId,
        externalId: input.externalId,
        slug: input.slug,
        defaultBranch: input.defaultBranch,
        providerMetadata: input.providerMetadata ?? {},
        createdAt: now,
        updatedAt: now,
      };
      this.repositoriesRows.push(created);
      return created;
    },
  };

  readonly connections = {
    list: async ({ factoryProjectId }: { orgId: string; factoryProjectId: string }) =>
      this.connectionsRows.filter(row => row.factoryProjectId === factoryProjectId),
    get: async ({ orgId, id }: { orgId: string; id: string }): Promise<ProjectSourceControlConnection | null> => {
      const row = this.connectionsRows.find(candidate => candidate.id === id);
      if (!row) return null;
      return (await this.installations.get({ orgId, id: row.installationId })) ? row : null;
    },
    create: async (input: CreateProjectSourceControlConnectionInput): Promise<ProjectSourceControlConnection> => {
      if (!(await this.installations.get({ orgId: input.orgId, id: input.installationId }))) {
        throw new Error('Source-control installation not found');
      }
      const existing = this.connectionsRows.find(
        row =>
          row.factoryProjectId === input.factoryProjectId &&
          row.integrationId === this.integrationId &&
          row.installationId === input.installationId,
      );
      if (existing) return existing;
      const created: ProjectSourceControlConnection = {
        id: randomUUID(),
        factoryProjectId: input.factoryProjectId,
        integrationId: this.integrationId,
        installationId: input.installationId,
        createdByUserId: input.createdByUserId,
        createdAt: new Date(),
      };
      this.connectionsRows.push(created);
      return created;
    },
    delete: async ({ orgId, id }: { orgId: string; id: string }): Promise<boolean> => {
      if (!(await this.connections.get({ orgId, id }))) return false;
      this.connectionsRows.splice(0, this.connectionsRows.length, ...this.connectionsRows.filter(row => row.id !== id));
      return true;
    },
  };

  readonly projectRepositories = {
    list: async ({ orgId, connectionId }: { orgId: string; connectionId: string }) =>
      (await this.connections.get({ orgId, id: connectionId }))
        ? this.projectRepositoriesRows.filter(row => row.connectionId === connectionId)
        : [],
    listByExternalRepository: async ({
      installationExternalId,
      repositoryExternalId,
    }: {
      installationExternalId: string;
      repositoryExternalId: string;
    }): Promise<ExternalRepositoryProjectTarget[]> => {
      const targets: ExternalRepositoryProjectTarget[] = [];
      for (const installation of this.installationsRows.filter(row => row.externalId === installationExternalId)) {
        const repository = this.repositoriesRows.find(
          row => row.installationId === installation.id && row.externalId === repositoryExternalId,
        );
        if (!repository) continue;
        for (const projectRepository of this.projectRepositoriesRows.filter(
          row => row.repositoryId === repository.id,
        )) {
          const connection = this.connectionsRows.find(
            row =>
              row.id === projectRepository.connectionId &&
              row.installationId === installation.id &&
              row.integrationId === this.integrationId,
          );
          if (!connection) continue;
          targets.push({
            orgId: installation.orgId,
            factoryProjectId: connection.factoryProjectId,
            projectRepository,
          });
        }
      }
      return targets;
    },
    get: async ({ orgId, id }: { orgId: string; id: string }): Promise<ProjectRepository | null> => {
      const row = this.projectRepositoriesRows.find(candidate => candidate.id === id);
      if (!row) return null;
      return (await this.connections.get({ orgId, id: row.connectionId })) ? row : null;
    },
    link: async (input: LinkProjectRepositoryInput): Promise<ProjectRepository> => {
      const connection = await this.connections.get({ orgId: input.orgId, id: input.connectionId });
      const repository = await this.repositories.get({ orgId: input.orgId, id: input.repositoryId });
      if (!connection || !repository || repository.installationId !== connection.installationId) {
        throw new Error('Source-control connection or repository not found');
      }
      const existing = this.projectRepositoriesRows.find(
        row => row.connectionId === input.connectionId && row.repositoryId === input.repositoryId,
      );
      if (existing) return existing;
      const now = new Date();
      const created: ProjectRepository = {
        id: randomUUID(),
        connectionId: input.connectionId,
        repositoryId: input.repositoryId,
        createdByUserId: input.createdByUserId,
        branch: input.branch ?? null,
        sandboxProvider: input.sandboxProvider,
        sandboxWorkdir: input.sandboxWorkdir,
        setupCommand: input.setupCommand ?? null,
        createdAt: now,
        updatedAt: now,
      };
      this.projectRepositoriesRows.push(created);
      return created;
    },
    update: async ({
      orgId,
      id,
      input,
    }: {
      orgId: string;
      id: string;
      input: UpdateProjectRepositoryInput;
    }): Promise<ProjectRepository | null> => {
      const row = await this.projectRepositories.get({ orgId, id });
      if (!row) return null;
      Object.assign(row, input, { updatedAt: new Date() });
      return row;
    },
    unlink: async ({ orgId, id }: { orgId: string; id: string }): Promise<boolean> => {
      if (!(await this.projectRepositories.get({ orgId, id }))) return false;
      this.projectRepositoriesRows.splice(
        0,
        this.projectRepositoriesRows.length,
        ...this.projectRepositoriesRows.filter(row => row.id !== id),
      );
      return true;
    },
  };

  readonly sandboxes = {
    getOrCreate: async ({
      projectRepository,
      userId,
    }: {
      projectRepository: ProjectRepository;
      userId: string;
    }): Promise<ProjectRepositorySandbox> => {
      const existing = this.sandboxesRows.find(
        row => row.projectRepositoryId === projectRepository.id && row.userId === userId,
      );
      if (existing) return existing;
      const created: ProjectRepositorySandbox = {
        id: randomUUID(),
        projectRepositoryId: projectRepository.id,
        userId,
        sandboxId: null,
        sandboxWorkdir: projectRepository.sandboxWorkdir,
        materializedAt: null,
        createdAt: new Date(),
      };
      this.sandboxesRows.push(created);
      return created;
    },
    getById: async ({ id }: { id: string }): Promise<ProjectRepositorySandbox | null> =>
      this.sandboxesRows.find(row => row.id === id) ?? null,
    setSandboxId: async ({ id, sandboxId }: { id: string; sandboxId: string }): Promise<void> => {
      const row = this.sandboxesRows.find(candidate => candidate.id === id);
      if (row) row.sandboxId = sandboxId;
    },
    clearBinding: async ({ id }: { id: string }): Promise<void> => {
      const row = this.sandboxesRows.find(candidate => candidate.id === id);
      if (row) Object.assign(row, { sandboxId: null, materializedAt: null });
    },
    markMaterialized: async ({ id }: { id: string }): Promise<void> => {
      const row = this.sandboxesRows.find(candidate => candidate.id === id);
      if (row) row.materializedAt = new Date();
    },
  };

  readonly worktrees = {
    upsert: async (input: UpsertSourceControlWorktreeInput): Promise<void> => {
      const existing = this.worktreesRows.find(
        row =>
          row.projectRepositoryId === input.projectRepositoryId &&
          row.userId === input.userId &&
          row.branch === input.branch,
      );
      if (existing) {
        existing.baseBranch = input.baseBranch;
        existing.worktreePath = input.worktreePath;
        return;
      }
      this.worktreesRows.push({ id: randomUUID(), createdAt: new Date(), ...input });
    },
    list: async ({
      projectRepositoryId,
      userId,
    }: {
      projectRepositoryId: string;
      userId: string;
    }): Promise<SourceControlWorktree[]> =>
      this.worktreesRows.filter(row => row.projectRepositoryId === projectRepositoryId && row.userId === userId),
    get: async ({
      projectRepositoryId,
      userId,
      branch,
    }: {
      projectRepositoryId: string;
      userId: string;
      branch: string;
    }): Promise<SourceControlWorktree | null> =>
      this.worktreesRows.find(
        row => row.projectRepositoryId === projectRepositoryId && row.userId === userId && row.branch === branch,
      ) ?? null,
    findByPath: async ({
      projectRepositoryId,
      userId,
      worktreePath,
    }: {
      projectRepositoryId: string;
      userId: string;
      worktreePath: string;
    }): Promise<SourceControlWorktree | null> =>
      this.worktreesRows.find(
        row =>
          row.projectRepositoryId === projectRepositoryId && row.userId === userId && row.worktreePath === worktreePath,
      ) ?? null,
    delete: async ({
      projectRepositoryId,
      userId,
      branch,
    }: {
      projectRepositoryId: string;
      userId: string;
      branch: string;
    }): Promise<void> => {
      this.worktreesRows.splice(
        0,
        this.worktreesRows.length,
        ...this.worktreesRows.filter(
          row => !(row.projectRepositoryId === projectRepositoryId && row.userId === userId && row.branch === branch),
        ),
      );
    },
  };
}

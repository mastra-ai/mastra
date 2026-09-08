import { randomUUID } from 'node:crypto';
import { UniqueViolationError } from '@mastra/core/storage';

import type {
  ConfiguredExternalRepositoryKey,
  CreateProjectSourceControlConnectionInput,
  CreateSourceControlSessionInput,
  ExternalRepositoryProjectTarget,
  LinkProjectRepositoryInput,
  ProjectRepository,
  ProjectSourceControlConnection,
  SourceControlInstallation,
  SourceControlRepository,
  SourceControlSession,
  SourceControlStorageHandle,
  UpdateProjectRepositoryInput,
  UpsertSourceControlInstallationInput,
  UpsertSourceControlRepositoryInput,
} from './base.js';

/** In-memory provider-scoped source-control handle for route tests. */
export class SourceControlStorageInMemory implements SourceControlStorageHandle {
  readonly integrationId: string;
  installationsRows: SourceControlInstallation[] = [];
  repositoriesRows: SourceControlRepository[] = [];
  connectionsRows: ProjectSourceControlConnection[] = [];
  projectRepositoriesRows: ProjectRepository[] = [];
  sessionsRows: SourceControlSession[] = [];

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
    migrateInstallation: async ({
      orgId,
      id,
      newInstallationId,
    }: {
      orgId: string;
      id: string;
      newInstallationId: string;
    }) => {
      const existing = await this.repositories.get({ orgId, id });
      if (!existing) {
        throw new Error(`Repository ${id} not found in organization ${orgId}`);
      }
      if (!(await this.installations.get({ orgId, id: newInstallationId }))) {
        throw new Error('Source-control installation not found');
      }
      // Check if a repository with the same external_id exists under the new installation
      const conflict = this.repositoriesRows.find(
        row => row.installationId === newInstallationId && row.externalId === existing.externalId,
      );
      if (conflict) {
        // Return the existing repository under the new installation
        return conflict;
      }
      // Update the repository's installation
      existing.installationId = newInstallationId;
      existing.updatedAt = new Date();
      // Migrate dependent connections to the new installation
      for (const conn of this.connectionsRows) {
        if (conn.installationId === existing.installationId) {
          conn.installationId = newInstallationId;
        }
      }
      return existing;
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
    listConfiguredExternalKeys: async (): Promise<ConfiguredExternalRepositoryKey[]> => {
      const keys = new Map<string, ConfiguredExternalRepositoryKey>();
      for (const connection of this.connectionsRows.filter(row => row.integrationId === this.integrationId)) {
        const installation = this.installationsRows.find(row => row.id === connection.installationId);
        if (!installation) continue;
        for (const link of this.projectRepositoriesRows.filter(row => row.connectionId === connection.id)) {
          const repository = this.repositoriesRows.find(row => row.id === link.repositoryId);
          if (!repository) continue;
          keys.set(`${installation.externalId}\u0000${repository.externalId}`, {
            installationExternalId: installation.externalId,
            repositoryExternalId: repository.externalId,
          });
        }
      }
      return [...keys.values()];
    },
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
        teardownCommand: input.teardownCommand ?? null,
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

  readonly sessions = {
    list: async ({ projectRepositoryId, viewerUserId }: { projectRepositoryId: string; viewerUserId: string }) =>
      this.sessionsRows.filter(
        row =>
          row.projectRepositoryId === projectRepositoryId &&
          (row.visibility !== 'private' || row.userId === viewerUserId),
      ),
    listByProjectRepository: async ({ projectRepositoryId }: { projectRepositoryId: string }) =>
      this.sessionsRows.filter(row => row.projectRepositoryId === projectRepositoryId),
    getBySessionId: async (sessionId: string): Promise<SourceControlSession | null> => {
      const row = this.sessionsRows.find(candidate => candidate.sessionId === sessionId);
      if (!row) return null;
      // Mirrors base.ts: a session whose project-repository link is gone does not resolve.
      return this.projectRepositoriesRows.some(link => link.id === row.projectRepositoryId) ? row : null;
    },
    rename: async ({ sessionId, title }: { sessionId: string; title: string }): Promise<void> => {
      const row = this.sessionsRows.find(candidate => candidate.sessionId === sessionId);
      if (row) {
        row.title = title;
        row.updatedAt = new Date();
      }
    },
    getForBranch: async ({
      projectRepositoryId,
      userId,
      branch,
    }: {
      projectRepositoryId: string;
      userId: string;
      branch: string;
    }): Promise<SourceControlSession | null> =>
      this.sessionsRows.find(
        row => row.projectRepositoryId === projectRepositoryId && row.userId === userId && row.branch === branch,
      ) ?? null,
    create: async (input: CreateSourceControlSessionInput): Promise<SourceControlSession> => {
      const existing = await this.sessions.getForBranch(input);
      if (existing) return existing;
      if (this.sessionsRows.some(row => row.sessionId === input.sessionId)) {
        throw new UniqueViolationError('Source-control session ID already exists');
      }
      const now = new Date();
      const session: SourceControlSession = {
        id: randomUUID(),
        ...input,
        title: input.title ?? null,
        visibility: input.visibility ?? 'org',
        sandboxId: null,
        sandboxWorkdir: null,
        materializedAt: null,
        firstMessageAt: null,
        firstMeaningfulExecAt: null,
        createdAt: now,
        updatedAt: now,
      };
      this.sessionsRows.push(session);
      return session;
    },
    setSandbox: async ({
      id,
      sandboxId,
      sandboxWorkdir,
    }: {
      id: string;
      sandboxId: string | null;
      sandboxWorkdir: string;
    }) => {
      const row = this.sessionsRows.find(candidate => candidate.id === id);
      if (row) Object.assign(row, { sandboxId, sandboxWorkdir, updatedAt: new Date() });
    },
    markMaterialized: async ({ id }: { id: string }) => {
      const row = this.sessionsRows.find(candidate => candidate.id === id);
      if (row && row.materializedAt === null) Object.assign(row, { materializedAt: new Date(), updatedAt: new Date() });
    },
    markFirstMessage: async ({ sessionId }: { sessionId: string }) => {
      const row = this.sessionsRows.find(candidate => candidate.sessionId === sessionId);
      if (row && row.firstMessageAt === null) Object.assign(row, { firstMessageAt: new Date(), updatedAt: new Date() });
    },
    markFirstMeaningfulExec: async ({ sessionId }: { sessionId: string }) => {
      const row = this.sessionsRows.find(candidate => candidate.sessionId === sessionId);
      if (row && row.firstMeaningfulExecAt === null) {
        Object.assign(row, { firstMeaningfulExecAt: new Date(), updatedAt: new Date() });
      }
    },
    delete: async (id: string) => {
      this.sessionsRows.splice(0, this.sessionsRows.length, ...this.sessionsRows.filter(row => row.id !== id));
    },
  };
}

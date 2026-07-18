import { randomUUID } from 'node:crypto';

import type {
  NewSourceControlInstallation,
  SourceControlInstallation,
  SourceControlProject,
  SourceControlProjectSandbox,
  SourceControlStorageHandle,
  SourceControlWorktree,
  UpsertSourceControlProjectInput,
  UpsertSourceControlWorktreeInput,
} from './base';

/** In-memory provider-scoped source-control handle for route tests. */
export class SourceControlStorageInMemory implements SourceControlStorageHandle {
  readonly integrationId: string;
  installationsRows: SourceControlInstallation[] = [];
  projectsRows: SourceControlProject[] = [];
  sandboxesRows: SourceControlProjectSandbox[] = [];
  worktreesRows: SourceControlWorktree[] = [];

  constructor(integrationId = 'github') {
    this.integrationId = integrationId;
  }

  readonly installations = {
    list: async (orgId: string): Promise<SourceControlInstallation[]> =>
      this.installationsRows.filter(row => row.orgId === orgId),
    get: async (orgId: string, externalId: string): Promise<SourceControlInstallation | null> =>
      this.installationsRows.find(row => row.orgId === orgId && row.externalId === externalId) ?? null,
    insert: async (input: NewSourceControlInstallation): Promise<void> => {
      const existing = this.installationsRows.find(
        row => row.orgId === input.orgId && row.externalId === input.externalId,
      );
      if (existing) return;
      this.installationsRows.push({
        id: randomUUID(),
        integrationId: this.integrationId,
        accountName: null,
        accountType: null,
        providerMetadata: {},
        createdAt: new Date(),
        ...input,
      });
    },
    delete: async (orgId: string, externalId: string): Promise<void> => {
      const retained = this.installationsRows.filter(row => !(row.orgId === orgId && row.externalId === externalId));
      this.installationsRows.splice(0, this.installationsRows.length, ...retained);
    },
  };

  readonly projects = {
    getOrg: async (orgId: string, projectId: string): Promise<SourceControlProject | null> =>
      this.projectsRows.find(row => row.orgId === orgId && row.id === projectId) ?? null,
    getById: async (projectId: string): Promise<SourceControlProject | null> =>
      this.projectsRows.find(row => row.id === projectId) ?? null,
    findByRepository: async (
      installationExternalId: string,
      repositorySlug: string,
    ): Promise<SourceControlProject | null> =>
      this.projectsRows.find(
        row => row.installationExternalId === installationExternalId && row.repositorySlug === repositorySlug,
      ) ?? null,
    upsert: async (input: UpsertSourceControlProjectInput): Promise<SourceControlProject> => {
      const existing = this.projectsRows.find(
        row => row.orgId === input.orgId && row.repositoryExternalId === input.repositoryExternalId,
      );
      if (existing) {
        Object.assign(existing, input);
        return existing;
      }
      const created: SourceControlProject = {
        id: randomUUID(),
        integrationId: this.integrationId,
        setupCommand: null,
        providerMetadata: {},
        createdAt: new Date(),
        ...input,
      };
      this.projectsRows.push(created);
      return created;
    },
    setSetupCommand: async (projectId: string, setupCommand: string | null): Promise<void> => {
      const row = this.projectsRows.find(project => project.id === projectId);
      if (row) row.setupCommand = setupCommand;
    },
  };

  readonly sandboxes = {
    getOrCreate: async (
      project: { id: string; sandboxWorkdir: string },
      userId: string,
    ): Promise<SourceControlProjectSandbox> => {
      const existing = this.sandboxesRows.find(row => row.projectId === project.id && row.userId === userId);
      if (existing) return existing;
      const created: SourceControlProjectSandbox = {
        id: randomUUID(),
        projectId: project.id,
        userId,
        sandboxId: null,
        sandboxWorkdir: project.sandboxWorkdir,
        materializedAt: null,
        createdAt: new Date(),
      };
      this.sandboxesRows.push(created);
      return created;
    },
    getById: async (id: string): Promise<SourceControlProjectSandbox | null> =>
      this.sandboxesRows.find(row => row.id === id) ?? null,
    setSandboxId: async (id: string, sandboxId: string): Promise<void> => {
      const row = this.sandboxesRows.find(candidate => candidate.id === id);
      if (row) row.sandboxId = sandboxId;
    },
    clearBinding: async (id: string): Promise<void> => {
      const row = this.sandboxesRows.find(candidate => candidate.id === id);
      if (row) Object.assign(row, { sandboxId: null, materializedAt: null });
    },
    markMaterialized: async (id: string): Promise<void> => {
      const row = this.sandboxesRows.find(candidate => candidate.id === id);
      if (row) row.materializedAt = new Date();
    },
  };

  readonly worktrees = {
    upsert: async (input: UpsertSourceControlWorktreeInput): Promise<void> => {
      const existing = this.worktreesRows.find(
        row => row.projectId === input.projectId && row.userId === input.userId && row.branch === input.branch,
      );
      if (existing) {
        existing.baseBranch = input.baseBranch;
        existing.worktreePath = input.worktreePath;
        return;
      }
      this.worktreesRows.push({ id: randomUUID(), createdAt: new Date(), ...input });
    },
    get: async (projectId: string, userId: string, branch: string): Promise<SourceControlWorktree | null> =>
      this.worktreesRows.find(row => row.projectId === projectId && row.userId === userId && row.branch === branch) ??
      null,
    findByPath: async (
      projectId: string,
      userId: string,
      worktreePath: string,
    ): Promise<SourceControlWorktree | null> =>
      this.worktreesRows.find(
        row => row.projectId === projectId && row.userId === userId && row.worktreePath === worktreePath,
      ) ?? null,
    delete: async (projectId: string, userId: string, branch: string): Promise<void> => {
      const retained = this.worktreesRows.filter(
        row => !(row.projectId === projectId && row.userId === userId && row.branch === branch),
      );
      this.worktreesRows.splice(0, this.worktreesRows.length, ...retained);
    },
  };
}

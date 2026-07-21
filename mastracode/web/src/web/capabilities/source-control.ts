import type {
  SourceControlInstallation,
  SourceControlRepository,
  SourceControlStorageHandle,
} from '../storage/domains/source-control/base.js';

export interface SourceControlInstallationInput {
  externalId: string;
  accountName?: string | null;
  accountType?: string | null;
  metadata?: Record<string, unknown>;
}

export interface SourceControlRepositoryInput {
  externalId: string;
  slug: string;
  defaultBranch: string;
  metadata?: Record<string, unknown>;
}

export interface SourceControlRepositoryAccess {
  cloneUrl: string;
  authorization?: { scheme: 'bearer'; token: string };
}

export interface SourceControl {
  initialize(args: { storage: SourceControlStorageHandle }): void;
  registerInstallation(args: {
    orgId: string;
    userId: string;
    installation: SourceControlInstallationInput;
  }): Promise<SourceControlInstallation>;
  registerRepositories(args: {
    orgId: string;
    installationId: string;
    repositories: SourceControlRepositoryInput[];
  }): Promise<SourceControlRepository[]>;
  getRepositoryAccess(args: { orgId: string; repositoryId: string }): Promise<SourceControlRepositoryAccess>;
}

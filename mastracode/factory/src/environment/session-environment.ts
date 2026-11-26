import type { FactorySandboxContext } from '@mastra/core/workspace';
import type { RepositoryAccess } from '../capabilities/version-control.js';
import { repositoryDirectoryName } from '../sandbox/workdir.js';
import type { FactoryProject } from '../storage/domains/projects/base.js';
import type { SourceControlStorageHandle } from '../storage/domains/source-control/base.js';

export interface SessionEnvironmentRepo {
  projectRepositoryId: string;
  repositoryId: string;
  slug: string;
  /** The session's base branch: the link's branch when set, else the repository default. */
  defaultBranch: string;
  /** The repository's own default branch, which the template image clones and pins. */
  templateBranch: string;
  position: number;
  setupCommand: string | undefined;
  teardownCommand: string | undefined;
}

/** The session's factory environment, resolved from the project and its `inEnvironment` links. */
export interface SessionEnvironment {
  /** The factory's display name. */
  factoryName: string;
  repos: SessionEnvironmentRepo[];
  workspaceSetupCommand: string | undefined;
  /** Only an absolute root is passed on; the templates reject anything else. */
  workingDirectory: string | undefined;
  /** The project's stored provider settings document, `{}` when nothing was set. */
  settings: Record<string, unknown>;
}

/**
 * The project's environment as a session (or an environment build) sees it:
 * every `inEnvironment` link under this source-control integration in
 * position order, plus the project's settings, setup command and workdir.
 */
export async function resolveProjectEnvironment(
  storage: Pick<SourceControlStorageHandle, 'projectRepositories' | 'repositories'>,
  project: FactoryProject,
): Promise<SessionEnvironment> {
  const orgId = project.orgId;
  const links = (await storage.projectRepositories.listByProject({ orgId, factoryProjectId: project.id }))
    .filter(link => link.inEnvironment)
    .sort((a, b) => a.position - b.position || a.createdAt.getTime() - b.createdAt.getTime());
  const repos: SessionEnvironmentRepo[] = [];
  const directories = new Set<string>();
  for (const link of links) {
    const repository = await storage.repositories.get({ orgId, id: link.repositoryId });
    if (!repository) {
      console.warn('[Mastra Factory] Environment repository link has no repository row; skipping it', {
        orgId,
        factoryProjectId: project.id,
        projectRepositoryId: link.id,
      });
      continue;
    }
    // Two repositories that share a directory name would clobber each other's
    // checkout under the root (and the template refuses them); the earlier
    // position wins, the later link is left out of this boot.
    const directory = repositoryDirectoryName(repository.slug);
    if (directories.has(directory)) {
      console.warn(
        '[Mastra Factory] Environment repository shares its directory name with an earlier one; skipping it',
        {
          orgId,
          factoryProjectId: project.id,
          projectRepositoryId: link.id,
          slug: repository.slug,
          directory,
        },
      );
      continue;
    }
    directories.add(directory);
    repos.push({
      projectRepositoryId: link.id,
      repositoryId: repository.id,
      slug: repository.slug,
      defaultBranch: link.branch || repository.defaultBranch,
      templateBranch: repository.defaultBranch,
      position: link.position,
      setupCommand: link.setupCommand ?? undefined,
      teardownCommand: link.teardownCommand ?? undefined,
    });
  }
  const workdir = project.sandboxWorkingDirectory?.trim();
  return {
    factoryName: project.name,
    repos,
    workspaceSetupCommand: project.workspaceSetupCommand?.trim() || undefined,
    workingDirectory: workdir?.startsWith('/') ? workdir : undefined,
    settings: project.sandboxSettings ?? {},
  };
}

/**
 * The context fields the list form of the repo templates needs: one entry per
 * environment repository, each minting its own token at build time, with
 * `getRepositoryAccess` present but undefined (the two are mutually exclusive
 * for the template). Shared by session boot and environment builds so both
 * resolve the same template identity; `resolveHead` is only set when given.
 */
export function environmentSandboxContext(
  environment: SessionEnvironment,
  options: {
    orgId: string;
    getRepositoryAccess: (args: { orgId: string; repositoryId: string }) => Promise<RepositoryAccess>;
    resolveHead?: FactorySandboxContext['resolveHead'];
  },
): Omit<FactorySandboxContext, 'sessionId'> {
  return {
    setupCommand: undefined,
    getRepositoryAccess: undefined,
    repos: environment.repos.map(repo => ({
      getRepositoryAccess: () => options.getRepositoryAccess({ orgId: options.orgId, repositoryId: repo.repositoryId }),
      ...(repo.setupCommand ? { setupCommand: repo.setupCommand } : {}),
    })),
    ...(environment.workspaceSetupCommand ? { workspaceSetupCommand: environment.workspaceSetupCommand } : {}),
    // A repository whose setup fails still lands in the image, recorded in
    // `setup-failed`; the boot hook reports it failed without running it again.
    continueOnSetupFailure: true,
    ...(environment.workingDirectory ? { workingDirectory: environment.workingDirectory } : {}),
    ...(options.resolveHead ? { resolveHead: options.resolveHead } : {}),
  };
}

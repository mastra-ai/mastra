import { existsSync } from 'node:fs';
import path, { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SandboxFilesystem } from '@mastra/code-sdk/agents/sandbox-filesystem';
import { MASTRACODE_WORKSPACE_TOOLS } from '@mastra/code-sdk/agents/tool-availability';
import { getDynamicWorkspace } from '@mastra/code-sdk/agents/workspace';
import type { WorkspaceSkillExtension } from '@mastra/code-sdk/agents/workspace';
import { DEFAULT_CONFIG_DIR } from '@mastra/code-sdk/constants';
import type { MastraCodeState } from '@mastra/code-sdk/schema';
import type { AgentControllerRequestContext } from '@mastra/core/agent-controller';
import { LocalSandbox, LocalSkillSource, Workspace } from '@mastra/core/workspace';
import type { SkillSource, SkillSourceEntry, SkillSourceStat } from '@mastra/core/workspace';
import type { FactoryAuthUser } from './auth';
import type { MastraFactorySandboxConfig } from './factory';
import type { GithubIntegration } from './integrations/github/integration';
import { checkoutSessionBranch, materializeRepo, runWorktreeSetup } from './integrations/github/sandbox';
import type { SandboxBindingStore, SandboxFleet } from './sandbox/fleet';

const WORKSPACE_ID_PREFIX = 'mfw';
const SESSION_CHECKPOINT_PREFIX = 'mastracode-session';

export function checkpointNameForSession(sessionId: string): string {
  return `${SESSION_CHECKPOINT_PREFIX}-${sessionId}`;
}

const bundleDirectory = dirname(fileURLToPath(import.meta.url));
const bundledFactorySkillsPath = join(bundleDirectory, 'factory-skills');
const FACTORY_SKILLS_SOURCE_PATH =
  [
    // Deploy bundle: the consumer copies `factory-skills/` next to the built
    // server module (e.g. via its public/ dir).
    bundledFactorySkillsPath,
    // Package layout: `dist/../factory-skills` (also `src/../factory-skills`
    // when running tests against sources).
    join(bundleDirectory, '..', 'factory-skills'),
    // Consumer repo running from its package root before a build.
    join(process.cwd(), 'src', 'mastra', 'public', 'factory-skills'),
  ].find(existsSync) ?? bundledFactorySkillsPath;
const FACTORY_SKILLS_MOUNT = path.resolve(path.parse(process.cwd()).root, '__mastracode_factory_skills__');
const FACTORY_SKILL_NAMES = new Set(['configure-factory-rules', 'understand-issue', 'understand-pr']);

class FactorySkillSource implements SkillSource {
  readonly #factorySource = new LocalSkillSource({ basePath: FACTORY_SKILLS_SOURCE_PATH });
  readonly #fallbackSkillRoots: Set<string>;

  constructor(
    readonly fallback: SkillSource,
    fallbackSkillRoots: string[],
  ) {
    this.#fallbackSkillRoots = new Set(fallbackSkillRoots.map(skillPath => path.normalize(skillPath)));
  }

  #isFactoryPath(skillPath: string): boolean {
    const normalized = path.normalize(skillPath);
    return normalized === FACTORY_SKILLS_MOUNT || normalized.startsWith(`${FACTORY_SKILLS_MOUNT}${path.sep}`);
  }

  #factoryPath(skillPath: string): string {
    return path.relative(FACTORY_SKILLS_MOUNT, path.normalize(skillPath));
  }

  exists(skillPath: string): Promise<boolean> {
    return this.#isFactoryPath(skillPath)
      ? this.#factorySource.exists(this.#factoryPath(skillPath))
      : this.fallback.exists(skillPath);
  }

  stat(skillPath: string): Promise<SkillSourceStat> {
    return this.#isFactoryPath(skillPath)
      ? this.#factorySource.stat(this.#factoryPath(skillPath))
      : this.fallback.stat(skillPath);
  }

  readFile(skillPath: string): Promise<string | Buffer> {
    return this.#isFactoryPath(skillPath)
      ? this.#factorySource.readFile(this.#factoryPath(skillPath))
      : this.fallback.readFile(skillPath);
  }

  async readdir(skillPath: string): Promise<SkillSourceEntry[]> {
    if (this.#isFactoryPath(skillPath)) {
      return this.#factorySource.readdir(this.#factoryPath(skillPath));
    }
    const entries = await this.fallback.readdir(skillPath);
    if (this.#fallbackSkillRoots.has(path.normalize(skillPath))) {
      return entries.filter(entry => !FACTORY_SKILL_NAMES.has(entry.name));
    }
    return entries;
  }

  realpath(skillPath: string): Promise<string> {
    if (this.#isFactoryPath(skillPath)) return Promise.resolve(path.normalize(skillPath));
    return this.fallback.realpath ? this.fallback.realpath(skillPath) : Promise.resolve(skillPath);
  }
}

const factorySkillExtension: WorkspaceSkillExtension = {
  id: 'web-factory',
  paths: [FACTORY_SKILLS_MOUNT],
  createSource: (fallback, fallbackSkillRoots) => new FactorySkillSource(fallback, fallbackSkillRoots),
};

type DynamicWorkspaceContext = Parameters<typeof getDynamicWorkspace>[0];

export interface CreateWorkspaceFactoryOptions {
  /** Factory sandbox runtime config (template machine + workdir base). */
  sandbox?: MastraFactorySandboxConfig;
  /** GitHub integration used to resolve Factory sessions and mint repo tokens. */
  github?: GithubIntegration;
  /** Fleet the per-session sandboxes are provisioned/reattached through. */
  fleet?: SandboxFleet;
}

export function createWorkspaceFactory(options: CreateWorkspaceFactoryOptions = {}) {
  const { sandbox: sandboxConfig, github, fleet } = options;
  const isLocalSandbox = sandboxConfig?.machine instanceof LocalSandbox;

  return async ({ requestContext, mastra, skillExtension }: DynamicWorkspaceContext) => {
    const effectiveSkillExtension = skillExtension ?? factorySkillExtension;
    const ctx = requestContext.get('controller') as AgentControllerRequestContext<MastraCodeState> | undefined;
    const session =
      ctx?.resourceId && github ? await github.sourceControlStorage.sessions.getBySessionId(ctx.resourceId) : null;

    if (!session) {
      if (sandboxConfig && !isLocalSandbox) {
        throw new Error('A Factory session ID is required to create a remote sandbox workspace');
      }
      return getDynamicWorkspace({ requestContext, mastra, skillExtension: effectiveSkillExtension });
    }

    const user = requestContext.get('user') as FactoryAuthUser | undefined;
    if (
      !user?.organizationId ||
      !user.workosId ||
      user.organizationId !== session.orgId ||
      user.workosId !== session.userId
    ) {
      throw new Error(`Factory session ${session.sessionId} is not available to the current user`);
    }
    if (!sandboxConfig || !github || !fleet) {
      throw new Error('GitHub and sandbox providers are required to create a Factory session workspace');
    }

    const storage = github.sourceControlStorage;
    const projectRepository = await storage.projectRepositories.get({
      orgId: session.orgId,
      id: session.projectRepositoryId,
    });
    if (!projectRepository) throw new Error(`Repository link ${session.projectRepositoryId} was not found`);
    const connection = await storage.connections.get({ orgId: session.orgId, id: projectRepository.connectionId });
    const repository = await storage.repositories.get({ orgId: session.orgId, id: projectRepository.repositoryId });
    if (!connection || !repository) throw new Error(`Repository link ${session.projectRepositoryId} is incomplete`);
    const installation = await storage.installations.get({ orgId: session.orgId, id: connection.installationId });
    if (!installation) throw new Error(`GitHub installation ${connection.installationId} was not found`);
    const repoFullName = repository.slug;

    const workdir = isLocalSandbox
      ? fleet.computeLocalSessionWorkdir(repoFullName, session.id)
      : (session.sandboxWorkdir ?? projectRepository.sandboxWorkdir);
    const binding: SandboxBindingStore = {
      sandboxId: session.sandboxId,
      checkpointName: checkpointNameForSession(session.id),
      setSandboxId: async id => {
        await storage.sessions.setSandbox({ id: session.id, sandboxId: id, sandboxWorkdir: workdir });
        session.sandboxId = id;
        session.sandboxWorkdir = workdir;
      },
      clear: async () => {
        await storage.sessions.setSandbox({ id: session.id, sandboxId: null, sandboxWorkdir: workdir });
        session.sandboxId = null;
      },
    };

    const extensionId = effectiveSkillExtension ? `-${effectiveSkillExtension.id}` : '';
    const workspaceId = `${WORKSPACE_ID_PREFIX}-${projectRepository.id}-${session.id}${extensionId}`;
    const configDir = sandboxConfig.workdir ?? DEFAULT_CONFIG_DIR;
    try {
      const existing = mastra?.getWorkspaceById(workspaceId) as Workspace | undefined;
      if (existing) {
        existing.setToolsConfig(MASTRACODE_WORKSPACE_TOOLS);
        return existing;
      }
    } catch {
      // Not registered yet.
    }

    const token = await github.mintInstallationToken(Number(installation.externalId));
    if (!token) throw new Error('GitHub token could not be generated for the Factory session');

    const sandbox = await fleet.ensureSandbox(
      binding,
      { GH_TOKEN: token },
      undefined,
      isLocalSandbox ? { workingDirectory: workdir } : {},
    );
    await materializeRepo({
      row: { id: session.id, sandboxWorkdir: workdir, materializedAt: session.materializedAt },
      repoInfo: { repoFullName: repoFullName, defaultBranch: repository.defaultBranch },
      sandbox,
      token,
      storage: storage.sessions,
    });
    await checkoutSessionBranch(sandbox, workdir, {
      branch: session.branch,
      baseBranch: session.baseBranch || projectRepository.branch || repository.defaultBranch,
      token,
      repoFullName: repoFullName,
    });
    if (projectRepository.setupCommand) await runWorktreeSetup(sandbox, workdir, projectRepository.setupCommand);

    const filesystem = new SandboxFilesystem({ sandbox, workdir });
    const projectSkillPaths = [path.join(configDir, 'skills'), '.claude/skills', '.agents/skills'];
    const skillPaths = [...(effectiveSkillExtension?.paths ?? []), ...projectSkillPaths];
    return new Workspace({
      id: workspaceId,
      name: 'Mastra Code Factory Session Workspace',
      filesystem,
      sandbox: sandbox as unknown as ConstructorParameters<typeof Workspace>[0]['sandbox'],
      tools: MASTRACODE_WORKSPACE_TOOLS,
      skills: skillPaths,
      skillSource: effectiveSkillExtension?.createSource(filesystem, projectSkillPaths) ?? filesystem,
    });
  };
}

export const getFactoryWorkspace = createWorkspaceFactory();

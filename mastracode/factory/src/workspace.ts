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
import { getFactoryAuthUserFromContext, getFactoryAuthUserId } from './auth.js';
import type { MastraFactorySandboxConfig } from './factory.js';
import type { GithubIntegration } from './integrations/github/integration.js';
import { getGithubPat } from './integrations/github/pat.js';
import type { GithubPatKind } from './integrations/github/pat.js';
import {
  checkoutSessionBranch,
  MaterializeError,
  materializeRepo,
  recycleClaimedWorkdir,
  runWorktreeSetup,
} from './integrations/github/sandbox.js';
import { registerGithubPatKind, registerGithubTokenInjector } from './integrations/github/token-refresh.js';
import { getFactorySessionAddress } from './rules/binding-context.js';
import type { SandboxBindingStore, SandboxFleet } from './sandbox/fleet.js';
import type { WorkItemsStorage } from './storage/domains/work-items/base.js';

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
const FACTORY_SKILL_NAMES = new Set(['configure-factory-rules', 'factory-plan', 'factory-review', 'factory-triage']);

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
  /** Work-items storage used to resolve the session's run-binding role, so
   * review-board sessions get the reviewer PAT as `GH_TOKEN`. Optional —
   * without it every session uses the default (worker) PAT. */
  workItems?: Pick<WorkItemsStorage, 'findRunBindingBySession'>;
}

export function createWorkspaceFactory(options: CreateWorkspaceFactoryOptions = {}) {
  const { sandbox: sandboxConfig, github, fleet, workItems } = options;
  const isLocalSandbox = sandboxConfig?.machine instanceof LocalSandbox;
  type GithubTokenRegistration = {
    inject: (token: string) => void;
    patKind: GithubPatKind;
    ghToken: string;
    generation: number;
    tokenReplacementPending: boolean;
  };
  const githubTokenInjectors = new Map<string, GithubTokenRegistration>();
  const githubTokenReconciliations = new Map<string, Promise<void>>();
  // Concurrent requests for the same session (thread list + activity polling +
  // chat) must not each provision a sandbox and clone the repository. The
  // first caller materializes; followers await the same promise.
  const inflightMaterializations = new Map<string, Promise<Workspace>>();

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

    const user = getFactoryAuthUserFromContext(requestContext);
    const userId = getFactoryAuthUserId(user);
    // No identity at all is a server-side caller that forgot to seed one
    // (webhook, cron), not someone reaching for another user's session.
    if (!user?.organizationId || !userId) {
      throw new Error(`Factory session ${session.sessionId} was resolved without a caller identity`);
    }
    if (user.organizationId !== session.orgId || userId !== session.userId) {
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

    let workdir = isLocalSandbox
      ? fleet.computeLocalSessionWorkdir(repoFullName, session.id)
      : (session.sandboxWorkdir ?? projectRepository.sandboxWorkdir);
    // The system prompt derives its working directory from `state.projectPath`
    // and falls back to the server's own process.cwd() when unset — which
    // points the agent at the host checkout (and lets it run `git checkout`
    // there instead of in its session workdir). Pin it to the session workdir.
    // During createSession this seeds the session's initial state (the
    // workspace resolves before the session is built); on later requests it
    // self-heals live state.
    if (ctx && workdir && ctx.getState()?.projectPath !== workdir) {
      await ctx.setState({ projectPath: workdir, projectName: repoFullName });
    }
    const binding: SandboxBindingStore = {
      // Read through to the session row so teardown after a fresh provision
      // sees the just-persisted id instead of a stale snapshot.
      get sandboxId() {
        return session.sandboxId;
      },
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

    const getRepositoryToken = async (): Promise<string> => {
      const access = await github.versionControl.getRepositoryAccess({
        orgId: session.orgId,
        repositoryId: repository.id,
      });
      const token = access.authorization?.token;
      if (!token) throw new Error('Repository access did not include a bearer token for the Factory session');
      return token;
    };
    const resolveGithubPatKind = async (fallback: GithubPatKind): Promise<GithubPatKind> => {
      if (!workItems) return 'default';
      try {
        const address = getFactorySessionAddress(requestContext);
        const runBinding = address ? await workItems.findRunBindingBySession(address) : null;
        return runBinding?.role === 'review' && runBinding.status === 'active' && runBinding.orgId === session.orgId
          ? 'reviewer'
          : 'default';
      } catch {
        // Preserve the installed role when binding storage is temporarily unavailable.
        return fallback;
      }
    };
    const registerGithubTokenContext = (registered: GithubTokenRegistration): void => {
      const generation = registered.generation;
      registerGithubTokenInjector(requestContext, token => {
        if (githubTokenInjectors.get(workspaceId) !== registered || registered.generation !== generation) {
          throw new Error('GitHub token refresh no longer matches the active Factory workspace role.');
        }
        registered.inject(token);
      });
      registerGithubPatKind(requestContext, registered.patKind);
    };
    const reconcileGithubToken = async (): Promise<void> => {
      const previous = githubTokenReconciliations.get(workspaceId) ?? Promise.resolve();
      const reconciliation = previous
        .catch(() => {})
        .then(async () => {
          const registered = githubTokenInjectors.get(workspaceId);
          if (!registered) return;

          const previousPatKind = registered.patKind;
          const patKind = await resolveGithubPatKind(previousPatKind);
          if (githubTokenInjectors.get(workspaceId) !== registered) return;

          if (patKind !== previousPatKind) {
            registered.patKind = patKind;
            registered.generation += 1;
          }
          if (patKind === 'reviewer') registered.tokenReplacementPending = false;
          if (previousPatKind === 'reviewer' && patKind === 'default') {
            // Invalidate reviewer refresh contexts before replacement I/O so
            // they cannot restore reviewer credentials after a failed downgrade.
            registered.tokenReplacementPending = true;
          }

          let token = await getGithubPat(() => github.integrationStorage, session.orgId, patKind);
          if (!token && registered.tokenReplacementPending) token = await getRepositoryToken();
          if (githubTokenInjectors.get(workspaceId) !== registered) return;

          if (token && token !== registered.ghToken) {
            try {
              registered.inject(token);
            } catch (error) {
              if (registered.tokenReplacementPending) throw error;
              // Same-role rotations and reviewer upgrades remain best-effort.
            }
          }
          if (token && token === registered.ghToken) registered.tokenReplacementPending = false;
          registerGithubTokenContext(registered);
        });
      githubTokenReconciliations.set(workspaceId, reconciliation);
      try {
        await reconciliation;
      } finally {
        if (githubTokenReconciliations.get(workspaceId) === reconciliation) {
          githubTokenReconciliations.delete(workspaceId);
        }
      }
    };
    const reconcileRegisteredWorkspace = async (workspace: Workspace): Promise<Workspace> => {
      const registered = githubTokenInjectors.get(workspaceId);
      try {
        await reconcileGithubToken();
      } catch (error) {
        if (registered?.tokenReplacementPending && githubTokenInjectors.get(workspaceId) === registered) {
          // The role generation already invalidated reviewer refresh contexts.
          // Keep the pending registration so failed eviction cannot make a
          // still-live reviewer workspace look safe on the next reuse.
          let evicted = false;
          try {
            evicted = (await mastra?.removeWorkspace?.(workspaceId)) === true;
          } catch {
            // Preserve the credential-replacement error and retry on the next reuse.
          }
          try {
            await workspace.destroy();
            evicted = true;
          } catch {
            // The pending registration keeps the workspace quarantined if cleanup also fails.
          }
          if (evicted && githubTokenInjectors.get(workspaceId) === registered) {
            githubTokenInjectors.delete(workspaceId);
          }
        }
        throw error;
      }
      if (registered && githubTokenInjectors.get(workspaceId) !== registered) {
        throw new Error('Factory workspace GitHub credential registration is no longer active.');
      }
      return workspace;
    };

    let existing: Workspace | undefined;
    try {
      existing = mastra?.getWorkspaceById(workspaceId) as Workspace | undefined;
      existing?.setToolsConfig(MASTRACODE_WORKSPACE_TOOLS);
    } catch {
      // Not registered yet.
      existing = undefined;
    }
    if (existing) {
      return reconcileRegisteredWorkspace(existing);
    }

    const materialize = async (): Promise<Workspace> => {
      // A terminal work item or a deleted session may have returned a
      // still-warm VM — with this repository already cloned — to the reuse
      // pool. Adopt it before provisioning a fresh sandbox. Pooled VMs carry
      // no credentials (tokens are injected per command, and the workdir is
      // scrubbed on release and again below), so any user's session for this
      // repository can claim one.
      let claimedPooledSandbox = false;
      if (!isLocalSandbox && !session.sandboxId) {
        const pooled = await storage.sandboxPool.claim({
          projectRepositoryId: session.projectRepositoryId,
        });
        if (pooled) {
          await storage.sessions.setSandbox({
            id: session.id,
            sandboxId: pooled.sandboxId,
            sandboxWorkdir: pooled.sandboxWorkdir,
          });
          session.sandboxId = pooled.sandboxId;
          session.sandboxWorkdir = pooled.sandboxWorkdir;
          workdir = pooled.sandboxWorkdir;
          claimedPooledSandbox = true;
        }
      }

      const token = await getRepositoryToken();

      // The `gh` CLI needs a PAT when the org configured one (installation
      // tokens 403 on integration-restricted endpoints); git clone/checkout
      // below keep using the minted installation token. Review-board sessions
      // (run-binding role `review`) authenticate `gh` as the reviewer account
      // when a reviewer token is configured; everything else — including
      // sessions with no resolvable run binding — uses the worker token.
      const patKind = await resolveGithubPatKind('default');
      const ghCliToken = (await getGithubPat(() => github.integrationStorage, session.orgId, patKind)) ?? token;

      const ensureSandbox = () =>
        fleet.ensureSandbox(
          binding,
          { GH_TOKEN: ghCliToken },
          undefined,
          isLocalSandbox ? { workingDirectory: workdir } : {},
        );
      const runMaterialize = (target: Awaited<ReturnType<typeof ensureSandbox>>) =>
        materializeRepo({
          row: { id: session.id, sandboxWorkdir: workdir, materializedAt: session.materializedAt },
          repoInfo: { repoFullName: repoFullName, defaultBranch: repository.defaultBranch },
          sandbox: target,
          token,
          storage: storage.sessions,
        });
      const isGitMissing = (error: unknown) => error instanceof MaterializeError && error.code === 'git-missing';

      let sandbox = await ensureSandbox();
      // A claimed VM still has the previous session's branch checked out —
      // reset it to the default branch before materialize/checkout. When the
      // pooled VM was already reaped, `ensureSandbox` provisioned fresh and
      // the recycle is a no-op (no checkout on disk yet).
      if (claimedPooledSandbox) await recycleClaimedWorkdir(sandbox, workdir, repository.defaultBranch);
      try {
        await runMaterialize(sandbox);
      } catch (error) {
        if (!isGitMissing(error)) throw error;
        // A sandbox without git was booted from a bare base image (e.g. the
        // platform proxy falls back to a clean Debian base when its template
        // build fails). That VM can never materialize a repo, and its id is
        // already persisted on the binding — tear it down so re-opens stop
        // reattaching to the poisoned sandbox, then retry once on a fresh VM.
        await fleet.teardownSandbox(binding, sandbox);
        sandbox = await ensureSandbox();
        try {
          await runMaterialize(sandbox);
        } catch (retryError) {
          // Still bare — the provider's template is persistently broken.
          // Clear the binding so a later manual retry provisions fresh.
          if (isGitMissing(retryError)) await fleet.teardownSandbox(binding, sandbox);
          throw retryError;
        }
      }
      await checkoutSessionBranch(sandbox, workdir, {
        branch: session.branch,
        baseBranch: session.baseBranch || projectRepository.branch || repository.defaultBranch,
        token,
        repoFullName: repoFullName,
      });
      if (projectRepository.setupCommand) await runWorktreeSetup(sandbox, workdir, projectRepository.setupCommand);

      const registered: GithubTokenRegistration = {
        inject: freshToken => {
          if (!sandbox.setEnvironmentVariable) {
            throw new Error('The active sandbox provider does not support runtime GitHub token refresh.');
          }
          sandbox.setEnvironmentVariable('GH_TOKEN', freshToken);
          registered.ghToken = freshToken;
        },
        patKind,
        ghToken: ghCliToken,
        generation: 0,
        tokenReplacementPending: false,
      };
      githubTokenInjectors.set(workspaceId, registered);
      registerGithubTokenContext(registered);

      const filesystem = new SandboxFilesystem({ sandbox, workdir });
      const projectSkillPaths = [path.join(configDir, 'skills'), '.claude/skills', '.agents/skills'];
      const skillPaths = [...(effectiveSkillExtension?.paths ?? []), ...projectSkillPaths];
      const workspace = new Workspace({
        id: workspaceId,
        name: 'Mastra Code Factory Session Workspace',
        filesystem,
        sandbox: sandbox as unknown as ConstructorParameters<typeof Workspace>[0]['sandbox'],
        tools: MASTRACODE_WORKSPACE_TOOLS,
        skills: skillPaths,
        skillSource: effectiveSkillExtension?.createSource(filesystem, projectSkillPaths) ?? filesystem,
      });
      // Register with the Mastra instance so sync HTTP handlers that resolve
      // the workspace via `mastra.getWorkspaceById(id)` (file tree, permissions
      // probe, MCP/tool routes) find it instead of throwing
      // `MASTRA_GET_WORKSPACE_BY_ID_NOT_FOUND`. `addWorkspace` is idempotent on
      // key collision, so the inflight coalescing and reuse paths above stay
      // race-safe. Registration happens synchronously with the return so a
      // concurrent lookup on another request cannot observe an unregistered
      // workspace.
      mastra?.addWorkspace(workspace, workspaceId, { source: 'mastra' });
      return workspace;
    };

    // Dedupe concurrent materializations of the same workspace: followers
    // await the leader's promise instead of provisioning a second sandbox,
    // then bind the shared token injector into their own request context.
    const inflight = inflightMaterializations.get(workspaceId);
    if (inflight) {
      const workspace = await inflight;
      return reconcileRegisteredWorkspace(workspace);
    }
    const materialization = materialize();
    inflightMaterializations.set(workspaceId, materialization);
    try {
      return await materialization;
    } finally {
      inflightMaterializations.delete(workspaceId);
    }
  };
}

export const getFactoryWorkspace = createWorkspaceFactory();

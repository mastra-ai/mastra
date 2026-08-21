import { existsSync } from 'node:fs';
import path, { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SandboxFilesystem } from '@mastra/code-sdk/agents/sandbox-filesystem';
import { MASTRACODE_WORKSPACE_TOOLS } from '@mastra/code-sdk/agents/tool-availability';
import type { getDynamicWorkspace, WorkspaceSkillExtension } from '@mastra/code-sdk/agents/workspace';
import { DEFAULT_CONFIG_DIR } from '@mastra/code-sdk/constants';
import type { MastraCodeState } from '@mastra/code-sdk/schema';
import type { AgentControllerRequestContext } from '@mastra/core/agent-controller';
import { LocalSkillSource, Workspace } from '@mastra/core/workspace';
import type { SkillSource, SkillSourceEntry, SkillSourceStat } from '@mastra/core/workspace';
import { getFactoryAuthUserFromContext, getFactoryAuthUserId } from './auth.js';
import type { MastraFactorySandboxConfig } from './factory.js';
import type { GithubIntegration } from './integrations/github/integration.js';
import { getGithubPat } from './integrations/github/pat.js';
import type { GithubPatKind } from './integrations/github/pat.js';
import {
  checkoutSessionBranch,
  DEFAULT_COMMAND_TIMEOUT_MS,
  materializeRepo,
  runWorktreeSetup,
  runWorktreeTeardown,
} from './integrations/github/sandbox.js';
import { registerGithubPatKind, registerGithubTokenInjector } from './integrations/github/token-refresh.js';
import { getFactorySessionAddress } from './rules/binding-context.js';
import type { MaterializationSandbox } from './sandbox/materialization.js';
import {
  createSessionSetupHook,
  evictSessionSandbox,
  getSessionSandbox,
  peekSessionSandbox,
  runSessionSetupFallback,
} from './sandbox/session-sandbox.js';

import type { WorkItemsStorage } from './storage/domains/work-items/base.js';

const WORKSPACE_ID_PREFIX = 'mfw';
/**
 * Whether a command failure means the sandbox itself is gone (destroyed by
 * idle GC or provider teardown) AND the command provably never started, so
 * reviving the sandbox and replaying the command cannot run a side effect
 * twice. Matched by error name so any provider's equivalent error classes
 * participate without a package dependency.
 *
 * `SandboxExecTransportError` means both WebSocket attempts closed without an
 * exit frame against a live sandbox. It only proves the command never started
 * when the transport never opened (`opened: false` — the upgrade was refused
 * outright). When the transport opened, the command may have run and mutated
 * state before the result was lost, so replaying `git commit`, uploads, or
 * arbitrary shell commands could execute the side effect twice; those errors
 * surface to the caller instead.
 */
export function isDeadSandboxError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  if (error.name === 'SandboxDestroyedError') return true;
  if (error.name === 'SandboxExecTransportError') {
    return (error as Error & { opened?: boolean }).opened === false;
  }
  return /sandbox .*(destroyed|no longer exists|not found)/i.test(error.message);
}

/**
 * The local-provider equivalent of {@link isDeadSandboxError}: a local sandbox
 * is just a directory, so it "dies" when that directory is removed — which
 * session retirement does while an in-flight run still holds the handle.
 *
 * Node surfaces a missing `cwd` as ENOENT against the binary it tried to spawn
 * (`spawn /bin/sh ENOENT`), which is textually identical to the shell itself
 * being absent, and is also what a genuinely missing command reports. Probing
 * the working directory is what separates "the sandbox is gone" from "that
 * command does not exist", so only the former triggers a rebuild.
 */
export function isMissingWorkdirError(error: unknown, workdir: string | undefined): boolean {
  if (!workdir) return false;
  if ((error as NodeJS.ErrnoException | null)?.code !== 'ENOENT') return false;
  return !existsSync(workdir);
}

const bundleDirectory = dirname(fileURLToPath(import.meta.url));
const bundledFactorySkillsPath = join(bundleDirectory, 'factory-skills');
export const FACTORY_SKILLS_SOURCE_PATH =
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
export const FACTORY_SKILL_NAMES = new Set([
  'configure-factory-rules',
  'factory-complete-issue',
  'factory-plan',
  'factory-rereview',
  'factory-review',
  'factory-triage',
]);

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

function skillSourceEnoent(skillPath: string): Error {
  const error = new Error(`ENOENT: no such file or directory, '${skillPath}'`) as Error & { code: string };
  error.code = 'ENOENT';
  return error;
}

/**
 * Sandbox-backed skill fallback that stays inert until the session sandbox is
 * actually materialized. Skill discovery runs on latency-sensitive paths (the
 * Factory start coordinator resolves the kickoff skill before the start route
 * responds); without this guard the first project-root read would hit the lazy
 * sandbox handle and force full provisioning + repo materialization. While the
 * sandbox is unmaterialized, project skill roots simply appear empty — bundled
 * Factory skills resolve from local disk via `FactorySkillSource`. Once the
 * sandbox exists, every call delegates straight through.
 */
class UnmaterializedAwareSkillSource implements SkillSource {
  constructor(
    readonly fallback: SkillSource,
    readonly isMaterialized: () => boolean,
  ) {}

  async exists(skillPath: string): Promise<boolean> {
    return this.isMaterialized() ? this.fallback.exists(skillPath) : false;
  }

  async stat(skillPath: string): Promise<SkillSourceStat> {
    if (!this.isMaterialized()) throw skillSourceEnoent(skillPath);
    return this.fallback.stat(skillPath);
  }

  async readFile(skillPath: string): Promise<string | Buffer> {
    if (!this.isMaterialized()) throw skillSourceEnoent(skillPath);
    return this.fallback.readFile(skillPath);
  }

  async readdir(skillPath: string): Promise<SkillSourceEntry[]> {
    return this.isMaterialized() ? this.fallback.readdir(skillPath) : [];
  }

  realpath(skillPath: string): Promise<string> {
    if (!this.isMaterialized()) return Promise.resolve(skillPath);
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
  /** Factory sandbox runtime config (session sandbox callback). */
  sandbox?: MastraFactorySandboxConfig;
  /** GitHub integration used to resolve Factory sessions and mint repo tokens. */
  github?: GithubIntegration;
  /** Work-items storage used to resolve the session's run-binding role, so
   * review-board sessions get the reviewer PAT as `GH_TOKEN`. Optional —
   * without it every session uses the default (worker) PAT. */
  workItems?: Pick<WorkItemsStorage, 'findRunBindingBySession'>;
  /** Runtime workspace/token registrations invalidated when a session retires. */
  workspaceRegistry?: FactoryWorkspaceRegistry;
}

type WorkspaceUnregister = () => Promise<void> | void;

/** Tracks dynamic Factory workspaces by persisted session id for retirement. */
export class FactoryWorkspaceRegistry {
  readonly #entries = new Map<string, Map<string, WorkspaceUnregister>>();
  readonly #generations = new Map<string, number>();

  generation(sessionId: string): number {
    return this.#generations.get(sessionId) ?? 0;
  }

  async register(
    sessionId: string,
    workspaceId: string,
    generation: number,
    unregister: WorkspaceUnregister,
  ): Promise<boolean> {
    if (generation !== this.generation(sessionId)) {
      await unregister();
      return false;
    }
    const entries = this.#entries.get(sessionId) ?? new Map<string, WorkspaceUnregister>();
    entries.set(workspaceId, unregister);
    this.#entries.set(sessionId, entries);
    return true;
  }

  async invalidateSession(sessionId: string): Promise<void> {
    this.#generations.set(sessionId, this.generation(sessionId) + 1);
    const entries = this.#entries.get(sessionId);
    if (!entries) return;
    this.#entries.delete(sessionId);
    const results = await Promise.allSettled([...entries.values()].map(unregister => unregister()));
    const failure = results.find(result => result.status === 'rejected');
    if (failure?.status === 'rejected') throw failure.reason;
  }
}

export function createWorkspaceFactory(options: CreateWorkspaceFactoryOptions = {}) {
  const { sandbox: sandboxConfig, github, workItems } = options;
  const workspaceRegistry = options.workspaceRegistry ?? new FactoryWorkspaceRegistry();
  type GithubTokenRegistration = {
    inject: (token: string) => void;
    patKind: GithubPatKind;
    ghToken: string;
    generation: number;
    tokenReplacementPending: boolean;
  };
  type SessionSandbox = MaterializationSandbox;
  const githubTokenInjectors = new Map<string, GithubTokenRegistration>();
  const githubTokenReconciliations = new Map<string, Promise<void>>();
  // Concurrent requests for the same session (thread list + activity polling +
  // chat) must not each provision a sandbox and clone the repository. The
  // first caller materializes; followers await the same promise. Failed
  // materializations are dropped from the map so the next use retries.
  const inflightMaterializations = new Map<string, Promise<SessionSandbox>>();
  // Fully materialized sandboxes, keyed by workspace id. The lazy sandbox
  // handle delegates here once materialization completed.
  const materializedSandboxes = new Map<string, SessionSandbox>();
  // Workspace identity cache: concurrent resolutions of the same session must
  // observe the same Workspace object even when no Mastra registry is wired
  // (the registry stays the source of truth when present).
  const constructedWorkspaces = new Map<string, Workspace>();

  return async ({ requestContext, mastra, skillExtension }: DynamicWorkspaceContext) => {
    const effectiveSkillExtension = skillExtension ?? factorySkillExtension;
    const ctx = requestContext.get('controller') as AgentControllerRequestContext<MastraCodeState> | undefined;
    const session =
      ctx?.resourceId && github ? await github.sourceControlStorage.sessions.getBySessionId(ctx.resourceId) : null;

    if (!session) {
      // No factory session, no workspace. Chat still works; workspace tools
      // are simply not registered. Host-cwd behavior is opt-in via a
      // LocalSandbox callback rooted wherever the deployer wants — the
      // resolver never hands out the server host's own filesystem.
      return undefined;
    }

    const user = getFactoryAuthUserFromContext(requestContext);
    const userId = getFactoryAuthUserId(user);
    // No identity at all is a server-side caller that forgot to seed one
    // (webhook, cron), not someone reaching for another user's session.
    if (!user?.organizationId || !userId) {
      throw new Error(`Factory session ${session.sessionId} was resolved without a caller identity`);
    }
    // Org-visible sessions open to any member of the owning organization;
    // only private sessions stay owner-only. Cross-org access never passes.
    if (user.organizationId !== session.orgId || (session.visibility === 'private' && userId !== session.userId)) {
      throw new Error(`Factory session ${session.sessionId} is not available to the current user`);
    }
    if (!sandboxConfig || !github) {
      throw new Error('GitHub and a sandbox callback are required to create a Factory session workspace');
    }
    const createSessionSandboxInstance = sandboxConfig;

    const storage = github.sourceControlStorage;
    const projectRepository = await storage.projectRepositories.get({
      orgId: session.orgId,
      id: session.projectRepositoryId,
    });
    if (!projectRepository) throw new Error(`Repository link ${session.projectRepositoryId} was not found`);
    // The remaining reads only depend on the repository link — issue them in
    // parallel instead of paying four sequential storage round-trips.
    const [connection, repository] = await Promise.all([
      storage.connections.get({ orgId: session.orgId, id: projectRepository.connectionId }),
      storage.repositories.get({ orgId: session.orgId, id: projectRepository.repositoryId }),
    ]);
    if (!connection || !repository) throw new Error(`Repository link ${session.projectRepositoryId} is incomplete`);
    const installation = await storage.installations.get({ orgId: session.orgId, id: connection.installationId });
    if (!installation) throw new Error(`GitHub installation ${connection.installationId} was not found`);
    const repoFullName = repository.slug;

    // Construct (or fetch) the session's memoized sandbox instance and derive
    // the workdir from it. Construction is cheap and side-effect-free by the
    // callback contract — the VM is provisioned on `start()`, which only the
    // materialization pipeline calls. The workdir is deterministic, never
    // persisted, never trusted from storage or client input — the
    // stale-workdir incident class came from reusing `session.sandboxWorkdir`
    // written under a different provider.
    // `runSetupOn` references `runSessionSetup`, defined below — it is only
    // invoked during start/fallback, long after this closure fully initializes.
    const runSetupOn = (target: unknown) => runSessionSetup(target as SessionSandbox);
    const setupHook = createSessionSetupHook(runSetupOn, repoFullName);
    const constructSessionEntry = () =>
      getSessionSandbox(session.id, repoFullName, () =>
        createSessionSandboxInstance({
          sessionId: session.id,
          repoFullName,
          ...(projectRepository.setupCommand ? { setupCommand: projectRepository.setupCommand } : {}),
          onStart: setupHook,
          actingUserId: userId,
        }),
      );
    const sessionEntry = constructSessionEntry();
    const workdir = sessionEntry.workdir;
    const isLocalSandbox = sessionEntry.sandbox.provider === 'local';
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

    const extensionId = effectiveSkillExtension ? `-${effectiveSkillExtension.id}` : '';
    const workspaceId = `${WORKSPACE_ID_PREFIX}-${projectRepository.id}-${session.id}${extensionId}`;
    const workspaceGeneration = workspaceRegistry.generation(session.sessionId);
    const configDir = DEFAULT_CONFIG_DIR;

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
            materializedSandboxes.delete(workspaceId);
            constructedWorkspaces.delete(workspaceId);
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
    } catch {
      // Not registered yet.
      existing = undefined;
    }
    existing ??= constructedWorkspaces.get(workspaceId);
    if (existing) {
      existing.setToolsConfig(MASTRACODE_WORKSPACE_TOOLS);
      // A materialization kicked off by another caller may still be running.
      // Deliberately do NOT wait for it: a metadata-only resolution (thread
      // list, messages, activity) must not block on the clone/setup that lazy
      // materialization exists to avoid. Token reconciliation below no-ops
      // until the leader registers the injector, and the next reuse after
      // materialization completes reconciles against the live sandbox.
      return reconcileRegisteredWorkspace(existing);
    }

    const retiredError = () =>
      new Error(`Factory session ${session.sessionId} was retired during workspace materialization`);

    // The session's setup work: materialize the repo (disk-truth idempotent),
    // check out the session branch, run the configured setup command. Minted
    // tokens are fetched inside the run so a replacement VM healed mid-session
    // gets fresh credentials, not ones captured at workspace construction.
    const runSessionSetup = async (target: SessionSandbox): Promise<void> => {
      const token = await getRepositoryToken();
      // The configured setup command may shell out to `gh`/https fetches, so
      // GH_TOKEN must exist before setup runs — and it must be the same
      // gh-capable credential the session gets after start (installation
      // tokens 403 on integration-restricted endpoints when the org
      // configured a PAT).
      const setupPatKind = await resolveGithubPatKind('default');
      const setupGhToken = (await getGithubPat(() => github.integrationStorage, session.orgId, setupPatKind)) ?? token;
      target.setEnvironmentVariable?.('GH_TOKEN', setupGhToken);
      await materializeRepo({
        row: { id: session.id, sandboxWorkdir: workdir, materializedAt: session.materializedAt },
        repoInfo: { repoFullName: repoFullName, defaultBranch: repository.defaultBranch },
        sandbox: target,
        token,
        storage: storage.sessions,
      });
      await checkoutSessionBranch(target, workdir, {
        branch: session.branch,
        baseBranch: session.baseBranch || projectRepository.branch || repository.defaultBranch,
        token,
        repoFullName: repoFullName,
      });
      if (projectRepository.setupCommand) {
        try {
          await runWorktreeSetup(target, workdir, projectRepository.setupCommand);
        } catch (setupError) {
          if (projectRepository.teardownCommand) {
            try {
              await runWorktreeTeardown(target, workdir, projectRepository.teardownCommand, {
                timeoutMs: DEFAULT_COMMAND_TIMEOUT_MS,
              });
            } catch (teardownError) {
              console.warn('[Mastra Factory] Worktree teardown after setup failure failed', {
                orgId: session.orgId,
                sessionId: session.sessionId,
                projectRepositoryId: session.projectRepositoryId,
                error: teardownError instanceof Error ? teardownError.message.slice(-2000) : String(teardownError),
              });
            }
          }
          throw setupError;
        }
      }
    };
    const asSessionSandbox = (candidate: ReturnType<typeof createSessionSandboxInstance>): SessionSandbox => {
      if (typeof candidate.executeCommand !== 'function') {
        throw new Error('The sandbox create callback must return a sandbox with executeCommand support');
      }
      return candidate as unknown as SessionSandbox;
    };

    const materializeSandbox = async (): Promise<SessionSandbox> => {
      // A session already retired by the time a held lazy handle re-enters
      // materialization must not provision anything.
      if (workspaceRegistry.generation(session.sessionId) !== workspaceGeneration) {
        throw retiredError();
      }

      // Fail fast on credential resolution BEFORE constructing a VM: a
      // session whose repo token cannot be minted must not provision, and
      // this await is the ordering seam that keeps metadata-only resolution
      // from reaching the provider.
      await getRepositoryToken();

      // Sandbox identity is the session id: the provider resolves it on
      // start (reconnect/resume an existing VM, create otherwise), and the
      // per-process memo makes the base class's start coalescing apply
      // process-wide per session. The setup hook runs inside the start
      // lifecycle, so any lazy start heals a replaced VM. Re-fetch through
      // the memo rather than reusing the resolution-scope entry: a dead-VM
      // eviction must construct a FRESH instance here (a memoized instance
      // already reporting `running` would early-return from start()).
      // Bridge: the setup helpers speak WorkspaceSandbox while the git
      // helpers take the narrower MaterializationSandbox surface. Same
      // object either way.
      const sandbox = asSessionSandbox(constructSessionEntry().sandbox);
      await sandbox.start();
      // Covers callbacks that did not forward ctx.onStart: probes the same
      // completion marker the hook writes, so this no-ops when the hook ran.
      await runSessionSetupFallback(
        sandbox as unknown as Parameters<typeof runSessionSetupFallback>[0],
        runSetupOn,
        repoFullName,
        session.id,
      );
      // The `gh` CLI needs a PAT when the org configured one (installation
      // tokens 403 on integration-restricted endpoints); git clone/checkout
      // keep using the minted installation token. Review-board sessions
      // (run-binding role `review`) authenticate `gh` as the reviewer account
      // when a reviewer token is configured; everything else — including
      // sessions with no resolvable run binding — uses the worker token.
      // Resolved AFTER start + setup so the installed credential is at least
      // as fresh as the one the setup hook used; injected post-start rather
      // than baked into the VM's creation env, so it never outlives rotation.
      const patKind = await resolveGithubPatKind('default');
      const ghCliToken =
        (await getGithubPat(() => github.integrationStorage, session.orgId, patKind)) ?? (await getRepositoryToken());
      sandbox.setEnvironmentVariable?.('GH_TOKEN', ghCliToken);
      // Observability only — nothing reads these columns for decisions.
      void storage.sessions
        .setSandbox({ id: session.id, sandboxId: sandbox.id, sandboxWorkdir: workdir })
        .catch(() => {});

      const tokenRegistration: GithubTokenRegistration = {
        inject: freshToken => {
          if (!sandbox.setEnvironmentVariable) {
            throw new Error('The active sandbox provider does not support runtime GitHub token refresh.');
          }
          sandbox.setEnvironmentVariable('GH_TOKEN', freshToken);
          tokenRegistration.ghToken = freshToken;
        },
        patKind,
        ghToken: ghCliToken,
        generation: 0,
        tokenReplacementPending: false,
      };
      // The session can be retired while this deferred phase is in flight.
      // Registration happened back at construction time (the workspace exists
      // before it materializes), so the retirement callback has already torn
      // the workspace down — stop the just-built sandbox and surface the
      // retirement instead of handing back a sandbox for a dead session.
      if (workspaceRegistry.generation(session.sessionId) !== workspaceGeneration) {
        // The retirement callback ran before this instance was memoized, so
        // its eviction missed it — evict here or a later re-open of a
        // non-deleted session would reuse a stopped handle.
        evictSessionSandbox(session.id);
        try {
          const stoppable = sandbox as unknown as { _stop?: () => Promise<void>; stop?: () => Promise<void> };
          await (stoppable._stop ?? stoppable.stop)?.call(stoppable);
        } catch (teardownError) {
          console.warn('[Mastra Factory] Sandbox stop after mid-materialization retirement failed', {
            orgId: session.orgId,
            sessionId: session.sessionId,
            error: teardownError instanceof Error ? teardownError.message.slice(-2000) : String(teardownError),
          });
        }
        throw retiredError();
      }
      githubTokenInjectors.set(workspaceId, tokenRegistration);
      registerGithubTokenContext(tokenRegistration);
      return sandbox;
    };

    // Memoized deferred phase. The first FS/sandbox operation materializes
    // (fully lazy — nothing provisions ahead of use); followers
    // await the same in-flight promise. Failures are dropped from the map so
    // the next use retries instead of caching a broken sandbox.
    const ensureMaterialized = async (): Promise<SessionSandbox> => {
      const ready = materializedSandboxes.get(workspaceId);
      if (ready) return ready;
      let inflight = inflightMaterializations.get(workspaceId);
      if (!inflight) {
        inflight = materializeSandbox();
        inflightMaterializations.set(workspaceId, inflight);
        inflight.then(
          sb => {
            materializedSandboxes.set(workspaceId, sb);
            // Project skill roots (.claude/skills etc.) were reported empty by
            // the unmaterialized-source guard during discovery; rescan now that
            // the checkout exists so repo-local skills become visible without
            // waiting for the maybeRefresh cooldown. Fire-and-forget.
            void workspace.skills?.refresh().catch(() => {});
          },
          () => {},
        );
      }
      try {
        return await inflight;
      } finally {
        if (inflightMaterializations.get(workspaceId) === inflight) {
          inflightMaterializations.delete(workspaceId);
        }
      }
    };

    // Lazy sandbox handle: resolution returns immediately and the sandbox
    // work (provision/boot-from-checkpoint + materialize + checkout + setup)
    // runs on first use. Metadata-only resolutions (thread-list polling)
    // never touch it.
    const lazySandbox = {
      get id() {
        return materializedSandboxes.get(workspaceId)?.id ?? workspaceId;
      },
      name: 'Factory Lazy Sandbox',
      get provider() {
        return materializedSandboxes.get(workspaceId)?.provider ?? sessionEntry.sandbox.provider;
      },
      get status() {
        return materializedSandboxes.has(workspaceId) ? 'ready' : 'pending';
      },
      get supportsCheckpoints() {
        return materializedSandboxes.get(workspaceId)?.supportsCheckpoints ?? false;
      },
      getInstructions() {
        // Prefer the live sandbox's instructions once materialized; before
        // that, forward the constructed (not yet started) instance's
        // instructions so tool descriptions are accurate without forcing
        // materialization.
        return (
          materializedSandboxes.get(workspaceId)?.getInstructions?.() ?? sessionEntry.sandbox.getInstructions?.() ?? ''
        );
      },
      clone(): never {
        throw new Error('The Factory session sandbox cannot be cloned from a lazy handle.');
      },
      async start() {
        // Intentionally a no-op. `Workspace.init()` calls `sandbox.start()`
        // during session creation, and sessions are get-or-created by
        // metadata-only GET routes (/threads, /messages). Materializing here
        // would provision a sandbox for every read-only poll. The sandbox
        // materializes on first real use (executeCommand/getInfo) instead.
      },
      async getInfo() {
        const sandbox = await ensureMaterialized();
        return sandbox.getInfo();
      },
      async executeCommand(command: string, args?: string[], options?: Record<string, unknown>) {
        const sandbox = await ensureMaterialized();
        try {
          return await sandbox.executeCommand(command, args, options);
        } catch (error) {
          if (!isDeadSandboxError(error) && !(isLocalSandbox && isMissingWorkdirError(error, workdir))) throw error;
          // The sandbox died mid-session (idle GC, provider destroy, broken
          // transport, or a retired local checkout removed from under us).
          // Drop the dead handle and re-run the materialization pipeline —
          // the provider's id-keyed start resolves the session id again
          // (reconnect, or provision a replacement VM whose setup hook
          // re-materializes the repo) — then retry the command once.
          // Concurrent failures coalesce through `inflightMaterializations`.
          if (materializedSandboxes.get(workspaceId) === sandbox) {
            materializedSandboxes.delete(workspaceId);
          }
          // Evict the session memo too: the memoized instance already reports
          // `running`, so its `start()` would early-return without
          // re-acquiring. A fresh instance re-resolves the session id at the
          // provider (reconnect, or provision a replacement VM). Conditional
          // on the memo still holding THIS failed instance — a concurrent
          // failure may already have installed a replacement that a blind
          // evict would orphan.
          if (peekSessionSandbox(session.id)?.sandbox === (sandbox as unknown)) {
            evictSessionSandbox(session.id);
          }
          const revived = await ensureMaterialized();
          return revived.executeCommand(command, args, options);
        }
      },
      setEnvironmentVariable(name: string, value: string) {
        const sandbox = materializedSandboxes.get(workspaceId);
        if (!sandbox?.setEnvironmentVariable) {
          throw new Error('The Factory session sandbox is not materialized yet.');
        }
        sandbox.setEnvironmentVariable(name, value);
      },
      async snapshot() {
        // Nothing to checkpoint before the sandbox exists.
        await materializedSandboxes.get(workspaceId)?.snapshot?.();
      },
      async stop() {
        await materializedSandboxes.get(workspaceId)?.stop?.();
      },
    };

    const filesystem = new SandboxFilesystem({
      id: `sandbox-fs:${workspaceId}:${workdir}`,
      sandbox: lazySandbox,
      workdir,
    });
    const projectSkillPaths = [path.join(configDir, 'skills'), '.claude/skills', '.agents/skills'];
    const guardedSkillFallback = new UnmaterializedAwareSkillSource(filesystem, () =>
      materializedSandboxes.has(workspaceId),
    );
    const skillPaths = [...(effectiveSkillExtension?.paths ?? []), ...projectSkillPaths];
    const workspace = new Workspace({
      id: workspaceId,
      name: 'Mastra Code Factory Session Workspace',
      filesystem,
      sandbox: lazySandbox as unknown as ConstructorParameters<typeof Workspace>[0]['sandbox'],
      tools: MASTRACODE_WORKSPACE_TOOLS,
      skills: skillPaths,
      // Project skill roots live in the sandbox checkout; guard them so skill
      // discovery before materialization (e.g. kickoff skill resolution in the
      // start coordinator) never forces sandbox provisioning.
      skillSource:
        effectiveSkillExtension?.createSource(guardedSkillFallback, projectSkillPaths) ?? guardedSkillFallback,
    });
    // Register with the Mastra instance so sync HTTP handlers that resolve
    // the workspace via `mastra.getWorkspaceById(id)` (file tree, permissions
    // probe, MCP/tool routes) find it instead of throwing
    // `MASTRA_GET_WORKSPACE_BY_ID_NOT_FOUND`. `addWorkspace` is idempotent on
    // key collision, so concurrent first resolutions stay race-safe (the
    // deferred phase is deduped separately through `inflightMaterializations`).
    mastra?.addWorkspace(workspace, workspaceId, { source: 'mastra' });
    // Cache synchronously with construction: the `await` below is a suspension
    // point, and a concurrent resolution for the same session must observe this
    // workspace rather than build a second one.
    constructedWorkspaces.set(workspaceId, workspace);
    // Retirement is registered against the workspace itself rather than the
    // sandbox: construction is now eager while materialization is deferred, so
    // a session retired before its first tool call still has a workspace (and a
    // token injector) that must be torn down.
    const registered = await workspaceRegistry.register(
      session.sessionId,
      workspaceId,
      workspaceGeneration,
      async () => {
        githubTokenInjectors.delete(workspaceId);
        materializedSandboxes.delete(workspaceId);
        constructedWorkspaces.delete(workspaceId);
        // Retirement drops the memoized session sandbox so a later re-open
        // constructs (and the provider resolves) fresh instead of reusing an
        // instance whose VM the retirement path may stop or destroy.
        evictSessionSandbox(session.id);
        await mastra?.removeWorkspace?.(workspaceId);
      },
    );
    if (!registered) {
      throw new Error(`Factory session ${session.sessionId} was retired during workspace materialization`);
    }

    // Fully lazy: nothing provisions until the first real sandbox operation.
    // A background warm-up at session start was considered and dropped — it
    // speculatively created a VM for every session, including ones whose
    // agent never touches the workspace.
    return workspace;
  };
}

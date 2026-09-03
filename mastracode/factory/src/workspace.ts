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
import type {
  SandboxStartHook,
  SkillSource,
  SkillSourceEntry,
  SkillSourceStat,
  WorkspaceSandbox,
} from '@mastra/core/workspace';
import { getFactoryAuthUserFromContext, getFactoryAuthUserId } from './auth.js';
import type { MastraFactorySandboxConfig } from './factory.js';
import type { GithubIntegration } from './integrations/github/integration.js';
import { getGithubPat } from './integrations/github/pat.js';
import type { GithubPatKind } from './integrations/github/pat.js';
import {
  checkoutSessionBranch,
  DEFAULT_COMMAND_TIMEOUT_MS,
  materializeRepo,
  runSetupCommand,
  runTeardownCommand,
  SetupCommandError,
} from './integrations/github/sandbox.js';
import { registerGithubPatKind, registerGithubTokenInjector } from './integrations/github/token-refresh.js';
import { getFactorySessionAddress } from './rules/binding-context.js';
import { requireExec } from './sandbox/materialization.js';
import type { ExecutableSandbox } from './sandbox/materialization.js';
import {
  createSessionSetupHook,
  evictSessionSandbox,
  getSessionSandbox,
  hasFailedSetupCommand,
  recordFailedSetupCommand,
  resolveSessionWorkdir,
} from './sandbox/session-sandbox.js';
import type { SessionSetupGate } from './sandbox/session-sandbox.js';
import type { WorkItemsStorage } from './storage/domains/work-items/base.js';
import { timedPhase } from './timing.js';

const WORKSPACE_ID_PREFIX = 'mfw';
const bundleDirectory = dirname(fileURLToPath(import.meta.url));
const bundledFactorySkillsPath = join(bundleDirectory, 'factory-skills');
export const BUNDLED_FACTORY_SKILLS_PATH =
  [
    // Deploy bundle: the consumer copies `factory-skills/` next to the built
    // server module (e.g. via its public/ dir).
    bundledFactorySkillsPath,
    // Package layout: `dist/../factory-skills` (also `src/../factory-skills`
    // when running tests against sources).
    join(bundleDirectory, '..', 'factory-skills'),
  ].find(existsSync) ?? bundledFactorySkillsPath;

/**
 * Resolve the consumer repo's local Factory skills root, if any. Checked in
 * addition to the bundled skills so projects can add (or override) Factory
 * skills without patching the installed package. Candidates cover the cwd
 * variants the dev server runs with (`repo root`, `--dir src/mastra` which
 * runs with cwd `src/mastra/public`).
 */
export function resolveLocalFactorySkillsPath(cwd: string = process.cwd()): string | undefined {
  const candidates = [
    join(cwd, 'src', 'mastra', 'public', 'factory-skills'),
    join(cwd, 'public', 'factory-skills'),
    join(cwd, 'factory-skills'),
  ];
  return candidates.find(
    candidate => path.normalize(candidate) !== path.normalize(BUNDLED_FACTORY_SKILLS_PATH) && existsSync(candidate),
  );
}
const FACTORY_SKILLS_MOUNT = path.resolve(path.parse(process.cwd()).root, '__mastracode_factory_skills__');
export const FACTORY_SKILL_NAMES = new Set([
  'configure-factory-rules',
  'factory-complete-issue',
  'factory-plan',
  'factory-rereview',
  'factory-review',
  'factory-triage',
]);

export class FactorySkillSource implements SkillSource {
  readonly #bundledSource = new LocalSkillSource({ basePath: BUNDLED_FACTORY_SKILLS_PATH });
  readonly #localSource: LocalSkillSource | undefined;
  readonly #fallbackSkillRoots: Set<string>;

  constructor(
    readonly fallback: SkillSource,
    fallbackSkillRoots: string[],
    localSkillsPath: string | undefined = resolveLocalFactorySkillsPath(),
  ) {
    this.#localSource = localSkillsPath ? new LocalSkillSource({ basePath: localSkillsPath }) : undefined;
    this.#fallbackSkillRoots = new Set(fallbackSkillRoots.map(skillPath => path.normalize(skillPath)));
  }

  #isFactoryPath(skillPath: string): boolean {
    const normalized = path.normalize(skillPath);
    return normalized === FACTORY_SKILLS_MOUNT || normalized.startsWith(`${FACTORY_SKILLS_MOUNT}${path.sep}`);
  }

  #factoryPath(skillPath: string): string {
    return path.relative(FACTORY_SKILLS_MOUNT, path.normalize(skillPath));
  }

  /** Pick the layer serving this mount-relative path: local wins when it has the entry. */
  async #layerFor(relativePath: string): Promise<LocalSkillSource> {
    if (this.#localSource && (await this.#localSource.exists(relativePath))) return this.#localSource;
    return this.#bundledSource;
  }

  async exists(skillPath: string): Promise<boolean> {
    if (!this.#isFactoryPath(skillPath)) return this.fallback.exists(skillPath);
    const relative = this.#factoryPath(skillPath);
    if (this.#localSource && (await this.#localSource.exists(relative))) return true;
    return this.#bundledSource.exists(relative);
  }

  async stat(skillPath: string): Promise<SkillSourceStat> {
    if (!this.#isFactoryPath(skillPath)) return this.fallback.stat(skillPath);
    const relative = this.#factoryPath(skillPath);
    return (await this.#layerFor(relative)).stat(relative);
  }

  async readFile(skillPath: string): Promise<string | Buffer> {
    if (!this.#isFactoryPath(skillPath)) return this.fallback.readFile(skillPath);
    const relative = this.#factoryPath(skillPath);
    return (await this.#layerFor(relative)).readFile(relative);
  }

  async readdir(skillPath: string): Promise<SkillSourceEntry[]> {
    if (this.#isFactoryPath(skillPath)) {
      const relative = this.#factoryPath(skillPath);
      const [bundledExists, localExists] = await Promise.all([
        this.#bundledSource.exists(relative),
        this.#localSource?.exists(relative) ?? Promise.resolve(false),
      ]);
      if (!bundledExists && !localExists) throw skillSourceEnoent(skillPath);
      const [bundledEntries, localEntries] = await Promise.all([
        bundledExists ? this.#bundledSource.readdir(relative) : [],
        localExists ? this.#localSource!.readdir(relative) : [],
      ]);
      const merged = new Map<string, SkillSourceEntry>();
      for (const entry of bundledEntries) merged.set(entry.name, entry);
      // Local entries override bundled names.
      for (const entry of localEntries) merged.set(entry.name, entry);
      return [...merged.values()];
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

/** Build a Node-style ENOENT error so callers can treat missing skills like fs misses. */
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

/**
 * When a session's sandbox boots: on the agent's first command (`'lazy'`, the
 * default) or as soon as the session's workspace is first resolved (`'eager'`).
 * An eager start is fire-and-forget; if it fails, the lazy path still runs.
 */
export type FactorySandboxStart = 'lazy' | 'eager';

export interface CreateWorkspaceFactoryOptions {
  /** Factory sandbox runtime config (session sandbox callback). */
  sandbox?: MastraFactorySandboxConfig;
  /** Defaults to `'lazy'`. */
  sandboxStart?: FactorySandboxStart;
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
  const eagerSandboxStart = options.sandboxStart === 'eager';
  const workspaceRegistry = options.workspaceRegistry ?? new FactoryWorkspaceRegistry();
  type GithubTokenRegistration = {
    inject: (token: string) => void;
    patKind: GithubPatKind;
    ghToken: string;
    generation: number;
    tokenReplacementPending: boolean;
  };
  // The session setup path runs commands and installs credentials, so it
  // needs `executeCommand` (required by `ExecutableSandbox`) plus core's
  // optional `setEnv`, which stays optional here because the token-refresh
  // path checks for it and reports its absence.
  type SessionSandbox = ExecutableSandbox & { setEnv?: WorkspaceSandbox['setEnv'] };
  const githubTokenInjectors = new Map<string, GithubTokenRegistration>();
  const githubTokenReconciliations = new Map<string, Promise<void>>();
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

    // Construct (or fetch) the session's memoized sandbox instance.
    // Construction is cheap and side-effect-free by the callback contract —
    // the VM is provisioned on `start()`, which only the materialization
    // pipeline calls. The workdir is never persisted or trusted from storage
    // or client input (the stale-workdir incident class came from reusing
    // `session.sandboxWorkdir` written under a different provider): local
    // sandboxes derive it at construction, remote sandboxes clone into the
    // VM's own home so it resolves lazily at first start.
    // `runSetupOn` references `runSessionSetup`, defined below — it is only
    // invoked during start, long after this closure fully initializes.
    const runSetupOn = (target: unknown, workdir: string, gate: SessionSetupGate) =>
      runSessionSetup(requireExec(target as WorkspaceSandbox), workdir, gate);
    const guardedSetup = createSessionSetupHook(
      runSetupOn,
      session.id,
      repoFullName,
      projectRepository.setupCommand ?? undefined,
    );
    // Composed start hook: marker-guarded repo setup, then per-start
    // credential install. It runs inside the provider's start lifecycle on
    // EVERY start (create or reconnect) — providers own lazy start
    // (`ensureRunning()` on first command) and dead-VM self-healing (E2B
    // `retryOnDead`, Platform status reset on destroy), so a replacement VM
    // re-enters this hook and heals itself with credentials at least as
    // fresh as the start that installed them.
    const setupHook: SandboxStartHook = async args => {
      // A session retired before its first start must not set anything up.
      if (workspaceRegistry.generation(session.sessionId) !== workspaceGeneration) {
        throw retiredError();
      }
      await guardedSetup(args);
      // Re-check after the (long) setup: a session retired mid-setup must not
      // register credentials for a workspace whose retirement teardown has
      // already run — the entry would leak forever. The VM itself is left to
      // the provider's idle timeout (accepted).
      if (workspaceRegistry.generation(session.sessionId) !== workspaceGeneration) {
        throw retiredError();
      }
      const target: SessionSandbox = requireExec(args.sandbox);
      // The `gh` CLI needs a PAT when the org configured one (installation
      // tokens 403 on integration-restricted endpoints); git clone/checkout
      // keep using the minted installation token. Resolved per start so the
      // installed credential never outlives rotation.
      const patKind = await resolveGithubPatKind('default');
      const ghCliToken =
        (await getGithubPat(() => github.integrationStorage, session.orgId, patKind)) ?? (await getRepositoryToken());
      target.setEnv?.(env => ({ ...env, GH_TOKEN: ghCliToken }));
      // Observability only — nothing reads these columns for decisions. The
      // workdir was resolved (and memoized on the entry) by the guarded setup.
      void storage.sessions
        .setSandbox({ id: session.id, sandboxId: target.id, sandboxWorkdir: sessionEntry.workdir ?? '' })
        .catch(() => {});
      const tokenRegistration: GithubTokenRegistration = {
        inject: freshToken => {
          if (!target.setEnv) {
            throw new Error('The active sandbox provider does not support runtime GitHub token refresh.');
          }
          target.setEnv(env => ({ ...env, GH_TOKEN: freshToken }));
          tokenRegistration.ghToken = freshToken;
        },
        patKind,
        ghToken: ghCliToken,
        generation: 0,
        tokenReplacementPending: false,
      };
      githubTokenInjectors.set(workspaceId, tokenRegistration);
      registerGithubTokenContext(tokenRegistration);
      // Project skill roots were reported empty by the unmaterialized-source
      // guard before the checkout existed; rescan now. Fire-and-forget.
      void constructedWorkspaces
        .get(workspaceId)
        ?.skills?.refresh()
        .catch(() => {});
    };
    const constructSessionEntry = () =>
      getSessionSandbox(session.id, repoFullName, () => {
        const sandbox = createSessionSandboxInstance({
          sessionId: session.id,
          repoFullName,
          // Stored nullable; the context speaks `undefined` for absent.
          setupCommand: projectRepository.setupCommand ?? undefined,
          // Deferred call — only dereferenced when a provider needs the repo
          // outside the VM (template build time).
          getRepositoryAccess: () =>
            github.versionControl.getRepositoryAccess({ orgId: session.orgId, repositoryId: repository.id }),
        });
        // Attached inside the construction closure, so exactly once per
        // instance — `constructSessionEntry` runs on every open and would
        // stack a wrapper per call. Factory's setup runs first: a hook the
        // callback installed itself expects a prepared workspace.
        sandbox.setOnStart(previous => async args => {
          await timedPhase(`workspace.onStart(${args.outcome})`, async () => {
            await setupHook(args);
          });
          await previous?.(args);
        });
        // Only a freshly constructed instance starts eagerly; the start itself
        // waits for this resolver to finish because the start hook reads
        // bindings declared further down.
        startEagerly = eagerSandboxStart;
        return sandbox;
      });
    let startEagerly = false;
    const fireEagerStart = () => {
      if (!startEagerly) return;
      startEagerly = false;
      sessionEntry.sandbox.start?.().catch(error => {
        console.warn(`[factory] Eager sandbox start for session ${session.id} failed:`, error);
      });
    };
    const sessionEntry = constructSessionEntry();
    const workdir = sessionEntry.workdir;
    const isLocalSandbox = sessionEntry.sandbox.provider === 'local';
    // The system prompt derives its working directory from `state.projectPath`
    // and falls back to the server's own process.cwd() when unset — which
    // points the agent at the host checkout (and lets it run `git checkout`
    // there instead of in its session workdir). Pin it to the session workdir
    // once known. A remote workdir resolves at the sandbox's first start, so
    // the pin self-heals on the next resolution after the VM has run.
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
    const runSessionSetup = async (target: SessionSandbox, workdir: string, gate: SessionSetupGate): Promise<void> => {
      const token = await getRepositoryToken();
      // The configured setup command may shell out to `gh`/https fetches, so
      // GH_TOKEN must exist before setup runs — and it must be the same
      // gh-capable credential the session gets after start (installation
      // tokens 403 on integration-restricted endpoints when the org
      // configured a PAT).
      const setupPatKind = await resolveGithubPatKind('default');
      const setupGhToken = (await getGithubPat(() => github.integrationStorage, session.orgId, setupPatKind)) ?? token;
      target.setEnv?.(env => ({ ...env, GH_TOKEN: setupGhToken }));
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
      if (projectRepository.setupCommand && !gate.setupDone) {
        // A setup command that already failed this session is skipped rather
        // than failing every start: the first failure surfaced loudly in the
        // tool result that triggered it, and a permanently failing onStart
        // would wedge the session — the agent could never get a shell to fix
        // the problem. Clone and checkout above still ran, so the tree is
        // real; the agent (or an edited setup command) takes it from here.
        if (hasFailedSetupCommand(session.id, projectRepository.setupCommand)) {
          console.warn('[Mastra Factory] Skipping setup command that already failed this session', {
            orgId: session.orgId,
            sessionId: session.sessionId,
            projectRepositoryId: session.projectRepositoryId,
          });
          return;
        }
        try {
          await timedPhase('workspace.setup', () => runSetupCommand(target, workdir, projectRepository.setupCommand!));
          await gate.markSetupDone();
        } catch (setupError) {
          if (projectRepository.teardownCommand) {
            try {
              await runTeardownCommand(target, workdir, projectRepository.teardownCommand, {
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
          if (setupError instanceof SetupCommandError) {
            // The command ran and exited non-zero — a config problem, not an
            // infra one. Remember it so the next start recovers, and tell the
            // agent what happens next. Infra failures (transport, clone)
            // rethrow untouched and retry in full.
            recordFailedSetupCommand(session.id, projectRepository.setupCommand);
            throw new SetupCommandError(
              `${setupError.message}. The sandbox stays usable: this setup command is skipped for the rest of the session — retry your command, then fix the setup command in the repository settings or run it manually.`,
              setupError.code,
            );
          }
          throw setupError;
        }
      }
    };
    // The session's real sandbox goes straight onto the Workspace. Providers
    // own lazy start (`ensureRunning()` inside the first command/process op)
    // and dead-VM self-healing, and the composed `onStart` hook runs the repo
    // setup + credential install inside that lifecycle. Metadata-only
    // resolutions (thread-list polling) construct but never start.
    const sessionSandbox: SessionSandbox = requireExec(sessionEntry.sandbox);

    const filesystem = new SandboxFilesystem({
      id: `sandbox-fs:${workspaceId}`,
      sandbox: sessionSandbox,
      // Lazy: a remote workdir is only knowable once a VM runs. The first
      // file operation resolves it (starting the VM — which materializes the
      // repo via the onStart hook — when needed) and memoizes it.
      workdir: () => resolveSessionWorkdir(session.id, sessionEntry.sandbox, repoFullName),
    });
    const projectSkillPaths = [path.join(configDir, 'skills'), '.claude/skills', '.agents/skills'];
    const guardedSkillFallback = new UnmaterializedAwareSkillSource(
      filesystem,
      () => sessionEntry.sandbox.status === 'running',
    );
    const skillPaths = [...(effectiveSkillExtension?.paths ?? []), ...projectSkillPaths];
    const workspace = new Workspace({
      id: workspaceId,
      name: 'Mastra Code Factory Session Workspace',
      filesystem,
      sandbox: sessionSandbox as unknown as ConstructorParameters<typeof Workspace>[0]['sandbox'],
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
    // key collision, so concurrent first resolutions stay race-safe (start
    // itself is coalesced by the sandbox base class + the session memo).
    mastra?.addWorkspace(workspace, workspaceId, { source: 'mastra' });
    // Cache synchronously with construction: the `await` below is a suspension
    // point, and a concurrent resolution for the same session must observe this
    // workspace rather than build a second one.
    constructedWorkspaces.set(workspaceId, workspace);
    // Retirement is registered against the workspace itself rather than the
    // sandbox: construction is eager while the VM start is lazy, so a session
    // retired before its first tool call still has a workspace (and possibly a
    // token injector) that must be torn down.
    const registered = await workspaceRegistry.register(
      session.sessionId,
      workspaceId,
      workspaceGeneration,
      async () => {
        githubTokenInjectors.delete(workspaceId);
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

    fireEagerStart();
    return workspace;
  };
}

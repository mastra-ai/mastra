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
  hasExistingCheckout,
  DEFAULT_COMMAND_TIMEOUT_MS,
  MaterializeError,
  materializeRepo,
  recycleClaimedWorkdir,
  runWorktreeSetup,
  runWorktreeTeardown,
} from './integrations/github/sandbox.js';
import { registerGithubPatKind, registerGithubTokenInjector } from './integrations/github/token-refresh.js';
import { getFactorySessionAddress } from './rules/binding-context.js';
import { baseCheckpointIsStale } from './sandbox/base-checkpoint-triggers.js';
import type { SandboxBindingStore, SandboxFleet } from './sandbox/fleet.js';
import type { WorkItemsStorage } from './storage/domains/work-items/base.js';

const WORKSPACE_ID_PREFIX = 'mfw';
const SESSION_CHECKPOINT_PREFIX = 'mastracode-session';

export function checkpointNameForSession(sessionId: string): string {
  return `${SESSION_CHECKPOINT_PREFIX}-${sessionId}`;
}

/**
 * Whether a command failure means the sandbox itself is gone (destroyed by
 * idle GC, provider teardown, or a broken exec transport) rather than the
 * command failing. Matched by error name so any provider's equivalent error
 * classes participate without a package dependency.
 */
export function isDeadSandboxError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  if (error.name === 'SandboxExecTransportError' || error.name === 'SandboxDestroyedError') return true;
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
  const { sandbox: sandboxConfig, github, fleet, workItems } = options;
  const workspaceRegistry = options.workspaceRegistry ?? new FactoryWorkspaceRegistry();
  const isLocalSandbox = sandboxConfig?.machine instanceof LocalSandbox;
  type GithubTokenRegistration = {
    inject: (token: string) => void;
    patKind: GithubPatKind;
    ghToken: string;
    generation: number;
    tokenReplacementPending: boolean;
  };
  type FleetSandbox = Awaited<ReturnType<SandboxFleet['ensureSandbox']>>;
  const githubTokenInjectors = new Map<string, GithubTokenRegistration>();
  const githubTokenReconciliations = new Map<string, Promise<void>>();
  // Concurrent requests for the same session (thread list + activity polling +
  // chat) must not each provision a sandbox and clone the repository. The
  // first caller materializes; followers await the same promise. Failed
  // materializations are dropped from the map so the next use retries.
  const inflightMaterializations = new Map<string, Promise<FleetSandbox>>();
  // Fully materialized sandboxes, keyed by workspace id. The lazy sandbox
  // handle delegates here once materialization completed.
  const materializedSandboxes = new Map<string, FleetSandbox>();
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
      if (sandboxConfig && !isLocalSandbox) {
        // Chat-only session on a remote-sandbox deploy: there is no repository
        // to materialize, and the server host must never execute commands on a
        // shared deployment. Run the session without a workspace (chat works,
        // workspace tools are simply not registered) instead of erroring on
        // every message.
        return undefined;
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
    // Org-visible sessions open to any member of the owning organization;
    // only private sessions stay owner-only. Cross-org access never passes.
    if (user.organizationId !== session.orgId || (session.visibility === 'private' && userId !== session.userId)) {
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
    let stateSeeded = false;
    if (ctx && workdir && ctx.getState()?.projectPath !== workdir) {
      await ctx.setState({ projectPath: workdir, projectName: repoFullName });
      stateSeeded = true;
    }
    const binding: SandboxBindingStore = {
      // Read through to the session row so teardown after a fresh provision
      // sees the just-persisted id instead of a stale snapshot.
      get sandboxId() {
        return session.sandboxId;
      },
      checkpointName: checkpointNameForSession(session.id),
      // Boot-only fallback: a brand-new session (no session checkpoint yet)
      // seeds from the repo's warm base checkpoint when one is available and
      // still matches the current setup command. Snapshots keep writing to
      // the session checkpoint, so the shared base image is never mutated.
      ...(!session.materializedAt && projectRepository.baseCheckpoint && !baseCheckpointIsStale(projectRepository)
        ? { seedCheckpointName: projectRepository.baseCheckpoint.name }
        : {}),
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
    const workspaceGeneration = workspaceRegistry.generation(session.sessionId);
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
      // Wait for it (without starting one) so the GitHub token reconciliation
      // below sees the registered injector for the live sandbox; failures are
      // the leader's to surface and retryable on the next sandbox use.
      const inflight = inflightMaterializations.get(workspaceId);
      if (inflight) await inflight.catch(() => {});
      return reconcileRegisteredWorkspace(existing);
    }

    const materializeSandbox = async (): Promise<FleetSandbox> => {
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
        fleet.ensureSandbox(binding, { GH_TOKEN: ghCliToken }, undefined, {
          ...(isLocalSandbox ? { workingDirectory: workdir } : {}),
          actingUserId: userId,
        });
      const runMaterialize = (target: Awaited<ReturnType<typeof ensureSandbox>>, skipPull: boolean) =>
        materializeRepo({
          row: { id: session.id, sandboxWorkdir: workdir, materializedAt: session.materializedAt },
          repoInfo: { repoFullName: repoFullName, defaultBranch: repository.defaultBranch },
          sandbox: target,
          token,
          storage: storage.sessions,
          // A checkpoint-seeded checkout is already at (or minutes behind) the
          // default branch HEAD — skip the redundant network pull so the first
          // agent turn isn't stalled behind it.
          skipPullOnExistingCheckout: skipPull,
        });
      const isGitMissing = (error: unknown) => error instanceof MaterializeError && error.code === 'git-missing';

      let sandbox = await ensureSandbox();
      // A claimed VM still has the previous session's branch checked out —
      // reset it to the default branch before materialize/checkout. When the
      // pooled VM was already reaped, `ensureSandbox` provisioned fresh and
      // the recycle is a no-op (no checkout on disk yet).
      if (claimedPooledSandbox) await recycleClaimedWorkdir(sandbox, workdir, repository.defaultBranch);
      // A never-materialized session whose workdir already holds this repo's
      // checkout was seeded from the warm base checkpoint — the setup command
      // already ran during the base build, so skip it below.
      const seededFromBaseCheckpoint =
        !!binding.seedCheckpointName &&
        !session.materializedAt &&
        !claimedPooledSandbox &&
        (await hasExistingCheckout(sandbox, workdir, repoFullName));
      process.stderr.write(
        `[factory:timing] workspace.materialize.seed seeded=${seededFromBaseCheckpoint} seedName=${binding.seedCheckpointName ?? 'none'} materializedAt=${session.materializedAt ? 'set' : 'null'} pooled=${claimedPooledSandbox}\n`,
      );
      try {
        await runMaterialize(sandbox, seededFromBaseCheckpoint);
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
          // The retry runs on a freshly provisioned VM with no checkout, so
          // the skip flag is moot — pass false to take the normal clone path.
          await runMaterialize(sandbox, false);
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
      // A checkpoint-seeded checkout already ran the setup command during the
      // base build, so re-running it here is pure latency.
      if (projectRepository.setupCommand && !seededFromBaseCheckpoint) {
        try {
          await runWorktreeSetup(sandbox, workdir, projectRepository.setupCommand);
        } catch (setupError) {
          if (projectRepository.teardownCommand) {
            try {
              await runWorktreeTeardown(sandbox, workdir, projectRepository.teardownCommand, {
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
      // the workspace down — surface that to the caller instead of handing back
      // a sandbox belonging to a dead session.
      if (workspaceRegistry.generation(session.sessionId) !== workspaceGeneration) {
        throw new Error(`Factory session ${session.sessionId} was retired during workspace materialization`);
      }
      githubTokenInjectors.set(workspaceId, tokenRegistration);
      registerGithubTokenContext(tokenRegistration);
      return sandbox;
    };

    // Memoized deferred phase. The first caller (a background warm-up at
    // session start, or the first FS/sandbox operation) materializes; followers
    // await the same in-flight promise. Failures are dropped from the map so
    // the next use retries instead of caching a broken sandbox.
    const ensureMaterialized = async (): Promise<FleetSandbox> => {
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
        return fleet.provider;
      },
      get status() {
        return materializedSandboxes.has(workspaceId) ? 'ready' : 'pending';
      },
      get supportsCheckpoints() {
        return materializedSandboxes.get(workspaceId)?.supportsCheckpoints ?? false;
      },
      getInstructions() {
        // Prefer the live sandbox's instructions once materialized; before
        // that, forward the configured template machine's instructions so
        // tool descriptions are accurate without forcing materialization.
        return materializedSandboxes.get(workspaceId)?.getInstructions?.() ?? fleet.getInstructions();
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
          // Drop the dead handle and re-run the materialization
          // pipeline — fleet's ensureSandbox walks the revival ladder
          // (reattach → checkpoint-seeded provision → fresh clone) — then
          // retry the command once. Concurrent failures coalesce onto the
          // same revival through `inflightMaterializations`.
          if (materializedSandboxes.get(workspaceId) === sandbox) {
            materializedSandboxes.delete(workspaceId);
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
        await mastra?.removeWorkspace?.(workspaceId);
      },
    );
    if (!registered) {
      throw new Error(`Factory session ${session.sessionId} was retired during workspace materialization`);
    }

    // Session start (the resolution that seeds the session's initial state)
    // warms the sandbox in the background so it materializes in parallel with
    // the model's first turn instead of on the first tool call.
    if (stateSeeded) {
      void ensureMaterialized().catch(error => {
        console.error(`[factory:workspace] background materialization for ${workspaceId} failed`, error);
      });
    }
    return workspace;
  };
}

export const getFactoryWorkspace = createWorkspaceFactory();

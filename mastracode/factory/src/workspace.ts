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
  FactorySandbox,
  SandboxStartHook,
  SkillSource,
  SkillSourceEntry,
  SkillSourceStat,
  WorkspaceSandbox,
} from '@mastra/core/workspace';
import { getFactoryAuthOrgId, getFactoryAuthUserFromContext, getFactoryAuthUserId } from './auth.js';
import type { VersionControl } from './capabilities/version-control.js';
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
  syncEnvironmentRepository,
} from './integrations/github/sandbox.js';
import {
  registerGithubPatKind,
  registerGithubRefreshTarget,
  registerGithubTokenInjector,
  registerGithubTokenInjectorResolver,
} from './integrations/github/token-refresh.js';
import { requireExec } from './sandbox/materialization.js';
import type { ExecutableSandbox } from './sandbox/materialization.js';
import {
  createEnvironmentSetupHook,
  createSessionSetupHook,
  evictSessionSandbox,
  getSessionSandbox,
  hasFailedSetupCommand,
  recordFailedSetupCommand,
  resolveSessionWorkdir,
} from './sandbox/session-sandbox.js';
import type { SessionEnvironmentGate, SessionSetupGate } from './sandbox/session-sandbox.js';
import { repositoryDirectoryName } from './sandbox/workdir.js';
import { clearSessionEnvironment, recordSessionEnvironment } from './session/environment-state-processor.js';
import type { SessionEnvironmentRepositoryState } from './session/environment-state-processor.js';
import type { FactoryProjectsStorage } from './storage/domains/projects/base.js';
import type { SourceControlSession, SourceControlStorageHandle } from './storage/domains/source-control/base.js';
import type { WorkItemsStorage } from './storage/domains/work-items/base.js';
import { parseSupervisorResourceId } from './supervisor/session.js';
import { timedPhase } from './timing.js';
import { mergeRequestNumberFromBranch, pullRequestNumberFromBranch } from './work-item-branch.js';

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
  'factory-gitlab-rereview',
  'factory-gitlab-review',
  'factory-plan',
  'factory-rereview',
  'factory-review',
  'factory-triage',
]);

/** Review skills only sessions with an active review run binding may discover or load. */
export const REVIEW_ONLY_FACTORY_SKILLS = new Set([
  'factory-gitlab-rereview',
  'factory-gitlab-review',
  'factory-rereview',
  'factory-review',
]);

/**
 * Skill caches rescanned outside the workspace resolver. The resolver records
 * which role each cache was last scanned for; a rescan it did not perform makes
 * that record untrustworthy, so the next reuse must rescan again.
 */
const rescannedOutsideResolver = new WeakMap<object, Promise<void>>();

/**
 * Rescan a session's skill cache so a role gained after the cache was built
 * (a review binding minted after the session's workspace resolved) takes effect.
 * The source still checks the live binding, so this never widens access.
 */
export async function rescanFactorySkills(skills: NonNullable<Workspace['skills']>): Promise<void> {
  // Registered so the resolver waits it out: a refresh started meanwhile would
  // join this scan (possibly for the old role) instead of starting a fresh one.
  const pending = skills.refresh();
  rescannedOutsideResolver.set(
    skills,
    pending.catch(() => {}),
  );
  await pending;
}

export class FactorySkillSource implements SkillSource {
  readonly #bundledSource = new LocalSkillSource({ basePath: BUNDLED_FACTORY_SKILLS_PATH });
  readonly #localSource: LocalSkillSource | undefined;
  readonly #fallbackSkillRoots: Set<string>;

  constructor(
    readonly fallback: SkillSource,
    fallbackSkillRoots: string[],
    localSkillsPath: string | undefined = resolveLocalFactorySkillsPath(),
    /** Evaluated per call because a session's bound role changes across stages. */
    readonly isReviewSession: () => Promise<boolean> = () => Promise.resolve(true),
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

  /** True when the path is inside a review-only skill that this session may not use. */
  async #isHiddenReviewPath(relativePath: string): Promise<boolean> {
    const skillName = relativePath.split(path.sep)[0];
    if (!skillName || !REVIEW_ONLY_FACTORY_SKILLS.has(skillName)) return false;
    return !(await this.isReviewSession());
  }

  /** Pick the layer serving this mount-relative path: local wins when it has the entry. */
  async #layerFor(relativePath: string): Promise<LocalSkillSource> {
    if (this.#localSource && (await this.#localSource.exists(relativePath))) return this.#localSource;
    return this.#bundledSource;
  }

  async exists(skillPath: string): Promise<boolean> {
    if (!this.#isFactoryPath(skillPath)) return this.fallback.exists(skillPath);
    const relative = this.#factoryPath(skillPath);
    if (await this.#isHiddenReviewPath(relative)) return false;
    if (this.#localSource && (await this.#localSource.exists(relative))) return true;
    return this.#bundledSource.exists(relative);
  }

  async stat(skillPath: string): Promise<SkillSourceStat> {
    if (!this.#isFactoryPath(skillPath)) return this.fallback.stat(skillPath);
    const relative = this.#factoryPath(skillPath);
    if (await this.#isHiddenReviewPath(relative)) throw skillSourceEnoent(skillPath);
    return (await this.#layerFor(relative)).stat(relative);
  }

  async readFile(skillPath: string): Promise<string | Buffer> {
    if (!this.#isFactoryPath(skillPath)) return this.fallback.readFile(skillPath);
    const relative = this.#factoryPath(skillPath);
    if (await this.#isHiddenReviewPath(relative)) throw skillSourceEnoent(skillPath);
    return (await this.#layerFor(relative)).readFile(relative);
  }

  async readdir(skillPath: string): Promise<SkillSourceEntry[]> {
    if (this.#isFactoryPath(skillPath)) {
      const relative = this.#factoryPath(skillPath);
      if (await this.#isHiddenReviewPath(relative)) throw skillSourceEnoent(skillPath);
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
      const entries = [...merged.values()];
      if (relative !== '' || (await this.isReviewSession())) return entries;
      return entries.filter(entry => !REVIEW_ONLY_FACTORY_SKILLS.has(entry.name));
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

function createFactorySkillExtension(isReviewSession: () => Promise<boolean>): WorkspaceSkillExtension {
  return {
    id: 'web-factory',
    paths: [FACTORY_SKILLS_MOUNT],
    createSource: (fallback, fallbackSkillRoots) =>
      new FactorySkillSource(fallback, fallbackSkillRoots, resolveLocalFactorySkillsPath(), isReviewSession),
  };
}

function isActiveReviewBinding(
  runBinding: { role: string; status: string; orgId: string } | null | undefined,
  orgId: string | undefined,
): boolean {
  return runBinding?.role === 'review' && runBinding.status === 'active' && !!orgId && runBinding.orgId === orgId;
}

type DynamicWorkspaceContext = Parameters<typeof getDynamicWorkspace>[0];

/**
 * When a session's sandbox boots: on the agent's first command (`'lazy'`, the
 * default) or as soon as the session's workspace is first resolved (`'eager'`).
 * An eager start is fire-and-forget; if it fails, the lazy path still runs.
 */
export type FactorySandboxStart = 'lazy' | 'eager';

export interface WorkspaceSourceControlProvider {
  /** Stable integration id used to select the provider-owned storage partition. */
  id: string;
  /** Provider capability used to resolve fresh repository credentials. */
  versionControl: Pick<VersionControl, 'getRepositoryAccess'>;
  /** Provider-owned source-control rows, including Factory sessions. */
  storage: SourceControlStorageHandle;
  /** Present only for GitHub, whose CLI PAT rotation has additional semantics. */
  github?: GithubIntegration;
}

export interface CreateWorkspaceFactoryOptions {
  /** The normalized factory sandbox constructing one sandbox per session. */
  sandbox?: FactorySandbox;
  /** Defaults to `'lazy'`. */
  sandboxStart?: FactorySandboxStart;
  /** Source-control providers whose repositories may back Factory sessions. */
  sourceControls?: WorkspaceSourceControlProvider[];
  /** @deprecated GitHub-only compatibility path; prefer sourceControls. */
  github?: GithubIntegration;
  /** Work-items storage used to resolve the session's run-binding role, so
   * review-board sessions get the reviewer PAT as `GH_TOKEN`. Optional —
   * without it every session uses the default (worker) PAT. */
  workItems?: Pick<WorkItemsStorage, 'findActiveRunBindingForSession'>;
  /** Projects storage used to authorize workspace-free supervisor sessions. */
  projects?: Pick<FactoryProjectsStorage, 'get'>;
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

async function resolveSourceControlSession(
  providers: WorkspaceSourceControlProvider[],
  sessionId: string,
): Promise<{ provider: WorkspaceSourceControlProvider; session: SourceControlSession } | null> {
  const matches = (
    await Promise.all(
      providers.map(async provider => ({
        provider,
        session: await provider.storage.sessions.getBySessionId(sessionId),
      })),
    )
  ).filter(
    (match): match is { provider: WorkspaceSourceControlProvider; session: SourceControlSession } =>
      match.session !== null,
  );
  if (matches.length > 1) {
    throw new Error(`Factory session ${sessionId} is ambiguous across source-control providers`);
  }
  return matches[0] ?? null;
}

/** One environment repository as the sandbox context and the boot need it, in position order. */
export interface SessionEnvironmentRepo {
  projectRepositoryId: string;
  repositoryId: string;
  slug: string;
  defaultBranch: string;
  position: number;
  setupCommand: string | undefined;
  teardownCommand: string | undefined;
}

/** The session's factory environment, resolved from the project and its `inEnvironment` links. */
export interface SessionEnvironment {
  repos: SessionEnvironmentRepo[];
  workspaceSetupCommand: string | undefined;
  /** Only an absolute root is passed on; the templates reject anything else. */
  workingDirectory: string | undefined;
  /** vCPUs and memory; null leaves the provider default (identity-bearing in the template). */
  cpuCount: number | null;
  memoryMB: number | null;
}

/**
 * Resolve the factory environment a session boots from: the project's
 * settings plus every `inEnvironment` link of the project under this
 * source-control integration, ordered by position. `undefined` when the
 * session carries no factory, the project is gone, or no link is in the
 * environment, which keeps the single-repository sandbox of the session's
 * own link. A link whose repository row is missing is skipped with a warning
 * rather than failing every start of the session.
 */
async function resolveSessionEnvironment(
  projects: Pick<FactoryProjectsStorage, 'get'> | undefined,
  storage: SourceControlStorageHandle,
  session: SourceControlSession,
): Promise<SessionEnvironment | undefined> {
  if (!projects || !session.factoryProjectId) return undefined;
  const project = await projects.get({ orgId: session.orgId, id: session.factoryProjectId });
  if (!project) return undefined;
  const links = (
    await storage.projectRepositories.listByProject({ orgId: session.orgId, factoryProjectId: project.id })
  )
    .filter(link => link.inEnvironment)
    .sort((a, b) => a.position - b.position || a.createdAt.getTime() - b.createdAt.getTime());
  const repos: SessionEnvironmentRepo[] = [];
  const directories = new Set<string>();
  for (const link of links) {
    const repository = await storage.repositories.get({ orgId: session.orgId, id: link.repositoryId });
    if (!repository) {
      console.warn('[Mastra Factory] Environment repository link has no repository row; skipping it', {
        orgId: session.orgId,
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
          orgId: session.orgId,
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
      position: link.position,
      setupCommand: link.setupCommand ?? undefined,
      teardownCommand: link.teardownCommand ?? undefined,
    });
  }
  if (repos.length === 0) return undefined;
  const workdir = project.sandboxWorkdir?.trim();
  return {
    repos,
    workspaceSetupCommand: project.workspaceSetupCommand?.trim() || undefined,
    workingDirectory: workdir?.startsWith('/') ? workdir : undefined,
    cpuCount: project.sandboxCpuCount,
    memoryMB: project.sandboxMemoryMb,
  };
}

export function createWorkspaceFactory(options: CreateWorkspaceFactoryOptions = {}) {
  const { sandbox: sandboxConfig, github, projects, workItems } = options;
  const sourceControls: WorkspaceSourceControlProvider[] =
    options.sourceControls ??
    (github
      ? [{ id: github.id, versionControl: github.versionControl, storage: github.sourceControlStorage, github }]
      : []);
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
  // Review-skill visibility last used to populate each workspace's skill cache.
  const skillCacheReviewState = new Map<string, boolean>();
  const skillCacheRefreshes = new Map<string, Promise<void>>();
  // The review check of the latest request to resolve each workspace. The skill
  // source outlives the request that built it, so it must gate on this rather
  // than on the context it was constructed with.
  const skillReviewChecks = new Map<string, () => Promise<boolean>>();

  return async ({ requestContext, mastra, skillExtension }: DynamicWorkspaceContext) => {
    const ctx = requestContext.get('controller') as AgentControllerRequestContext<MastraCodeState> | undefined;
    const supervisorProjectId = parseSupervisorResourceId(ctx?.resourceId);
    if (supervisorProjectId) {
      const orgId = getFactoryAuthOrgId(getFactoryAuthUserFromContext(requestContext));
      const project = orgId && projects ? await projects.get({ orgId, id: supervisorProjectId }) : null;
      if (!project) throw new Error(`Factory supervisor ${supervisorProjectId} is not available to the current user`);
      return undefined;
    }
    const resolvedSession = ctx?.resourceId ? await resolveSourceControlSession(sourceControls, ctx.resourceId) : null;
    const session = resolvedSession?.session ?? null;
    const sourceControl = resolvedSession?.provider;

    if (!session || !sourceControl) {
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
    if (!sandboxConfig) {
      throw new Error('A sandbox is required to create a Factory session workspace');
    }
    const factorySandbox = sandboxConfig;
    const githubProvider = sourceControl.github;

    const storage = sourceControl.storage;
    const projectRepository = session.projectRepositoryId
      ? await storage.projectRepositories.get({ orgId: session.orgId, id: session.projectRepositoryId })
      : null;
    if (!projectRepository) throw new Error(`Repository link ${session.projectRepositoryId} was not found`);
    // The remaining reads only depend on the repository link — issue them in
    // parallel instead of paying four sequential storage round-trips.
    const [connection, repository] = await Promise.all([
      storage.connections.get({ orgId: session.orgId, id: projectRepository.connectionId }),
      storage.repositories.get({ orgId: session.orgId, id: projectRepository.repositoryId }),
    ]);
    if (!connection || !repository) throw new Error(`Repository link ${session.projectRepositoryId} is incomplete`);
    const installation = await storage.installations.get({ orgId: session.orgId, id: connection.installationId });
    if (!installation) {
      throw new Error(`${sourceControl.id} installation ${connection.installationId} was not found`);
    }
    const repoFullName = repository.slug;
    if (githubProvider)
      registerGithubRefreshTarget(requestContext, { orgId: session.orgId, repositoryId: repository.id });
    // The factory environment: every `inEnvironment` link of the session's
    // factory in position order, with the project's settings. Absent when the
    // factory has none (or the session predates `factoryProjectId`), which
    // keeps the single-repository sandbox of the session's own link.
    const resolvedEnvironment = await resolveSessionEnvironment(projects, storage, session);
    // The session's own link must be part of the environment: it is the
    // checkout the PR tools and `resolveSessionWorkdir` target (D1). A session
    // whose link left the environment keeps its single-repository sandbox.
    const environment = resolvedEnvironment?.repos.some(repo => repo.projectRepositoryId === projectRepository.id)
      ? resolvedEnvironment
      : undefined;

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
    const runEnvironmentSetupOn = (target: unknown, gate: SessionEnvironmentGate) =>
      runSessionEnvironmentSetup(requireExec(target as WorkspaceSandbox), gate);
    const guardedSetup = environment
      ? createEnvironmentSetupHook(runEnvironmentSetupOn, session.id, repoFullName, {
          repos: environment.repos.map(repo => ({
            slug: repo.slug,
            ...(repo.setupCommand ? { setupCommand: repo.setupCommand } : {}),
          })),
          ...(environment.workspaceSetupCommand ? { workspaceSetupCommand: environment.workspaceSetupCommand } : {}),
        })
      : createSessionSetupHook(runSetupOn, session.id, repoFullName, projectRepository.setupCommand ?? undefined);
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
      let setupError: SetupCommandError | undefined;
      try {
        await guardedSetup(args);
      } catch (error) {
        if (!(error instanceof SetupCommandError)) throw error;
        setupError = error;
      }
      // Re-check after the (long) setup: a session retired mid-setup must not
      // register credentials for a workspace whose retirement teardown has
      // already run — the entry would leak forever. The VM itself is left to
      // the provider's idle timeout (accepted).
      if (workspaceRegistry.generation(session.sessionId) !== workspaceGeneration) {
        throw retiredError();
      }
      const target: SessionSandbox = requireExec(args.sandbox);
      // Sandbox persistence plus the post-checkout skill rescan run on every
      // start (create or reconnect). The persisted sandbox id is read back on
      // resume to reattach; the workdir was resolved (and memoized on the
      // entry) by the guarded setup. The skill roots were reported empty by the
      // unmaterialized-source guard before the checkout existed, so rescan now.
      // The physical-id write is awaited and its failure propagates: a start
      // that completes before the id is durable lets a concurrent resume read a
      // stale id and provision a replacement VM.
      const publishStartSideEffects = async () => {
        await storage.sessions.setSandbox({
          id: session.id,
          // Persist the provider's PHYSICAL, reattachable VM id so resume can
          // reattach to the same VM. Providers with no separate physical id
          // (e.g. local) fall back to the logical id, preserving prior behavior.
          sandboxId: target.sandboxId ?? target.id,
          // D2: a list session's working directory is the workspace root,
          // the repositories sit beneath it; a single-repository session
          // keeps its checkout as before.
          sandboxWorkdir: sessionWorkdir(sessionEntry.workdir) ?? '',
        });
        void constructedWorkspaces
          .get(workspaceId)
          ?.skills?.refresh()
          .catch(() => {});
      };
      const finishStart = async () => {
        await publishStartSideEffects();
        if (setupError) throw setupError;
      };
      if (!githubProvider) {
        await finishStart();
        return;
      }
      const existingRegistration = githubTokenInjectors.get(workspaceId);
      if (existingRegistration) {
        // Reconnect: re-point the current registration's injection target at
        // this (possibly provider-healed) sandbox and reinstall its
        // reconcile-owned credential. Do NOT mint a new registration, bump
        // authority, or re-register the constructing request context —
        // reconcileGithubToken owns role/generation and the active context's
        // injector, so replacing them here would reauthorize the stale
        // constructing context and reject the current one.
        existingRegistration.inject = freshToken => {
          if (!target.setEnv) {
            throw new Error('The active sandbox provider does not support runtime GitHub token refresh.');
          }
          target.setEnv(env => ({ ...env, GH_TOKEN: freshToken }));
          existingRegistration.ghToken = freshToken;
        };
        // Install through inject (not optional-chained setEnv) so a provider
        // that cannot accept the credential fails the reconnect here instead of
        // deferring the failure to a later token refresh.
        existingRegistration.inject(existingRegistration.ghToken);
        await finishStart();
        return;
      }
      // First start: resolve the credential and authorize every request that
      // resolved this pending workspace. The `gh` CLI needs a PAT when the org configured one
      // (installation tokens 403 on integration-restricted endpoints); git
      // clone/checkout keep using the minted installation token. Resolved per
      // start so the installed credential never outlives rotation.
      const patKind = await resolveGithubPatKind('default');
      const ghCliToken =
        (await getGithubPat(() => githubProvider.integrationStorage, session.orgId, patKind)) ??
        (await getRepositoryToken());
      target.setEnv?.(env => ({ ...env, GH_TOKEN: ghCliToken }));
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
      await finishStart();
    };
    const constructSessionEntry = () =>
      getSessionSandbox(session.id, repoFullName, () => {
        // Settings are the environment's stored document; segment 3 wires the
        // stored settings through, so the provider sees an empty document here.
        const sandbox = factorySandbox.create(
          {
            sessionId: session.id,
            // Physical VM id persisted from a prior start (undefined on first
            // start). Providers that reattach by physical id use it to resume the
            // original VM instead of provisioning a replacement.
            sandboxId: session.sandboxId ?? undefined,
            repoFullName,
            ...(environment
              ? {
                  // The list form of the repo templates: one entry per
                  // environment repository, each minting its own token at build
                  // time; `getRepositoryAccess` stays present but undefined, the
                  // two being mutually exclusive for the template.
                  setupCommand: undefined,
                  getRepositoryAccess: undefined,
                  repos: environment.repos.map(repo => ({
                    getRepositoryAccess: () =>
                      sourceControl.versionControl.getRepositoryAccess({
                        orgId: session.orgId,
                        repositoryId: repo.repositoryId,
                      }),
                    ...(repo.setupCommand ? { setupCommand: repo.setupCommand } : {}),
                  })),
                  ...(environment.workspaceSetupCommand
                    ? { workspaceSetupCommand: environment.workspaceSetupCommand }
                    : {}),
                  // A repository whose setup fails still lands in the image;
                  // the boot hook re-runs that setup from `setup-failed`.
                  continueOnSetupFailure: true,
                  ...(environment.workingDirectory ? { workingDirectory: environment.workingDirectory } : {}),
                }
              : {
                  // Stored nullable; the context speaks `undefined` for absent.
                  setupCommand: projectRepository.setupCommand ?? undefined,
                  // Deferred call, only dereferenced when a provider needs the repo
                  // outside the VM (template build time).
                  getRepositoryAccess: () =>
                    sourceControl.versionControl.getRepositoryAccess({
                      orgId: session.orgId,
                      repositoryId: repository.id,
                    }),
                }),
          },
          {},
        );
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
      Promise.resolve()
        .then(() => sessionEntry.sandbox.start?.())
        .catch(error => {
          console.warn(`[factory] Eager sandbox start for session ${session.id} failed:`, error);
        });
    };
    const sessionEntry = constructSessionEntry();
    // The session's working directory as the agent sees it: the workspace
    // root for an environment session (D2), the checkout otherwise.
    // `resolveSessionWorkdir` keeps pointing at the session's own repository
    // so the PR tools and the start hook run git in the right checkout.
    const sessionWorkdir = (checkout: string | undefined): string | undefined =>
      checkout === undefined ? undefined : environment ? path.posix.dirname(checkout) : checkout;
    const workdir = sessionWorkdir(sessionEntry.workdir);
    const isLocalSandbox = sessionEntry.sandbox.provider === 'local';
    // The SDK system prompt uses `state.projectPath` without falling back to
    // the server cwd. Pin the session workdir once known so the prompt and
    // workspace tools describe the same checkout. A remote workdir resolves at
    // the sandbox's first start, so the pin self-heals on the next resolution.
    if (ctx && workdir && ctx.getState()?.projectPath !== workdir) {
      await ctx.setState({ projectPath: workdir, projectName: repoFullName });
    }

    // Keyed by the session, not the request's thread: a workspace built for a
    // dispatcher kickoff has no live thread yet, but the session's binding
    // already says which role it is serving. When the request does carry a
    // thread, the binding must belong to it, so a stale thread reusing this
    // session never inherits another run's role.
    const findSessionBinding = async () => {
      const binding = await workItems!.findActiveRunBindingForSession({
        orgId: session.orgId,
        factoryProjectId: connection.factoryProjectId,
        sessionId: session.sessionId,
      });
      if (!binding || !ctx?.threadId) return binding;
      return binding.threadId === ctx.threadId && binding.resourceId === ctx.resourceId ? binding : null;
    };
    // Fails closed: without a readable active review binding, review skills stay hidden.
    const isReviewSession = async (): Promise<boolean> => {
      if (!workItems) return false;
      try {
        return isActiveReviewBinding(await findSessionBinding(), session.orgId);
      } catch {
        return false;
      }
    };
    const effectiveSkillExtension =
      skillExtension ??
      createFactorySkillExtension((): Promise<boolean> => (skillReviewChecks.get(workspaceId) ?? isReviewSession)());
    const extensionId = effectiveSkillExtension ? `-${effectiveSkillExtension.id}` : '';
    const workspaceId: string = `${WORKSPACE_ID_PREFIX}-${projectRepository.id}-${session.id}${extensionId}`;
    const workspaceGeneration = workspaceRegistry.generation(session.sessionId);
    if (!skillExtension) skillReviewChecks.set(workspaceId, isReviewSession);
    const configDir = DEFAULT_CONFIG_DIR;

    const getRepositoryAccess = () =>
      sourceControl.versionControl.getRepositoryAccess({
        orgId: session.orgId,
        repositoryId: repository.id,
      });
    const getRepositoryToken = async (): Promise<string> => {
      const token = (await getRepositoryAccess()).authorization?.token;
      if (!token) throw new Error('Repository access did not include a bearer token for the Factory session');
      return token;
    };
    const resolveGithubPatKind = async (fallback: GithubPatKind): Promise<GithubPatKind> => {
      if (!workItems) return 'default';
      try {
        return isActiveReviewBinding(await findSessionBinding(), session.orgId) ? 'reviewer' : 'default';
      } catch {
        // Preserve the installed role when binding storage is temporarily unavailable.
        return fallback;
      }
    };
    const githubTokenInjector = (registered: GithubTokenRegistration, generation: number) => (token: string) => {
      if (githubTokenInjectors.get(workspaceId) !== registered || registered.generation !== generation) {
        throw new Error('GitHub token refresh no longer matches the active Factory workspace role.');
      }
      registered.inject(token);
    };
    const registerGithubTokenContext = (registered: GithubTokenRegistration): void => {
      registerGithubTokenInjector(requestContext, githubTokenInjector(registered, registered.generation));
      registerGithubPatKind(requestContext, registered.patKind);
    };
    if (githubProvider) {
      const registered = githubTokenInjectors.get(workspaceId);
      if (registered) {
        registerGithubTokenContext(registered);
      } else {
        registerGithubTokenInjectorResolver(requestContext, () => {
          if (workspaceRegistry.generation(session.sessionId) !== workspaceGeneration) {
            throw new Error('GitHub token refresh no longer matches the active Factory workspace role.');
          }
          const active = githubTokenInjectors.get(workspaceId);
          if (!active) {
            throw new Error('GitHub token refresh requires an active Factory sandbox workspace.');
          }
          registerGithubPatKind(requestContext, active.patKind);
          return githubTokenInjector(active, 0);
        });
      }
    }
    const reconcileGithubToken = async (): Promise<void> => {
      if (!githubProvider) return;
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

          let token = await getGithubPat(() => githubProvider.integrationStorage, session.orgId, patKind);
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
            skillCacheReviewState.delete(workspaceId);
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
      // The skill cache does not recheck the source on get(), so rescan when the
      // session's role flips; otherwise a cached review skill outlives the review binding.
      if (!skillExtension) {
        // An outside rescan makes the recorded role untrustworthy. Wait for it to
        // settle first, so the refresh below starts a scan for the current role
        // rather than joining one started for the previous role.
        const consumeOutsideRescan = async () => {
          const outside = existing.skills && rescannedOutsideResolver.get(existing.skills);
          if (!outside) return false;
          await outside;
          if (rescannedOutsideResolver.get(existing.skills!) === outside)
            rescannedOutsideResolver.delete(existing.skills!);
          skillCacheReviewState.delete(workspaceId);
          return true;
        };
        await consumeOutsideRescan();
        let isReview = await isReviewSession();
        // Concurrent reuses share one refresh, and the state is recorded only
        // once the rescan succeeds. Wait out any in-flight rescan (it may have
        // been started for the opposite role) and re-read the role afterwards.
        for (;;) {
          const inFlight = skillCacheRefreshes.get(workspaceId);
          if (inFlight) {
            await inFlight;
            isReview = await isReviewSession();
            continue;
          }
          if (await consumeOutsideRescan()) {
            isReview = await isReviewSession();
            continue;
          }
          if (skillCacheReviewState.get(workspaceId) === isReview) break;
          const target = isReview;
          const pending = (async () => {
            await existing.skills?.refresh();
            skillCacheReviewState.set(workspaceId, target);
          })().finally(() => skillCacheRefreshes.delete(workspaceId));
          skillCacheRefreshes.set(workspaceId, pending);
          await pending;
          isReview = await isReviewSession();
        }
      }
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
      const access = await getRepositoryAccess();
      const token = access.authorization?.token;
      if (!token) throw new Error('Repository access did not include a bearer token for the Factory session');
      // GitHub setup commands may shell out to gh/HTTPS. Preserve its
      // role-aware PAT behavior without applying GitHub credentials to other
      // source-control providers.
      if (githubProvider) {
        const setupPatKind = await resolveGithubPatKind('default');
        const setupGhToken =
          (await getGithubPat(() => githubProvider.integrationStorage, session.orgId, setupPatKind)) ?? token;
        target.setEnv?.(env => ({ ...env, GH_TOKEN: setupGhToken }));
      }
      await materializeRepo({
        row: { id: session.id, sandboxWorkdir: workdir, materializedAt: session.materializedAt },
        repoInfo: {
          repoFullName,
          defaultBranch: repository.defaultBranch,
          cloneUrl: access.cloneUrl,
          authUsername: access.authorization?.username,
        },
        sandbox: target,
        token,
        storage: storage.sessions,
      });
      await checkoutSessionBranch(target, workdir, {
        branch: session.branch,
        baseBranch: session.baseBranch || projectRepository.branch || repository.defaultBranch,
        token,
        repoFullName,
        cloneUrl: access.cloneUrl,
        authUsername: access.authorization?.username,
        pullRequestNumber: pullRequestNumberFromBranch(session.branch),
        mergeRequestNumber: sourceControl.id === 'gitlab' ? mergeRequestNumberFromBranch(session.branch) : undefined,
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
    // The environment boot: the session's own repository keeps today's path
    // (materialize, session branch, gated setup); every other environment
    // repository is materialized beneath the workspace root, synced by the
    // conservative remote rule, and set up behind its own marker. A failure
    // on a secondary repository is logged and the boot continues, so one
    // broken link never wedges the whole environment. The workspace setup
    // command runs last, once, and is fatal like the template build.
    const runSessionEnvironmentSetup = async (target: SessionSandbox, gate: SessionEnvironmentGate): Promise<void> => {
      const repos = environment!.repos;
      const primaryDir = `${gate.root}/${repositoryDirectoryName(repoFullName)}`;
      const states: SessionEnvironmentRepositoryState[] = [];
      let primaryError: unknown;
      // Recorded whatever happens: once a repository is materialized and set
      // up, retirement must tear it down even when this boot fails later.
      const record = () =>
        recordSessionEnvironment(
          session.sessionId,
          { workingDirectory: gate.root, repositories: states },
          states.flatMap(state => {
            const command = repos.find(repo => repo.slug === state.slug)?.teardownCommand;
            return command ? [{ slug: state.slug, dir: state.dir, command }] : [];
          }),
        );
      try {
        for (const repo of repos) {
          const entry = gate.repos.find(candidate => candidate.slug === repo.slug);
          if (!entry) continue;
          const isPrimary = repo.projectRepositoryId === session.projectRepositoryId;
          const state: SessionEnvironmentRepositoryState = {
            slug: repo.slug,
            dir: entry.dir,
            branch: null,
            defaultBranch: repo.defaultBranch,
            position: repo.position,
            setupStatus: repo.setupCommand ? 'ok' : 'skipped',
          };
          states.push(state);
          if (isPrimary) {
            try {
              await runSessionSetup(target, primaryDir, entry.gate);
              state.branch = session.branch;
              if (repo.setupCommand && hasFailedSetupCommand(session.id, repo.setupCommand))
                state.setupStatus = 'failed';
            } catch (error) {
              if (!(error instanceof SetupCommandError)) throw error;
              state.branch = session.branch;
              state.setupStatus = 'failed';
              primaryError = error;
            }
            continue;
          }
          try {
            const access = await sourceControl.versionControl.getRepositoryAccess({
              orgId: session.orgId,
              repositoryId: repo.repositoryId,
            });
            const token = access.authorization?.token;
            if (!token) throw new Error(`Repository access for ${repo.slug} did not include a bearer token`);
            await materializeRepo({
              row: { id: session.id, sandboxWorkdir: entry.dir, materializedAt: null },
              repoInfo: {
                repoFullName: repo.slug,
                defaultBranch: repo.defaultBranch,
                cloneUrl: access.cloneUrl,
                authUsername: access.authorization?.username,
              },
              sandbox: target,
              token,
              // `materialized_at` is the session's own repository's.
              storage: { markMaterialized: async () => {} },
            });
            const synced = await timedPhase(`workspace.sync(${repo.slug})`, () =>
              syncEnvironmentRepository(target, entry.dir, {
                branch: session.branch,
                defaultBranch: repo.defaultBranch,
                token,
                repoFullName: repo.slug,
                cloneUrl: access.cloneUrl,
                authUsername: access.authorization?.username,
              }),
            );
            state.branch = synced.branch;
          } catch (error) {
            console.warn('[Mastra Factory] Environment repository could not be synced; continuing the boot', {
              orgId: session.orgId,
              sessionId: session.sessionId,
              projectRepositoryId: repo.projectRepositoryId,
              error: error instanceof Error ? error.message.slice(-2000) : String(error),
            });
            // The checkout may be missing or stale and its setup never ran.
            state.setupStatus = 'failed';
            continue;
          }
          if (!repo.setupCommand || entry.gate.setupDone) continue;
          if (hasFailedSetupCommand(session.id, `${repo.slug}:${repo.setupCommand}`)) {
            state.setupStatus = 'failed';
            continue;
          }
          try {
            await timedPhase(`workspace.setup(${repo.slug})`, () =>
              runSetupCommand(target, entry.dir, repo.setupCommand!),
            );
            await entry.gate.markSetupDone();
          } catch (error) {
            if (!(error instanceof SetupCommandError)) throw error;
            recordFailedSetupCommand(session.id, `${repo.slug}:${repo.setupCommand}`);
            state.setupStatus = 'failed';
            console.warn('[Mastra Factory] Environment repository setup command failed; continuing the boot', {
              orgId: session.orgId,
              sessionId: session.sessionId,
              projectRepositoryId: repo.projectRepositoryId,
              error: error.message.slice(-2000),
            });
          }
        }
        const workspaceCommand = environment!.workspaceSetupCommand;
        if (workspaceCommand && !gate.workspace.setupDone) {
          // Fatal on its first failure, skipped afterwards: like the per-repo
          // commands, a workspace command that keeps failing must not wedge
          // every start of the session.
          if (hasFailedSetupCommand(session.id, `workspace:${workspaceCommand}`)) {
            console.warn('[Mastra Factory] Skipping workspace setup command that already failed this session', {
              orgId: session.orgId,
              sessionId: session.sessionId,
            });
          } else {
            try {
              await timedPhase('workspace.setup(workspace)', () =>
                runSetupCommand(target, gate.root, workspaceCommand),
              );
              await gate.workspace.markSetupDone();
            } catch (error) {
              if (!(error instanceof SetupCommandError)) throw error;
              recordFailedSetupCommand(session.id, `workspace:${workspaceCommand}`);
              throw new SetupCommandError(
                `${error.message}. The sandbox stays usable: the workspace setup command is skipped for the rest of the session — retry your command, then fix it in the environment settings or run it manually.`,
                error.code,
              );
            }
          }
        }
      } finally {
        record();
      }
      if (primaryError) throw primaryError;
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
      workdir: async () => {
        const checkout = await resolveSessionWorkdir(session.id, sessionEntry.sandbox, repoFullName);
        return sessionWorkdir(checkout) ?? checkout;
      },
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
        skillCacheReviewState.delete(workspaceId);
        skillReviewChecks.delete(workspaceId);
        // Retirement drops the memoized session sandbox so a later re-open
        // constructs (and the provider resolves) fresh instead of reusing an
        // instance whose VM the retirement path may stop or destroy.
        evictSessionSandbox(session.id);
        clearSessionEnvironment(session.sessionId);
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

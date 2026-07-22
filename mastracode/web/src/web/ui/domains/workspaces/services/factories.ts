/**
 * Factory model — a browser-owned selectable product entity bound to either a
 * local folder or a server-backed Factory project (which owns a list of linked
 * source-control repositories).
 *
 * Factories are persisted in localStorage so they survive page reloads. The
 * factory's `resourceId` is resolved by the server from its binding using the
 * SAME logic the terminal app uses (`detectProject` + resourceId overrides), so
 * a factory opened in the TUI and in the web app map to the same session and
 * therefore the same threads. Start in the TUI, continue on the web.
 *
 * When a factory is selected, the web app creates a session scoped to that
 * resourceId and sets `projectPath` on the session state; the server-side
 * workspace factory reads it to resolve the working directory. `projectPath`
 * remains the SDK/TUI session tag for the execution workspace path.
 */

import { deleteFactoryProject, listFactoryProjects } from './github';
import type { MaterializeResult } from './github';

const STORAGE_KEY = 'mastracode-factories';

/**
 * A workspace (git worktree) inside a linked repository's sandbox. Each
 * worktree is a distinct branch checked out at its own path, created from the
 * repo's HEAD (default) branch. The repo-root checkout is never a workspace
 * itself — it only serves as the source that worktrees branch from.
 * Board-created worktrees share the factory's session resourceId (shared with
 * the TUI); their threads are partitioned per workspace by the `projectPath`
 * tag (the worktree path). User-session worktrees use the `user/` branch
 * prefix and run under the signed-in user's own resourceId.
 */
export interface Worktree {
  branch: string;
  worktreePath: string;
  baseBranch: string;
  /**
   * The single conversation held by this worktree, when known. User-session
   * worktrees always persist it (the `/user/threads/:threadId` route resolves
   * the session scope from it); board-created worktrees may leave it unset.
   */
  threadId?: string;
}

/**
 * Branch prefix that marks a worktree as a personal user session rather than
 * a board-created factory workspace. User sessions are worktrees too (branched
 * from HEAD), but they live under the user's resourceId and are listed separately.
 */
export const USER_SESSION_BRANCH_PREFIX = 'user/';

/** Whether a worktree is a personal user session (by branch prefix). */
export function isUserSessionWorktree(worktree: Worktree): boolean {
  return worktree.branch.startsWith(USER_SESSION_BRANCH_PREFIX);
}

export interface LocalFactoryBinding {
  kind: 'local';
  /** Absolute filesystem path for the local folder. */
  path: string;
  gitBranch?: string;
}

/**
 * A source-control repository linked to a server-backed Factory project.
 * `projectRepositoryId` is the server's project-repository link UUID — the
 * identity used for materialization, git operations, and intake filtering.
 */
export interface FactoryRepository {
  projectRepositoryId: string;
  /** Repository slug, e.g. `owner/name`. */
  slug: string;
  /** Branch the link tracks; the repo's default branch when unset. */
  gitBranch?: string;
  /**
   * Cloud sandbox binding, persisted after the repository is materialized so a
   * re-opened factory (e.g. after a page reload) can reattach to the same
   * sandbox without re-running the open flow first.
   */
  sandboxId?: string;
  sandboxWorkdir?: string;
  /**
   * Workspaces (git worktrees) for this repository: board feature-branch
   * worktrees plus `user/`-prefixed personal session worktrees, all branched
   * from the repo's HEAD. The repo-root checkout is never listed.
   */
  worktrees: Worktree[];
  /**
   * Currently selected board-created worktree (by worktreePath). The session
   * binds to this worktree's path + resourceId. Falls back to the first board
   * worktree when unset; no selection when the repository has no board
   * worktree yet.
   */
  selectedWorktreePath?: string;
}

/**
 * Server-backed Factory binding. `factoryProjectId` is the authoritative
 * identity (`factory_projects` row); linked repositories may be empty — a
 * Factory without repositories is a valid state (Board shows a connect
 * prompt).
 */
export interface ServerFactoryBinding {
  kind: 'factory';
  factoryProjectId: string;
  repositories: FactoryRepository[];
  /** Selected repository (by projectRepositoryId); first repo when unset. */
  selectedRepositoryId?: string;
}

export type FactoryBinding = LocalFactoryBinding | ServerFactoryBinding;

interface FactoryBase {
  /** Stable browser UUID (localStorage key). Not used for the session. */
  id: string;
  name: string;
  createdAt: number;
}

/**
 * Local factories always have a required `resourceId` because creation resolves
 * the path immediately. A local Factory without resourceId is invalid.
 */
export interface LocalFactory extends FactoryBase {
  resourceId: string;
  binding: LocalFactoryBinding;
}

/**
 * Server-backed factories may omit `resourceId` until a repository is
 * materialized on open. `Factory.id` is a browser UUID distinct from
 * `binding.factoryProjectId`.
 */
export interface ServerFactory extends FactoryBase {
  resourceId?: string;
  binding: ServerFactoryBinding;
}

export type Factory = LocalFactory | ServerFactory;

/** The resourceId used when no factory is selected. */
export const DEFAULT_RESOURCE_ID = 'web-demo-user';

export interface ResolvedCodebase {
  resourceId: string;
  name: string;
  rootPath: string;
  gitUrl?: string;
  gitBranch?: string;
}

export function isLocalFactory(factory: Factory): factory is LocalFactory {
  return factory.binding.kind === 'local';
}

export function isServerFactory(factory: Factory): factory is ServerFactory {
  return factory.binding.kind === 'factory';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object';
}

function isWorktree(value: unknown): value is Worktree {
  return (
    isRecord(value) &&
    typeof value.branch === 'string' &&
    typeof value.worktreePath === 'string' &&
    typeof value.baseBranch === 'string' &&
    (value.threadId === undefined || typeof value.threadId === 'string')
  );
}

function isLocalFactoryBinding(value: unknown): value is LocalFactoryBinding {
  return (
    isRecord(value) &&
    value.kind === 'local' &&
    typeof value.path === 'string' &&
    value.path.length > 0 &&
    (value.gitBranch === undefined || typeof value.gitBranch === 'string')
  );
}

function isFactoryRepository(value: unknown): value is FactoryRepository {
  if (
    !isRecord(value) ||
    typeof value.projectRepositoryId !== 'string' ||
    value.projectRepositoryId.length === 0 ||
    typeof value.slug !== 'string'
  ) {
    return false;
  }
  if (value.gitBranch !== undefined && typeof value.gitBranch !== 'string') return false;
  if (value.sandboxId !== undefined && typeof value.sandboxId !== 'string') return false;
  if (value.sandboxWorkdir !== undefined && typeof value.sandboxWorkdir !== 'string') return false;
  if (value.selectedWorktreePath !== undefined && typeof value.selectedWorktreePath !== 'string') return false;
  if (!Array.isArray(value.worktrees) || !value.worktrees.every(isWorktree)) return false;
  return true;
}

function isServerFactoryBinding(value: unknown): value is ServerFactoryBinding {
  if (
    !isRecord(value) ||
    value.kind !== 'factory' ||
    typeof value.factoryProjectId !== 'string' ||
    value.factoryProjectId.length === 0
  ) {
    return false;
  }
  if (value.selectedRepositoryId !== undefined && typeof value.selectedRepositoryId !== 'string') return false;
  if (!Array.isArray(value.repositories) || !value.repositories.every(isFactoryRepository)) return false;
  return true;
}

function isFactory(value: unknown): value is Factory {
  if (
    !isRecord(value) ||
    typeof value.id !== 'string' ||
    typeof value.name !== 'string' ||
    typeof value.createdAt !== 'number' ||
    !isRecord(value.binding)
  ) {
    return false;
  }

  if (isLocalFactoryBinding(value.binding)) {
    return typeof value.resourceId === 'string' && value.resourceId.length > 0;
  }

  if (isServerFactoryBinding(value.binding)) {
    return value.resourceId === undefined || typeof value.resourceId === 'string';
  }

  return false;
}

/**
 * Ask the server for the TUI-compatible resourceId (and canonical name/branch)
 * for an absolute path. Resolves TUI-compatible codebase identity.
 */
export async function resolveCodebasePath(baseUrl: string, path: string): Promise<ResolvedCodebase> {
  const res = await fetch(`${baseUrl}/web/codebase/resolve?path=${encodeURIComponent(path)}`, {
    credentials: 'include',
  });
  if (!res.ok) throw new Error(`Failed to resolve codebase (${res.status})`);
  return (await res.json()) as ResolvedCodebase;
}

export function loadFactories(): Factory[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    // Guard against non-array payloads (a stray object/string would otherwise
    // pass the cast and break consumers that call array methods). Entries that
    // fail validation (including prerelease `kind: 'github'` bindings) are
    // dropped — server hydration rebuilds server-backed factories.
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isFactory);
  } catch {
    return [];
  }
}

export function saveFactories(factories: Factory[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(factories));
}

/**
 * Load factories, rebuilding server-backed ones from the Factory project list
 * (one browser factory per project). Cached sandbox/worktree/thread metadata
 * merges by `projectRepositoryId`; repository links that no longer exist on
 * the server are dropped. When the project list is unavailable (signed out,
 * org-less, feature off) the cached list is returned unchanged so nothing is
 * wiped by a transient auth state.
 */
export async function loadFactoriesWithResolvedIds(baseUrl: string): Promise<Factory[]> {
  const cached = loadFactories();
  const projects = await listFactoryProjects(baseUrl);
  if (!projects) return cached;

  const cachedServer = new Map(
    cached.filter(isServerFactory).map(factory => [factory.binding.factoryProjectId, factory]),
  );
  const localFactories = cached.filter(isLocalFactory);
  const serverFactories = projects.map(project => {
    const existing = cachedServer.get(project.id);
    const cachedRepositories = new Map(
      (existing?.binding.repositories ?? []).map(repository => [repository.projectRepositoryId, repository]),
    );
    const repositories = project.repositories.map(link => {
      const cachedRepository = cachedRepositories.get(link.projectRepositoryId);
      const sandboxWorkdir = link.sandboxWorkdir ?? cachedRepository?.sandboxWorkdir;
      const worktrees = (cachedRepository?.worktrees ?? []).filter(
        worktree => worktree.worktreePath !== sandboxWorkdir,
      );
      const selectedWorktreePath = worktrees.some(
        worktree => worktree.worktreePath === cachedRepository?.selectedWorktreePath,
      )
        ? cachedRepository?.selectedWorktreePath
        : undefined;
      return {
        projectRepositoryId: link.projectRepositoryId,
        slug: link.slug,
        gitBranch: link.gitBranch ?? cachedRepository?.gitBranch,
        sandboxId: cachedRepository?.sandboxId,
        sandboxWorkdir,
        worktrees,
        selectedWorktreePath,
      } satisfies FactoryRepository;
    });
    const selectedRepositoryId = repositories.some(
      repository => repository.projectRepositoryId === existing?.binding.selectedRepositoryId,
    )
      ? existing?.binding.selectedRepositoryId
      : undefined;

    return {
      id: existing?.id ?? crypto.randomUUID(),
      name: project.name,
      resourceId: existing?.resourceId,
      createdAt: existing?.createdAt ?? Date.now(),
      binding: {
        kind: 'factory' as const,
        factoryProjectId: project.id,
        repositories,
        selectedRepositoryId,
      },
    } satisfies ServerFactory;
  });

  const factories = [...localFactories, ...serverFactories];
  saveFactories(factories);
  return factories;
}

/**
 * Add a factory for an absolute path. The server resolves its resourceId so it
 * lines up with the TUI; the picker-supplied name is kept if given, otherwise
 * the server's canonical codebase name is used. The selected path is stored as
 * `binding.path` (not the response-only `rootPath`).
 */
export async function addLocalFactory(baseUrl: string, name: string, path: string): Promise<LocalFactory> {
  const resolved = await resolveCodebasePath(baseUrl, path);
  const factories = loadFactories();
  const factory: LocalFactory = {
    id: crypto.randomUUID(),
    name: name.trim() || resolved.name,
    resourceId: resolved.resourceId,
    binding: {
      kind: 'local',
      path: path.trim(),
      gitBranch: resolved.gitBranch,
    },
    createdAt: Date.now(),
  };
  factories.push(factory);
  saveFactories(factories);
  return factory;
}

/**
 * Persist a browser factory for a freshly created (or newly discovered) server
 * Factory project. Starts with zero linked repositories — repositories are
 * connected afterwards. Re-adding a project that is already stored returns the
 * existing factory without replacing its browser ID.
 */
export function addServerFactory(project: { id: string; name: string }): ServerFactory {
  const factories = loadFactories();
  const existing = factories.find(
    (factory): factory is ServerFactory => isServerFactory(factory) && factory.binding.factoryProjectId === project.id,
  );
  if (existing) return existing;

  const stored: ServerFactory = {
    id: crypto.randomUUID(),
    name: project.name,
    binding: {
      kind: 'factory',
      factoryProjectId: project.id,
      repositories: [],
    },
    createdAt: Date.now(),
  };
  factories.push(stored);
  saveFactories(factories);
  return stored;
}

/**
 * Replace a stored factory in place (by id) and persist. Used to record the
 * server-resolved `resourceId` and repository sandbox bindings.
 */
export function updateFactory(factory: Factory): void {
  const factories = loadFactories().map(item => (item.id === factory.id ? factory : item));
  saveFactories(factories);
}

/**
 * The factory's currently selected repository — explicit selection when valid,
 * otherwise the first linked repository. Undefined for local factories and for
 * server factories with no linked repositories yet.
 */
export function selectedRepository(factory: Factory): FactoryRepository | undefined {
  if (!isServerFactory(factory)) return undefined;
  const { repositories, selectedRepositoryId } = factory.binding;
  if (repositories.length === 0) return undefined;
  const match = selectedRepositoryId
    ? repositories.find(repository => repository.projectRepositoryId === selectedRepositoryId)
    : undefined;
  return match ?? repositories[0];
}

/** Persist the selected repository for a factory and return the updated factory. */
export function selectRepository(factory: Factory, projectRepositoryId: string): Factory {
  if (!isServerFactory(factory)) return factory;
  const updated: ServerFactory = {
    ...factory,
    binding: {
      ...factory.binding,
      selectedRepositoryId: projectRepositoryId,
    },
  };
  updateFactory(updated);
  return updated;
}

/** Replace one repository entry (by projectRepositoryId) on a server factory. */
function withRepository(
  factory: ServerFactory,
  projectRepositoryId: string,
  update: (repository: FactoryRepository) => FactoryRepository,
): ServerFactory {
  return {
    ...factory,
    binding: {
      ...factory.binding,
      repositories: factory.binding.repositories.map(repository =>
        repository.projectRepositoryId === projectRepositoryId ? update(repository) : repository,
      ),
    },
  };
}

/**
 * Merge a server `MaterializeResult` (from the `/ensure` route) into a stored
 * server factory and persist it: records the session `resourceId` plus the
 * sandbox binding on the materialized repository. The repo-root checkout is
 * not a workspace, so no worktree is seeded — workspaces only exist once
 * created explicitly.
 */
export function applyMaterializeResult(factory: ServerFactory, result: MaterializeResult): ServerFactory {
  const updated = withRepository(
    { ...factory, resourceId: result.resourceId },
    result.projectRepositoryId,
    repository => ({
      ...repository,
      sandboxId: result.sandboxId,
      sandboxWorkdir: result.sandboxWorkdir,
    }),
  );
  updateFactory(updated);
  return updated;
}

/**
 * Every session worktree for the factory's selected repository (board
 * workspaces + user sessions). The repo-root checkout is never a workspace:
 * any entry whose path equals the sandbox workdir is filtered out.
 */
export function allFactoryWorktrees(factory: Factory): Worktree[] {
  const repository = selectedRepository(factory);
  if (!repository) return [];
  // Drop legacy repo-root entries (default branch at the sandbox workdir).
  return repository.worktrees.filter(worktree => worktree.worktreePath !== repository.sandboxWorkdir);
}

/** Board-created factory session workspaces only (excludes `user/` personal sessions). */
export function boardSessionWorktrees(factory: Factory): Worktree[] {
  return allFactoryWorktrees(factory).filter(worktree => !isUserSessionWorktree(worktree));
}

/** Personal user-session worktrees only (`user/` branch prefix). */
export function userSessionWorktrees(factory: Factory): Worktree[] {
  return allFactoryWorktrees(factory).filter(isUserSessionWorktree);
}

/**
 * Resolve the user-session worktree that holds the given thread, searching
 * every repository of every stored factory. Used by the `/user/threads/:threadId`
 * route to rebind the user-scoped session (resourceId = user id, scope =
 * worktree path) on deep links and reloads.
 */
export function findUserSessionByThreadId(
  threadId: string,
): { factory: Factory; repository: FactoryRepository; worktree: Worktree } | undefined {
  for (const factory of loadFactories()) {
    if (!isServerFactory(factory)) continue;
    for (const repository of factory.binding.repositories) {
      const worktree = repository.worktrees.find(item => isUserSessionWorktree(item) && item.threadId === threadId);
      if (worktree) return { factory, repository, worktree };
    }
  }
  return undefined;
}

/**
 * The currently selected board workspace of the selected repository, falling
 * back to the first one. User-session worktrees are never the factory
 * selection — they are opened through their own routes. Undefined when the
 * repository has no board workspace yet (nothing to chat in until one is
 * created).
 */
export function selectedWorktree(factory: Factory): Worktree | undefined {
  const repository = selectedRepository(factory);
  if (!repository) return undefined;
  const list = boardSessionWorktrees(factory);
  if (list.length === 0) return undefined;
  const match = repository.selectedWorktreePath
    ? list.find(worktree => worktree.worktreePath === repository.selectedWorktreePath)
    : undefined;
  return match ?? list[0];
}

export function activeWorkspacePath(factory: Factory, userSession?: Worktree): string | undefined {
  if (userSession) return userSession.worktreePath;
  if (isServerFactory(factory)) return selectedWorktree(factory)?.worktreePath;
  return factory.binding.path;
}

/**
 * Append (or update) a worktree on the factory's selected repository and
 * persist. De-duped by branch. Returns the updated factory. Does NOT change
 * the selection.
 */
export function upsertWorktree(factory: Factory, worktree: Worktree): Factory {
  const repository = selectedRepository(factory);
  if (!isServerFactory(factory) || !repository) return factory;
  const updated = withRepository(factory, repository.projectRepositoryId, current => ({
    ...current,
    worktrees: [...current.worktrees.filter(item => item.branch !== worktree.branch), worktree],
  }));
  updateFactory(updated);
  return updated;
}

/**
 * Remove a worktree from the factory's selected repository and persist. If the
 * removed worktree was selected, selection falls back to the first remaining
 * board workspace (or none — the repo root is not a workspace). Returns the
 * updated factory.
 */
export function removeWorktree(factory: Factory, worktreePath: string): Factory {
  const repository = selectedRepository(factory);
  if (!isServerFactory(factory) || !repository) return factory;
  const remaining = repository.worktrees.filter(worktree => worktree.worktreePath !== worktreePath);
  const fallback = remaining.find(worktree => !isUserSessionWorktree(worktree))?.worktreePath;
  const updated = withRepository(factory, repository.projectRepositoryId, current => ({
    ...current,
    worktrees: remaining,
    selectedWorktreePath: current.selectedWorktreePath === worktreePath ? fallback : current.selectedWorktreePath,
  }));
  updateFactory(updated);
  return updated;
}

/** Persist the selected worktree for the factory's selected repository. */
export function selectWorktree(factory: Factory, worktreePath: string): Factory {
  const repository = selectedRepository(factory);
  if (!isServerFactory(factory) || !repository) return factory;
  const updated = withRepository(factory, repository.projectRepositoryId, current => ({
    ...current,
    selectedWorktreePath: worktreePath,
  }));
  updateFactory(updated);
  return updated;
}

export async function removeFactory(baseUrl: string, id: string): Promise<void> {
  const existing = loadFactories().find(factory => factory.id === id);
  if (existing && isServerFactory(existing)) {
    await deleteFactoryProject(baseUrl, existing.binding.factoryProjectId);
  }
  const factories = loadFactories().filter(factory => factory.id !== id);
  saveFactories(factories);
}

/**
 * Factory model — a browser-owned selectable product entity bound to either a
 * local folder or a connected GitHub repository.
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

import { deleteConnectedRepository, listConnectedRepositories } from './github';

const STORAGE_KEY = 'mastracode-factories';
const ACTIVE_KEY = 'mastracode-active-factory';

/**
 * A workspace (git worktree) inside a GitHub factory's sandbox. Each worktree
 * is a distinct branch checked out at its own path, created from the repo's
 * HEAD (default) branch. The repo-root checkout is never a workspace itself —
 * it only serves as the source that worktrees branch from. Board-created
 * worktrees share the factory's session resourceId (shared with the TUI); their
 * threads are partitioned per workspace by the `projectPath` tag (the worktree
 * path). User-session worktrees use the `user/` branch prefix and run under the
 * signed-in user's own resourceId.
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

export interface GithubFactoryBinding {
  kind: 'github';
  /**
   * Server-side GitHub repository row id from `source_control_projects`. This is the
   * provider-specific repository binding identity — not the browser Factory id.
   */
  githubProjectId: string;
  /**
   * Optional default/feature branch preserved from persistence or materialization.
   * Not invented from picker input.
   */
  gitBranch?: string;
  /**
   * Cloud sandbox binding for a GitHub factory, persisted after the repo is
   * materialized so a re-opened factory (e.g. after a page reload) can reattach
   * to the same sandbox without re-running the open flow first.
   */
  sandboxId?: string;
  sandboxWorkdir?: string;
  /**
   * Workspaces (git worktrees) for a GitHub factory: board feature-branch
   * worktrees plus `user/`-prefixed personal session worktrees, all branched
   * from the repo's HEAD. The repo-root checkout is never listed.
   */
  worktrees: Worktree[];
  /**
   * Currently selected board-created worktree for a GitHub factory (by
   * worktreePath). The session binds to this worktree's path + resourceId.
   * Falls back to the first board worktree when unset; no selection when the
   * factory has no board worktree yet.
   */
  selectedWorktreePath?: string;
}

export type FactoryBinding = LocalFactoryBinding | GithubFactoryBinding;

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
 * GitHub factories receive `resourceId` from their persisted source-control row.
 * Legacy cached entries may omit it until the next backend hydration.
 * `Factory.id` is always a browser UUID distinct from `binding.githubProjectId`.
 */
export interface GithubFactory extends FactoryBase {
  resourceId?: string;
  binding: GithubFactoryBinding;
}

export type Factory = LocalFactory | GithubFactory;

/** Transport DTO returned by the connected-repository routes. */
export interface GithubConnectedRepositoryPayload {
  id: string;
  name: string;
  source: 'github';
  githubProjectId: string;
  resourceId?: string;
  gitBranch?: string;
  sandboxId?: string;
  sandboxWorkdir?: string;
  worktrees?: Worktree[];
  createdAt?: number;
}

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

export function isGithubFactory(factory: Factory): factory is GithubFactory {
  return factory.binding.kind === 'github';
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

function isGithubFactoryBinding(value: unknown): value is GithubFactoryBinding {
  if (
    !isRecord(value) ||
    value.kind !== 'github' ||
    typeof value.githubProjectId !== 'string' ||
    value.githubProjectId.length === 0
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

  if (isGithubFactoryBinding(value.binding)) {
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
    // pass the cast and break consumers that call array methods).
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
 * Load local factories from the browser and hydrate GitHub factories from the
 * source-control backend. Browser-only identity, thread bindings, and the
 * selected worktree are retained only while their backend rows still exist.
 */
export async function loadFactoriesWithResolvedIds(baseUrl: string): Promise<Factory[]> {
  const cachedFactories = loadFactories();
  const localFactories = cachedFactories.filter(isLocalFactory);
  const cachedGithubFactories = new Map(
    cachedFactories.filter(isGithubFactory).map(factory => [factory.binding.githubProjectId, factory]),
  );
  const repositories = await listConnectedRepositories(baseUrl);
  const githubFactories = repositories.map(repository => {
    const cached = cachedGithubFactories.get(repository.githubProjectId);
    const backendWorktrees = (repository.worktrees ?? []).filter(
      worktree => worktree.worktreePath !== repository.sandboxWorkdir,
    );
    const cachedWorktrees = new Map(cached?.binding.worktrees.map(worktree => [worktree.branch, worktree]));
    const selectedWorktreePath = backendWorktrees.some(
      worktree => worktree.worktreePath === cached?.binding.selectedWorktreePath,
    )
      ? cached?.binding.selectedWorktreePath
      : undefined;

    return {
      id: cached?.id ?? crypto.randomUUID(),
      name: repository.name,
      resourceId: repository.resourceId,
      createdAt: repository.createdAt ?? cached?.createdAt ?? Date.now(),
      binding: {
        kind: 'github' as const,
        githubProjectId: repository.githubProjectId,
        gitBranch: repository.gitBranch,
        sandboxId: repository.sandboxId,
        sandboxWorkdir: repository.sandboxWorkdir,
        selectedWorktreePath,
        worktrees: backendWorktrees.map(worktree => ({
          ...worktree,
          threadId: cachedWorktrees.get(worktree.branch)?.threadId,
        })),
      },
    } satisfies GithubFactory;
  });
  const factories = [...localFactories, ...githubFactories];
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
 * Persist a factory created from a GitHub repo. The server already created the
 * `source_control_projects` row and returns a temporary DTO whose `id`/`githubProjectId`
 * are the repository UUID. The browser always generates a new Factory.id and
 * copies the repository UUID only onto `binding.githubProjectId`. Reconnecting
 * the same repository returns the existing Factory without replacing its browser
 * ID. The `resourceId` comes from the persisted source-control row; connecting
 * the repository does not provision a sandbox or clone it.
 */
export function addGithubFactory(payload: GithubConnectedRepositoryPayload): GithubFactory {
  const factories = loadFactories();
  const existing = factories.find(
    (factory): factory is GithubFactory =>
      isGithubFactory(factory) && factory.binding.githubProjectId === payload.githubProjectId,
  );
  if (existing) return existing;

  const stored: GithubFactory = {
    id: crypto.randomUUID(),
    name: payload.name,
    resourceId: payload.resourceId,
    binding: {
      kind: 'github',
      githubProjectId: payload.githubProjectId,
      gitBranch: payload.gitBranch,
      sandboxId: payload.sandboxId,
      sandboxWorkdir: payload.sandboxWorkdir,
      worktrees: payload.worktrees ?? [],
    },
    createdAt: payload.createdAt ?? Date.now(),
  };
  factories.push(stored);
  saveFactories(factories);
  return stored;
}

/** Replace a stored factory in place (by id) and persist. */
export function updateFactory(factory: Factory): void {
  const factories = loadFactories().map(item => (item.id === factory.id ? factory : item));
  saveFactories(factories);
}

/**
 * Every session worktree for a factory (board workspaces + user sessions).
 * The repo-root checkout is never a workspace: any entry whose path equals the
 * sandbox workdir is filtered out.
 */
export function allFactoryWorktrees(factory: Factory): Worktree[] {
  if (!isGithubFactory(factory)) return [];
  const persisted = factory.binding.worktrees;
  if (persisted.length === 0) return [];
  // Drop legacy repo-root entries (default branch at the sandbox workdir).
  return persisted.filter(worktree => worktree.worktreePath !== factory.binding.sandboxWorkdir);
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
 * every stored factory. Used by the `/user/threads/:threadId` route to rebind
 * the user-scoped session (resourceId = user id, scope = worktree path) on
 * deep links and reloads.
 */
export function findUserSessionByThreadId(threadId: string): { factory: Factory; worktree: Worktree } | undefined {
  for (const factory of loadFactories()) {
    const worktree = userSessionWorktrees(factory).find(item => item.threadId === threadId);
    if (worktree) return { factory, worktree };
  }
  return undefined;
}

/**
 * The currently selected board workspace, falling back to the first one.
 * User-session worktrees are never the factory selection — they are opened
 * through their own routes. Undefined when the factory has no board
 * workspace yet (nothing to chat in until one is created).
 */
export function selectedWorktree(factory: Factory): Worktree | undefined {
  if (!isGithubFactory(factory)) return undefined;
  const list = boardSessionWorktrees(factory);
  if (list.length === 0) return undefined;
  const match = factory.binding.selectedWorktreePath
    ? list.find(worktree => worktree.worktreePath === factory.binding.selectedWorktreePath)
    : undefined;
  return match ?? list[0];
}

export function activeWorkspacePath(factory: Factory, userSession?: Worktree): string | undefined {
  if (userSession) return userSession.worktreePath;
  if (isGithubFactory(factory)) return selectedWorktree(factory)?.worktreePath;
  return factory.binding.path;
}

/**
 * Append (or update) a worktree on a factory and persist. De-duped by branch.
 * Returns the updated factory. Does NOT change the selection.
 */
export function upsertWorktree(factory: Factory, worktree: Worktree): Factory {
  if (!isGithubFactory(factory)) return factory;
  const existing = allFactoryWorktrees(factory);
  const without = existing.filter(item => item.branch !== worktree.branch);
  const updated: GithubFactory = {
    ...factory,
    binding: {
      ...factory.binding,
      worktrees: [...without, worktree],
    },
  };
  updateFactory(updated);
  return updated;
}

/**
 * Remove a worktree from a factory and persist. If the removed worktree was
 * selected, selection falls back to the first remaining board workspace (or
 * none — the repo root is not a workspace). Returns the updated factory.
 */
export function removeWorktree(factory: Factory, worktreePath: string): Factory {
  if (!isGithubFactory(factory)) return factory;
  const remaining = allFactoryWorktrees(factory).filter(worktree => worktree.worktreePath !== worktreePath);
  const fallback = remaining.find(worktree => !isUserSessionWorktree(worktree))?.worktreePath;
  const updated: GithubFactory = {
    ...factory,
    binding: {
      ...factory.binding,
      worktrees: remaining,
      selectedWorktreePath:
        factory.binding.selectedWorktreePath === worktreePath ? fallback : factory.binding.selectedWorktreePath,
    },
  };
  updateFactory(updated);
  return updated;
}

/** Persist the selected worktree for a factory and return the updated factory. */
export function selectWorktree(factory: Factory, worktreePath: string): Factory {
  if (!isGithubFactory(factory)) return factory;
  const updated: GithubFactory = {
    ...factory,
    binding: {
      ...factory.binding,
      selectedWorktreePath: worktreePath,
    },
  };
  updateFactory(updated);
  return updated;
}

export async function removeFactory(baseUrl: string, id: string): Promise<void> {
  const existing = loadFactories().find(factory => factory.id === id);
  if (existing && isGithubFactory(existing)) {
    await deleteConnectedRepository(baseUrl, existing.binding.githubProjectId);
  }
  const factories = loadFactories().filter(factory => factory.id !== id);
  saveFactories(factories);
  if (loadActiveFactoryId() === id) clearActiveFactoryId();
}

/**
 * The id of the factory that was active when the app was last used. Restored on
 * reload so the session reconnects (and its threads reappear) without the user
 * having to re-select the factory.
 */
export function loadActiveFactoryId(): string | null {
  try {
    return localStorage.getItem(ACTIVE_KEY);
  } catch {
    return null;
  }
}

export function saveActiveFactoryId(id: string | null): void {
  try {
    if (id) localStorage.setItem(ACTIVE_KEY, id);
    else localStorage.removeItem(ACTIVE_KEY);
  } catch {
    /* ignore */
  }
}

function clearActiveFactoryId(): void {
  saveActiveFactoryId(null);
}

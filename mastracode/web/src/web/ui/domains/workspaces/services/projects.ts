/**
 * Project model — a named binding to a filesystem path.
 *
 * Projects are persisted in localStorage so they survive page reloads. The
 * project's `resourceId` is resolved by the server from its path using the SAME
 * logic the terminal app uses (`detectProject` + resourceId overrides), so a
 * project opened in the TUI and in the web app map to the same session and
 * therefore the same threads. Start in the TUI, continue on the web.
 *
 * When a project is selected, the web app creates a session scoped to that
 * resourceId and sets `projectPath` on the session state; the server-side
 * workspace factory reads it to resolve the working directory.
 */

import type { MaterializeResult } from './github';

const STORAGE_KEY = 'mastracode-projects';
const ACTIVE_KEY = 'mastracode-active-project';

/**
 * A workspace (git worktree) inside a GitHub project's sandbox. Each worktree
 * is a distinct branch checked out at its own path, created from the repo's
 * HEAD (default) branch. The repo-root checkout is never a workspace itself —
 * it only serves as the source that worktrees branch from. Factory worktrees
 * share the project's session resourceId (shared with the TUI); their threads
 * are partitioned per workspace by the `projectPath` tag (the worktree path).
 * User-session worktrees use the `user/` branch prefix and run under the
 * signed-in user's own resourceId.
 */
export interface Worktree {
  branch: string;
  worktreePath: string;
  baseBranch: string;
  /**
   * The single conversation held by this worktree, when known. User-session
   * worktrees always persist it (the `/user/threads/:threadId` route resolves
   * the session scope from it); factory worktrees may leave it unset.
   */
  threadId?: string;
}

/**
 * Branch prefix that marks a worktree as a personal user session rather than
 * a factory workspace. User sessions are worktrees too (branched from HEAD),
 * but they live under the user's resourceId and are listed separately.
 */
export const USER_SESSION_BRANCH_PREFIX = 'user/';

/** Whether a worktree is a personal user session (by branch prefix). */
export function isUserSessionWorktree(worktree: Worktree): boolean {
  return worktree.branch.startsWith(USER_SESSION_BRANCH_PREFIX);
}

export interface Project {
  /** Stable local id (localStorage key). Not used for the session. */
  id: string;
  name: string;
  /** Absolute filesystem path for local projects. Absent for GitHub projects. */
  path?: string;
  /**
   * Project source. Absent (legacy) is treated as `local`. GitHub projects are
   * materialized into a cloud sandbox on open rather than resolved from a path.
   */
  source?: 'local' | 'github';
  /** Server-side GitHub project id; present only when `source === 'github'`. */
  githubProjectId?: string;
  /**
   * Cloud sandbox binding for a GitHub project, persisted after the repo is
   * materialized so a re-opened project (e.g. after a page reload) can reattach
   * to the same sandbox without re-running the open flow first.
   */
  sandboxId?: string;
  sandboxWorkdir?: string;
  /**
   * Workspaces (git worktrees) for a GitHub project: factory feature-branch
   * worktrees created via "New workspace" plus `user/`-prefixed personal
   * session worktrees, all branched from the repo's HEAD. The repo-root
   * checkout is never listed. Absent/empty for local projects.
   */
  worktrees?: Worktree[];
  /**
   * Currently selected factory worktree for a GitHub project (by
   * worktreePath). The session binds to this worktree's path + resourceId.
   * Falls back to the first factory worktree when unset; no selection when
   * the project has no factory worktree yet.
   */
  selectedWorktreePath?: string;
  /**
   * Active feature branch + worktree for a GitHub project, persisted after a
   * worktree is created so a re-opened project rebinds the same worktree
   * workspace (the agent edits the worktree path, not the repo root).
   *
   * @deprecated Superseded by `worktrees` + `selectedWorktreePath`; retained so
   * projects persisted by older builds keep working until migrated on open.
   */
  activeBranch?: string;
  activeWorktreePath?: string;
  /**
   * Server-resolved resourceId (TUI-compatible). May be absent on projects
   * created before this field existed; `ensureResourceId` backfills it.
   */
  resourceId?: string;
  gitBranch?: string;
  createdAt: number;
}

/** The resourceId used when no project is selected. */
export const DEFAULT_RESOURCE_ID = 'web-demo-user';

interface ResolvedProject {
  resourceId: string;
  name: string;
  rootPath: string;
  gitUrl?: string;
  gitBranch?: string;
}

/**
 * Ask the server for the TUI-compatible resourceId (and canonical name/branch)
 * for an absolute path.
 */
export async function resolveProjectPath(baseUrl: string, path: string): Promise<ResolvedProject> {
  const res = await fetch(`${baseUrl}/web/project/resolve?path=${encodeURIComponent(path)}`, {
    credentials: 'include',
  });
  if (!res.ok) throw new Error(`Failed to resolve project (${res.status})`);
  return (await res.json()) as ResolvedProject;
}

export function loadProjects(): Project[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    // Guard against non-array payloads (a stray object/string would otherwise
    // pass the cast and break consumers that call array methods).
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (p): p is Project =>
        !!p &&
        typeof p === 'object' &&
        typeof (p as Project).id === 'string' &&
        // Local projects carry a path; GitHub projects carry a githubProjectId.
        (typeof (p as Project).path === 'string' || typeof (p as Project).githubProjectId === 'string'),
    );
  } catch {
    return [];
  }
}

export function saveProjects(projects: Project[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(projects));
}

export async function loadProjectsWithResolvedIds(baseUrl: string): Promise<Project[]> {
  const projects = loadProjects();
  const resolvedProjects = await Promise.all(
    projects.map(async project => {
      if (project.resourceId || !project.path) return project;
      try {
        const resolved = await resolveProjectPath(baseUrl, project.path);
        return { ...project, resourceId: resolved.resourceId, gitBranch: resolved.gitBranch };
      } catch {
        return project;
      }
    }),
  );

  if (resolvedProjects.some((project, index) => project !== projects[index])) {
    saveProjects(resolvedProjects);
  }

  return resolvedProjects;
}

/**
 * Add a project for an absolute path. The server resolves its resourceId so it
 * lines up with the TUI; the picker-supplied name is kept if given, otherwise
 * the server's canonical project name is used.
 */
export async function addProject(baseUrl: string, name: string, path: string): Promise<Project> {
  const resolved = await resolveProjectPath(baseUrl, path);
  const projects = loadProjects();
  const project: Project = {
    id: crypto.randomUUID(),
    name: name.trim() || resolved.name,
    path: path.trim(),
    resourceId: resolved.resourceId,
    gitBranch: resolved.gitBranch,
    createdAt: Date.now(),
  };
  projects.push(project);
  saveProjects(projects);
  return project;
}

/**
 * Persist a project created from a GitHub repo. The server already created the
 * `github_projects` row and returned a `Project`-shaped payload; we just store
 * it locally (de-duped by `githubProjectId`) so it shows up in the project list.
 * The `resourceId` is filled in later, on open, by `ensureRepoMaterialized`.
 */
export function addGithubProject(project: Project): Project {
  const projects = loadProjects();
  const existing = projects.find(p => p.githubProjectId && p.githubProjectId === project.githubProjectId);
  if (existing) return existing;
  const stored: Project = { ...project, source: 'github', createdAt: project.createdAt ?? Date.now() };
  projects.push(stored);
  saveProjects(projects);
  return stored;
}

/**
 * Replace a stored project in place (by id) and persist. Used to record the
 * server-resolved `resourceId` for a GitHub project once it's materialized.
 */
export function updateProject(project: Project): void {
  const projects = loadProjects().map(p => (p.id === project.id ? project : p));
  saveProjects(projects);
}

/**
 * Merge a server `MaterializeResult` (from the `/ensure` route) into a stored
 * GitHub project and persist it: records the session `resourceId` plus the
 * sandbox binding. The repo-root checkout is not a workspace, so no worktree
 * is seeded — workspaces only exist once created explicitly.
 */
export function applyMaterializeResult(project: Project, result: MaterializeResult): Project {
  const updated: Project = {
    ...project,
    resourceId: result.resourceId,
    sandboxId: result.sandboxId,
    sandboxWorkdir: result.sandboxWorkdir,
  };
  updateProject(updated);
  return updated;
}

/**
 * Every session worktree for a project (factory workspaces + user sessions).
 * The repo-root checkout is never a workspace: legacy projects that persisted
 * it as their first worktree get it filtered out here, and a pre-`worktrees`
 * project with an `activeBranch` gets that folded in.
 */
export function projectWorktrees(project: Project): Worktree[] {
  if (project.source !== 'github') return [];
  const persisted = project.worktrees ?? [];
  if (persisted.length > 0) {
    // Drop legacy repo-root entries (default branch at the sandbox workdir).
    return persisted.filter(w => w.worktreePath !== project.sandboxWorkdir);
  }

  // Migrate legacy shape: fold in the previously persisted active feature
  // worktree if one existed. No root entry — HEAD is not a workspace.
  const rootBranch = project.gitBranch ?? 'main';
  if (project.activeBranch && project.activeWorktreePath && project.activeBranch !== rootBranch) {
    return [{ branch: project.activeBranch, worktreePath: project.activeWorktreePath, baseBranch: rootBranch }];
  }
  return [];
}

/** Factory workspaces only (excludes `user/` personal-session worktrees). */
export function factoryWorktrees(project: Project): Worktree[] {
  return projectWorktrees(project).filter(w => !isUserSessionWorktree(w));
}

/** Personal user-session worktrees only (`user/` branch prefix). */
export function userSessionWorktrees(project: Project): Worktree[] {
  return projectWorktrees(project).filter(isUserSessionWorktree);
}

/**
 * Resolve the user-session worktree that holds the given thread, searching
 * every stored project. Used by the `/user/threads/:threadId` route to rebind
 * the user-scoped session (resourceId = user id, scope = worktree path) on
 * deep links and reloads.
 */
export function findUserSessionByThreadId(threadId: string): { project: Project; worktree: Worktree } | undefined {
  for (const project of loadProjects()) {
    const worktree = userSessionWorktrees(project).find(w => w.threadId === threadId);
    if (worktree) return { project, worktree };
  }
  return undefined;
}

/**
 * The currently selected factory workspace, falling back to the first one.
 * User-session worktrees are never the project selection — they are opened
 * through their own routes. Undefined when the project has no factory
 * workspace yet (nothing to chat in until one is created).
 */
export function selectedWorktree(project: Project): Worktree | undefined {
  const list = factoryWorktrees(project);
  if (list.length === 0) return undefined;
  const match = project.selectedWorktreePath
    ? list.find(w => w.worktreePath === project.selectedWorktreePath)
    : undefined;
  return match ?? list[0];
}

export function activeWorkspacePath(project: Project, userSession?: Worktree): string | undefined {
  if (userSession) return userSession.worktreePath;
  if (project.source === 'github') return selectedWorktree(project)?.worktreePath;
  return project.path;
}

/**
 * Append (or update) a worktree on a project and persist. De-duped by branch.
 * Returns the updated project. Does NOT change the selection.
 */
export function upsertWorktree(project: Project, worktree: Worktree): Project {
  const existing = projectWorktrees(project);
  const without = existing.filter(w => w.branch !== worktree.branch);
  const updated: Project = { ...project, worktrees: [...without, worktree] };
  updateProject(updated);
  return updated;
}

/**
 * Remove a worktree from a project and persist. If the removed worktree was
 * selected, selection falls back to the first remaining factory workspace (or
 * none — the repo root is not a workspace). Returns the updated project.
 */
export function removeWorktree(project: Project, worktreePath: string): Project {
  const remaining = projectWorktrees(project).filter(w => w.worktreePath !== worktreePath);
  const fallback = remaining.find(w => !isUserSessionWorktree(w))?.worktreePath;
  const updated: Project = {
    ...project,
    worktrees: remaining,
    selectedWorktreePath: project.selectedWorktreePath === worktreePath ? fallback : project.selectedWorktreePath,
  };
  updateProject(updated);
  return updated;
}

/** Persist the selected worktree for a project and return the updated project. */
export function selectWorktree(project: Project, worktreePath: string): Project {
  const updated: Project = { ...project, selectedWorktreePath: worktreePath };
  updateProject(updated);
  return updated;
}

/**
 * Return a project guaranteed to have a `resourceId`, resolving + persisting it
 * if a legacy project predates the field. The session resourceId always comes
 * from the server so it matches the TUI.
 */
export async function ensureResourceId(baseUrl: string, project: Project): Promise<Project> {
  if (project.resourceId) return project;
  if (!project.path) throw new Error('Cannot resolve a resourceId for a project without a path');
  const resolved = await resolveProjectPath(baseUrl, project.path);
  const updated: Project = { ...project, resourceId: resolved.resourceId, gitBranch: resolved.gitBranch };
  const projects = loadProjects().map(p => (p.id === project.id ? updated : p));
  saveProjects(projects);
  return updated;
}

export function removeProject(id: string): void {
  const projects = loadProjects().filter(p => p.id !== id);
  saveProjects(projects);
  if (loadActiveProjectId() === id) clearActiveProjectId();
}

/**
 * The id of the project that was active when the app was last used. Restored on
 * reload so the session reconnects (and its threads reappear) without the user
 * having to re-select the project.
 */
export function loadActiveProjectId(): string | null {
  try {
    return localStorage.getItem(ACTIVE_KEY);
  } catch {
    return null;
  }
}

export function saveActiveProjectId(id: string | null): void {
  try {
    if (id) localStorage.setItem(ACTIVE_KEY, id);
    else localStorage.removeItem(ACTIVE_KEY);
  } catch {
    /* ignore */
  }
}

function clearActiveProjectId(): void {
  saveActiveProjectId(null);
}

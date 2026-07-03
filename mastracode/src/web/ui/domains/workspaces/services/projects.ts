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

const STORAGE_KEY = 'mastracode-projects';
const ACTIVE_KEY = 'mastracode-active-project';

/**
 * A workspace (git worktree) inside a GitHub project's sandbox. Each worktree
 * is a distinct branch checked out at its own path. A repo's worktrees share
 * one session resourceId (and that id is shared with the TUI); their threads
 * are partitioned per workspace by the `projectPath` tag (the worktree path).
 * The project root is itself the first worktree (the default branch);
 * additional ones are created via "New workspace".
 */
export interface Worktree {
  branch: string;
  worktreePath: string;
  baseBranch: string;
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
   * Workspaces (git worktrees) for a GitHub project. The first entry is the
   * repo root on its default branch; additional entries are feature-branch
   * worktrees created via "New workspace". Each carries its own resourceId so
   * its threads are isolated. Absent/empty for local projects.
   */
  worktrees?: Worktree[];
  /**
   * Currently selected worktree for a GitHub project (by worktreePath). The
   * session binds to this worktree's path + resourceId. Falls back to the repo
   * root when unset.
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
export async function resolveProjectPath(path: string): Promise<ResolvedProject> {
  const res = await fetch(`/api/web/project/resolve?path=${encodeURIComponent(path)}`);
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

/**
 * Add a project for an absolute path. The server resolves its resourceId so it
 * lines up with the TUI; the picker-supplied name is kept if given, otherwise
 * the server's canonical project name is used.
 */
export async function addProject(name: string, path: string): Promise<Project> {
  const resolved = await resolveProjectPath(path);
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
 * The worktree list for a project, normalizing legacy projects: a GitHub
 * project always has at least the repo-root worktree (its default branch), and
 * a pre-`worktrees` project with an `activeBranch` gets that folded in.
 */
export function projectWorktrees(project: Project): Worktree[] {
  if (project.source !== 'github') return [];
  if (project.worktrees && project.worktrees.length > 0) return project.worktrees;

  // Migrate legacy shape: synthesize the root worktree, plus the previously
  // persisted active feature worktree if one existed.
  const rootBranch = project.gitBranch ?? 'main';
  const rootPath = project.sandboxWorkdir ?? '';
  const list: Worktree[] = [{ branch: rootBranch, worktreePath: rootPath, baseBranch: rootBranch }];
  if (project.activeBranch && project.activeWorktreePath && project.activeBranch !== rootBranch) {
    list.push({
      branch: project.activeBranch,
      worktreePath: project.activeWorktreePath,
      baseBranch: rootBranch,
    });
  }
  return list;
}

/** The currently selected worktree for a project, or the repo root by default. */
export function selectedWorktree(project: Project): Worktree | undefined {
  const list = projectWorktrees(project);
  if (list.length === 0) return undefined;
  const match = project.selectedWorktreePath
    ? list.find(w => w.worktreePath === project.selectedWorktreePath)
    : undefined;
  return match ?? list[0];
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
export async function ensureResourceId(project: Project): Promise<Project> {
  if (project.resourceId) return project;
  if (!project.path) throw new Error('Cannot resolve a resourceId for a project without a path');
  const resolved = await resolveProjectPath(project.path);
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

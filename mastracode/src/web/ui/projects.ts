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

import { getWebGitCloneDirectoryName, getWebGitRepoName, normalizeWebGitUrl } from '../git-clone-context';

const STORAGE_KEY = 'mastracode-projects';
const ACTIVE_KEY = 'mastracode-active-project';

export interface Project {
  /** Stable local id (localStorage key). Not used for the session. */
  id: string;
  name: string;
  path: string;
  source?: 'local' | 'git';
  gitUrl?: string;
  cloneParentPath?: string;
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
        typeof (p as Project).path === 'string' &&
        ((p as Project).source !== 'git' || typeof (p as Project).gitUrl === 'string'),
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
    source: 'local',
    resourceId: resolved.resourceId,
    gitBranch: resolved.gitBranch,
    createdAt: Date.now(),
  };
  projects.push(project);
  saveProjects(projects);
  return project;
}

function shortHash(value: string): string {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = Math.imul(31, hash) + value.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
}

function joinPath(parentPath: string, childName: string): string {
  const trimmed = parentPath.trim().replace(/[\\/]+$/, '');
  if (!trimmed) throw new Error('Clone location is required');
  return `${trimmed}/${childName}`;
}

export function addGitProject(gitUrl: string, cloneParentPath: string): Project {
  const normalizedGitUrl = normalizeWebGitUrl(gitUrl);
  const normalizedCloneParentPath = cloneParentPath.trim();
  if (!normalizedCloneParentPath) throw new Error('Choose where to clone the repository');

  const name = getWebGitRepoName(normalizedGitUrl);
  const resourceId = `${
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'repository'
  }-${shortHash(normalizedGitUrl)}`;
  const projects = loadProjects();
  const project: Project = {
    id: crypto.randomUUID(),
    name,
    path: joinPath(normalizedCloneParentPath, getWebGitCloneDirectoryName(normalizedGitUrl)),
    source: 'git',
    gitUrl: normalizedGitUrl,
    cloneParentPath: normalizedCloneParentPath,
    resourceId,
    createdAt: Date.now(),
  };
  projects.push(project);
  saveProjects(projects);
  return project;
}

/**
 * Return a project guaranteed to have a `resourceId`, resolving + persisting it
 * if a legacy project predates the field. The session resourceId always comes
 * from the server so it matches the TUI.
 */
export async function ensureResourceId(project: Project): Promise<Project> {
  if (project.resourceId) return project;
  if (project.source === 'git' && project.gitUrl) {
    const cloneParentPath = project.cloneParentPath || project.path;
    const updated = addGitProject(project.gitUrl, cloneParentPath);
    removeProject(project.id);
    return updated;
  }
  const resolved = await resolveProjectPath(project.path);
  const updated: Project = {
    ...project,
    source: 'local',
    resourceId: resolved.resourceId,
    gitBranch: resolved.gitBranch,
  };
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

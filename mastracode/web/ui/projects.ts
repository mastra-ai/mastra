/**
 * Project model — a named binding to a filesystem path.
 *
 * Projects are persisted in localStorage so they survive page reloads.
 * When a project is selected, the web app creates a session scoped to that
 * project (resourceId = `project-{id}`), so threads belong to their project.
 * The session state gets `projectPath` set, and the server-side workspace
 * factory reads it to resolve the correct directory.
 */

const STORAGE_KEY = 'mastracode-projects';

export interface Project {
  id: string;
  name: string;
  path: string;
  createdAt: number;
}

/** The resourceId used when no project is selected. */
export const DEFAULT_RESOURCE_ID = 'web-demo-user';

/** Derive the session resourceId for a project. */
export function projectResourceId(project: Project): string {
  return `project-${project.id}`;
}

export function loadProjects(): Project[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as Project[];
  } catch {
    return [];
  }
}

export function saveProjects(projects: Project[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(projects));
}

export function addProject(name: string, path: string): Project {
  const projects = loadProjects();
  const project: Project = {
    id: crypto.randomUUID(),
    name: name.trim(),
    path: path.trim(),
    createdAt: Date.now(),
  };
  projects.push(project);
  saveProjects(projects);
  return project;
}

export function removeProject(id: string): void {
  const projects = loadProjects().filter(p => p.id !== id);
  saveProjects(projects);
}

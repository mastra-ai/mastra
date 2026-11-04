import { loadProjectConfig } from '../studio/project-config.js';
import type { Project } from './platform-api.js';
import { fetchProjects } from './platform-api.js';

/**
 * Resolve the target project for env-group commands without requiring a
 * positional argument. Resolution order: `--project` flag, `MASTRA_PROJECT_ID`
 * env var, then the `.mastra-project.json` written by `mastra deploy` in the
 * current directory. An explicit flag beats the environment so a command can
 * target another project from a shell that exports `MASTRA_PROJECT_ID`.
 */
export async function resolveProject(token: string, orgId: string, projectArg?: string): Promise<Project> {
  const projects = await fetchProjects(token, orgId);

  const wanted = projectArg ?? process.env.MASTRA_PROJECT_ID;
  if (wanted) {
    const project = projects.find(proj => proj.id === wanted || proj.name === wanted || proj.slug === wanted);
    if (!project) {
      throw new Error(`Project not found: ${wanted}`);
    }
    return project;
  }

  const config = await loadProjectConfig(process.cwd());
  if (config?.projectId) {
    const project = projects.find(proj => proj.id === config.projectId);
    if (project) return project;
  }

  throw new Error(
    'No project specified. Pass --project <name|slug|id>, set MASTRA_PROJECT_ID, or run from a directory with a linked .mastra-project.json.',
  );
}

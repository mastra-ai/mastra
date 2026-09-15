import path from 'node:path';

const DEV_RUNTIME_SEGMENT = `${path.sep}src${path.sep}mastra${path.sep}public`;
const BUILD_RUNTIME_SEGMENT = `${path.sep}.mastra${path.sep}output`;

/**
 * Resolve the generated project root even when `mastra dev` / `mastra start`
 * run with cwd under `src/mastra/public` or `.mastra/output`.
 */
export function getProjectRoot(env: NodeJS.ProcessEnv = process.env, cwd: string = process.cwd()): string {
  const fromEnv = env.MASTRA_PROJECT_ROOT?.trim();
  if (fromEnv) {
    return path.resolve(fromEnv);
  }

  const devIndex = cwd.indexOf(DEV_RUNTIME_SEGMENT);
  if (devIndex !== -1) {
    return cwd.slice(0, devIndex);
  }

  const buildIndex = cwd.indexOf(BUILD_RUNTIME_SEGMENT);
  if (buildIndex !== -1) {
    return cwd.slice(0, buildIndex);
  }

  return cwd;
}

/**
 * Absolute path to the project-level `workspace/` directory (or `WORKSPACE_PATH`).
 */
export function getWorkspacePath(env: NodeJS.ProcessEnv = process.env, cwd: string = process.cwd()): string {
  const configured = env.WORKSPACE_PATH?.trim() || 'workspace';
  if (path.isAbsolute(configured)) {
    return path.resolve(configured);
  }
  return path.resolve(getProjectRoot(env, cwd), configured);
}

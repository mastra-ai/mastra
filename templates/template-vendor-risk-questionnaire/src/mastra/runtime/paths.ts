import { basename, dirname, resolve } from 'node:path';

export function resolveProjectRoot(env: NodeJS.ProcessEnv = process.env, cwd = process.cwd()) {
  let projectRoot = resolve(env.MASTRA_PROJECT_ROOT || cwd);
  // Mastra dev supplies the .mastra build directory; start supplies the project directory.
  if (env.MASTRA_DEV === 'true' && basename(projectRoot) === '.mastra') projectRoot = dirname(projectRoot);
  return projectRoot;
}

export function resolveRuntimeRoot(env: NodeJS.ProcessEnv = process.env, cwd = process.cwd()) {
  return resolve(resolveProjectRoot(env, cwd), '.runtime');
}

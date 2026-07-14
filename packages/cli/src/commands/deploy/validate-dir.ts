import { stat } from 'node:fs/promises';

/**
 * Guard against `mastra deploy staging` silently deploying to production.
 *
 * The deploy signature is `deploy [dir]`, but the rest of the surface teaches
 * positional environments (`env restart staging`, `env db create staging`),
 * so users type `mastra deploy staging` expecting to target that environment.
 * The positional is consumed as a directory, falls back to cwd semantics, and
 * the deploy targets production. Fail fast when the directory doesn't exist
 * and point at `--env` when the argument looks like an environment name.
 */
export async function assertDeployDir(dirArg: string | undefined, resolvedDir: string): Promise<void> {
  if (!dirArg) return;

  const stats = await stat(resolvedDir).catch(() => null);
  if (stats?.isDirectory()) return;

  const looksLikeEnvName = !dirArg.includes('/') && !dirArg.includes('\\') && !dirArg.startsWith('.');
  const hint = looksLikeEnvName ? ` Did you mean: mastra deploy --env ${dirArg}` : '';
  throw new Error(`Directory not found: ${dirArg}.${hint}`);
}

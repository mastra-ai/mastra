import { promisify } from 'node:util';

type ExecFileAsync = (
  file: string,
  args: readonly string[],
  options?: { env?: NodeJS.ProcessEnv },
) => Promise<{ stdout: string }>;

// Lazy-init execFileAsync to avoid vitest mock issues when only
// constants/types are imported from a module that pulls this in.
let execFileAsync: ExecFileAsync | undefined;

/** Environment variables both gitcrawl and the `gh` CLI treat as a GitHub credential. */
const GITHUB_TOKEN_ENV_VARS = ['GH_TOKEN', 'GITHUB_TOKEN'] as const;

/**
 * Resolve a GitHub credential from the global `gh` CLI and return an environment
 * that presents it to a child process.
 *
 * gitcrawl takes the first non-empty value of the environment variable named by
 * `[github].token_env` (default `GITHUB_TOKEN`) and only discovers it is invalid
 * when GitHub rejects it, so a stale exported token fails `sync` outright even
 * when `gh` can still mint a working credential. Injecting a credential here
 * makes gitcrawl's own env lookup win, so the stale value is never consulted.
 *
 * `gh auth token` is asked with the token variables removed: `gh` answers with
 * `GH_TOKEN`/`GITHUB_TOKEN` verbatim when either is set, which would hand back
 * the very credential being replaced.
 *
 * Returns `undefined` when no credential can be resolved, so callers leave the
 * inherited environment untouched rather than stripping a working token.
 */
export async function resolveGithubAuthEnv(): Promise<NodeJS.ProcessEnv | undefined> {
  const scrubbed: NodeJS.ProcessEnv = { ...process.env };
  for (const name of GITHUB_TOKEN_ENV_VARS) delete scrubbed[name];

  if (!execFileAsync) {
    const { execFile } = await import('node:child_process');
    execFileAsync = promisify(execFile) as ExecFileAsync;
  }

  let token: string;
  try {
    const { stdout } = await execFileAsync('gh', ['auth', 'token'], { env: scrubbed });
    token = stdout.trim();
  } catch {
    return undefined;
  }
  if (!token) return undefined;

  // Both names are set: gitcrawl reads the configured one (`GITHUB_TOKEN` by
  // default) while `gh` itself, including gitcrawl's fallback to `gh auth token`,
  // reads `GH_TOKEN` first.
  return { ...process.env, GH_TOKEN: token, GITHUB_TOKEN: token };
}

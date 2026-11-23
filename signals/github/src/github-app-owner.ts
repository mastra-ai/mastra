import { promisify } from 'node:util';

import { resolveGithubAuthEnv } from './github-auth-env.js';

export type GithubAppOwner = {
  login: string;
  type: 'User' | 'Organization';
};

export type GithubAppOwnerCommandRunner = (args: readonly string[]) => Promise<{ stdout: string }>;

type CachedGithubAppOwner = {
  owner: GithubAppOwner;
  expiresAt: number;
};

const OWNER_CACHE_TTL_MS = 24 * 60 * 60 * 1000;

type ExecFileAsync = (
  file: string,
  args: readonly string[],
  options?: { env?: NodeJS.ProcessEnv },
) => Promise<{ stdout: string }>;
let execFileAsync: ExecFileAsync | undefined;

const defaultRunGhApi: GithubAppOwnerCommandRunner = async args => {
  if (!execFileAsync) {
    const { execFile } = await import('node:child_process');
    execFileAsync = promisify(execFile) as ExecFileAsync;
  }

  return execFileAsync!('gh', args, { env: await resolveGithubAuthEnv() });
};

export class GithubAppOwnerResolver {
  readonly #cache = new Map<string, CachedGithubAppOwner>();
  readonly #runGhApi: GithubAppOwnerCommandRunner;

  constructor(runGhApi: GithubAppOwnerCommandRunner = defaultRunGhApi) {
    this.#runGhApi = runGhApi;
  }

  /**
   * `onLookupFailure` is called when GitHub could not be asked (network, auth, rate limit), so the
   * caller can retry later instead of treating the bot as unauthorized. An app GitHub reports as
   * not found is a real answer and does not call it.
   */
  async getOwner(
    botLogin: string,
    isCurrentGeneration?: () => boolean,
    onLookupFailure?: () => void,
  ): Promise<GithubAppOwner | undefined> {
    const appSlug = botLogin.replace(/\[bot\]$/i, '');
    if (!appSlug || (isCurrentGeneration && !isCurrentGeneration())) return undefined;

    const cacheKey = appSlug.toLowerCase();
    const cached = this.#cache.get(cacheKey);
    if (cached?.expiresAt && cached.expiresAt > Date.now()) {
      if (isCurrentGeneration && !isCurrentGeneration()) return undefined;
      return cached.owner;
    }
    if (cached) this.#cache.delete(cacheKey);

    try {
      const { stdout } = await this.#runGhApi(['api', `apps/${appSlug}`]);
      const parsed: unknown = JSON.parse(stdout);
      const owner = this.#parseOwner(parsed);
      if (!owner || (isCurrentGeneration && !isCurrentGeneration())) return undefined;

      this.#cache.set(cacheKey, { owner, expiresAt: Date.now() + OWNER_CACHE_TTL_MS });
      if (isCurrentGeneration && !isCurrentGeneration()) {
        this.#cache.delete(cacheKey);
        return undefined;
      }
      return owner;
    } catch (error) {
      if (!isNotFoundError(error)) onLookupFailure?.();
      return undefined;
    }
  }

  #parseOwner(value: unknown): GithubAppOwner | undefined {
    if (!value || typeof value !== 'object' || !('owner' in value)) return undefined;
    const owner = value.owner;
    if (!owner || typeof owner !== 'object' || !('login' in owner) || !('type' in owner)) return undefined;
    if (typeof owner.login !== 'string' || !owner.login.trim()) return undefined;
    if (owner.type !== 'User' && owner.type !== 'Organization') return undefined;

    return { login: owner.login, type: owner.type };
  }
}

function isNotFoundError(error: unknown): boolean {
  const details = error && typeof error === 'object' ? error : {};
  const text = ['message', 'stderr', 'stdout']
    .map(key => (key in details ? String((details as Record<string, unknown>)[key] ?? '') : ''))
    .join('\n');
  return /\bHTTP 404\b|\bNot Found\b/i.test(text);
}

import { homedir } from 'node:os';
import { join } from 'node:path';
import { FactorySandbox, LocalSandbox } from '@mastra/core/workspace';
import type { FactorySandboxContext } from '@mastra/core/workspace';

export interface LocalFactorySandboxOptions {
  /**
   * Directory under which every session gets its own working directory.
   * Defaults to `MASTRACODE_LOCAL_SANDBOX_ROOT`, else `~/.mastracode/web/sandboxes`.
   */
  root?: string;
  /**
   * Environment for commands run in the sandbox. Defaults to an allow-list of
   * host variables that keep git and TLS working (HOME, USER, SHELL, locale,
   * SSL_CERT_*, …), so app secrets never reach commands run against untrusted
   * repository checkouts. PATH is always added by LocalSandbox itself.
   *
   * A function receives each session's context, so a credential can go to one
   * factory's sessions only: `ctx => (ctx.factoryId === id ? { TOKEN } : {})`.
   */
  env?: Record<string, string> | ((ctx: FactorySandboxContext) => Record<string, string>);
}

const HOST_ENV_KEYS = [
  'HOME',
  'USER',
  'LOGNAME',
  'SHELL',
  'TMPDIR',
  'LANG',
  'LC_ALL',
  'TERM',
  'TZ',
  'GIT_EXEC_PATH',
  'GIT_TEMPLATE_DIR',
  'SSL_CERT_FILE',
  'SSL_CERT_DIR',
] as const;

function hostEnv(): Record<string, string> {
  const env: Record<string, string> = {};
  for (const key of HOST_ENV_KEYS) {
    const value = process.env[key];
    if (value) env[key] = value;
  }
  return env;
}

/**
 * Sessions run on the host machine: each session's sandbox is a LocalSandbox
 * rooted at `join(root, sessionId)`, where the repository checks out as a
 * subdirectory. No template and no user-tunable settings.
 */
export class LocalFactorySandbox extends FactorySandbox<Record<string, never>> {
  readonly provider = 'local';

  readonly #root: string;
  readonly #env: NonNullable<LocalFactorySandboxOptions['env']>;

  constructor(options: LocalFactorySandboxOptions = {}) {
    super();
    this.#root =
      options.root ??
      (process.env.MASTRACODE_LOCAL_SANDBOX_ROOT?.trim() || join(homedir(), '.mastracode', 'web', 'sandboxes'));
    this.#env = options.env ?? hostEnv();
  }

  create(ctx: FactorySandboxContext): LocalSandbox {
    return new LocalSandbox({
      id: ctx.sessionId,
      timeout: 30_000,
      workingDirectory: join(this.#root, ctx.sessionId),
      env: typeof this.#env === 'function' ? this.#env(ctx) : this.#env,
    });
  }
}

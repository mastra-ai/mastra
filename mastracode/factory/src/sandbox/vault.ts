/**
 * How Factory may authenticate GitHub inside a sandbox.
 *
 * - `token`: the sandbox receives a GitHub token (env, credential helper,
 *   per-command auth header), as every non-vault sandbox always has.
 * - `vault`: the platform provisioned the sandbox in credential-vault mode. Its
 *   git rewrites github.com to the vault and the vault adds the real
 *   credential to each request, so the sandbox must never hold a real token.
 *
 * The mode comes only from the provider object, which the platform's responses
 * set. Never from the sandbox env (`SANDBOX_VAULT`): code inside the sandbox
 * can change its own env, and must not be able to talk Factory into handing
 * it a token.
 */
export type SandboxGithubAuth = 'token' | 'vault';

type VaultReportingSandbox = { vault?: boolean; refreshVault?: () => Promise<unknown> };

/**
 * Read a sandbox's GitHub auth mode. Only a platform that reported
 * `vault: true` makes a vault sandbox: platforms that support vault mode always
 * report it for vault sandboxes, and older ones never report it at all.
 */
export function sandboxGithubAuth(sandbox: object): SandboxGithubAuth {
  return (sandbox as VaultReportingSandbox).vault === true ? 'vault' : 'token';
}

/**
 * Read the mode, first asking the platform when the provider has not recorded
 * one yet. A failed request rejects rather than falling back to token mode,
 * since it cannot tell a vault sandbox apart.
 */
export async function learnSandboxGithubAuth(sandbox: object): Promise<SandboxGithubAuth> {
  const reporting = sandbox as VaultReportingSandbox;
  if ('vault' in sandbox && reporting.vault === undefined && typeof reporting.refreshVault === 'function') {
    await reporting.refreshVault();
  }
  return sandboxGithubAuth(sandbox);
}

/** True when Factory may put a real GitHub token into the sandbox. */
export function sandboxAcceptsGithubToken(sandbox: object): boolean {
  return sandboxGithubAuth(sandbox) === 'token';
}

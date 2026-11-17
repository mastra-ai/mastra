/**
 * How Factory may authenticate GitHub inside a sandbox.
 *
 * - `token`: the sandbox receives a GitHub token (env, credential helper,
 *   per-command auth header), as every non-vault sandbox always has.
 * - `vault`: the platform provisioned the sandbox in credential-vault mode. Its
 *   git rewrites github.com to the vault and the vault adds the real
 *   credential to each request, so the sandbox must never hold a real token.
 * - `unknown`: a platform sandbox whose provision, reattach or get response
 *   did not say. Factory fails closed and treats it like a vault sandbox: no
 *   real token goes in.
 *
 * The mode comes only from the provider object, which the platform's responses
 * set. Never from the sandbox env (`SANDBOX_VAULT`): code inside the sandbox
 * can change its own env, and must not be able to talk Factory into handing
 * it a token.
 */
export type SandboxGithubAuth = 'token' | 'vault' | 'unknown';

type VaultReportingSandbox = { vault?: boolean };

const warnedUnknown = new WeakSet<object>();

/**
 * Read a sandbox's GitHub auth mode. Providers without a `vault` property
 * (local sandboxes, test doubles) are never vault sandboxes. A provider that
 * declares it but leaves it unset does not know the mode.
 */
export function sandboxGithubAuth(sandbox: object): SandboxGithubAuth {
  if (!('vault' in sandbox)) return 'token';
  const vault = (sandbox as VaultReportingSandbox).vault;
  if (vault === true) return 'vault';
  if (vault === false) return 'token';
  if (!warnedUnknown.has(sandbox)) {
    warnedUnknown.add(sandbox);
    console.warn(
      '[factory] The platform did not report whether this sandbox runs in credential-vault mode; ' +
        'withholding GitHub tokens from it. Git and gh in the sandbox cannot authenticate until it is reprovisioned.',
    );
  }
  return 'unknown';
}

/** True when Factory may put a real GitHub token into the sandbox. */
export function sandboxAcceptsGithubToken(sandbox: object): boolean {
  return sandboxGithubAuth(sandbox) === 'token';
}

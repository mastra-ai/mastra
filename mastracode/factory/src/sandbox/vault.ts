import type { FactorySandbox } from '@mastra/core/workspace';
import { isFactoryPrincipalId } from '../storage/domains/projects/base.js';
import type { SourceControlSession } from '../storage/domains/source-control/base.js';
import { sandboxHostMayUseCredentialVault } from './vault-host.js';

/** Card sessions delegate only to their durably recorded human starter. */
export function sessionSandboxUser(session: { userId?: string; sandboxUserId?: string | null }): string | undefined {
  if (session.sandboxUserId !== undefined) return session.sandboxUserId ?? undefined;
  return session.userId && !isFactoryPrincipalId(session.userId) ? session.userId : undefined;
}

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
 * one yet. Optional discovery failures preserve prior Factory behavior;
 * Platform's per-command credential guard still requires a confirmed token VM.
 */
export async function learnSandboxGithubAuth(sandbox: object): Promise<SandboxGithubAuth> {
  const reporting = sandbox as VaultReportingSandbox;
  if ('vault' in sandbox && reporting.vault === undefined && typeof reporting.refreshVault === 'function') {
    try {
      await reporting.refreshVault();
    } catch {
      // Only a positive provider report changes the prior token behavior.
    }
  }
  return sandboxGithubAuth(sandbox);
}

/** True when Factory may put a real GitHub token into the sandbox. */
export function sandboxAcceptsGithubToken(sandbox: object): boolean {
  return sandboxGithubAuth(sandbox) === 'token';
}

/**
 * The user each session sandbox was built for. A vault sandbox carries that
 * user's credential for its whole life, so the owner-only rule compares callers
 * with this user, not with the session's current owner: after a takeover, the
 * instance built for the previous owner refuses the new one until it is
 * released, whatever order the takeover runs in.
 */
const sandboxOwners = new WeakMap<object, string | null>();

/** Record the user a session sandbox is built for (`FactorySandboxContext.userId`). */
export function bindSandboxOwner(sandbox: object, ownerId: string | null | undefined): void {
  sandboxOwners.set(sandbox, ownerId ?? null);
}

/** The user the sandbox was built for, or `fallback` for one built elsewhere. */
export function sandboxOwner(sandbox: object, fallback: string | null | undefined): string | null | undefined {
  return sandboxOwners.has(sandbox) ? sandboxOwners.get(sandbox) : fallback;
}

/**
 * Refuse `callerId` a credential-vault sandbox bound to its owner (the user it
 * was built for, else `ownerId`). For a host that may use Vault, only a
 * confirmed token-mode response permits another caller. Discovery never starts
 * the sandbox: unknown mode or a failed read cannot grant access to its owner.
 */
export async function assertVaultSandboxCaller(
  sandbox: object,
  {
    ownerId,
    callerId,
    sessionId,
    requireKnownMode = false,
    mayUseCredentialVault = sandboxHostMayUseCredentialVault((sandbox as { provider?: string }).provider ?? 'custom'),
  }: {
    ownerId: string | null | undefined;
    callerId: string | undefined;
    sessionId: string;
    requireKnownMode?: boolean;
    mayUseCredentialVault?: boolean;
  },
): Promise<void> {
  const isOwner = callerId !== undefined && callerId === sandboxOwner(sandbox, ownerId);
  if ((!mayUseCredentialVault && !('vault' in sandbox)) || (isOwner && !requireKnownMode)) return;
  const reporting = sandbox as VaultReportingSandbox;
  if (reporting.vault === undefined && typeof reporting.refreshVault === 'function') {
    try {
      await reporting.refreshVault();
    } catch {
      // A failed read is not permission to use another user's sandbox.
    }
  }
  if (!isOwner && reporting.vault !== false) throw vaultOwnerRefusal(sessionId);
  if (requireKnownMode && reporting.vault === undefined) {
    throw new Error(
      `Factory session ${sessionId} sandbox credential mode is unavailable; retry when Platform is reachable`,
    );
  }
}

export function vaultOwnerRefusal(sessionId: string): Error {
  return new Error(
    `Factory session ${sessionId} uses its owner's credential vault and is not available to the current user`,
  );
}

/** Discover legacy VM mode without starting a VM or changing its credential actor. */
export async function sessionSandboxCredentialMode(
  session: SourceControlSession,
  provider?: FactorySandbox,
): Promise<SandboxGithubAuth | null> {
  if (session.sandboxCredentialMode) return session.sandboxCredentialMode;
  if (!session.sandboxId || !provider) return null;
  const sandbox = provider.create(
    {
      sessionId: session.id,
      sandboxId: session.sandboxId,
      userId: sessionSandboxUser(session),
      getRepositoryAccess: undefined,
    },
    {},
  ) as VaultReportingSandbox;
  try {
    await sandbox.refreshVault?.();
  } catch {
    return null;
  }
  if (sandbox.vault === undefined) return null;
  const mode = sandbox.vault ? 'vault' : 'token';
  return mode;
}

import type { GitHubAppCallbackResult } from '../components/GitHubAppCallbackHandler';

export interface GithubCallbackRecovery {
  /** A Mastra Platform page where the refusal is fixed first: the organization's accounts, or Platform itself. */
  platformPage?: 'accounts' | 'home';
  /**
   * What picks the fix up here: a status refresh, a new GitHub connect, or signing in to Factory with another
   * account when this one can't link GitHub at all.
   */
  next: 'refresh' | 'connect' | 'sign_out';
}

/** The way out of a refusal Mastra Platform's GitHub App callback reported. */
export function githubCallbackRecovery(code: string | undefined): GithubCallbackRecovery {
  // Refresh accounts links the older install in Platform; a refresh here then sees it.
  if (code === 'github_app_installation_preexisting') return { platformPage: 'accounts', next: 'refresh' };
  // Disconnecting the other GitHub account in Platform links nothing; only a new connect does.
  if (code === 'github_app_connection_mismatch') return { platformPage: 'home', next: 'connect' };
  // Platform needs its own session in this browser before a new connect can link anything.
  if (code === 'github_app_sign_in_required') return { platformPage: 'home', next: 'connect' };
  // Only a Mastra account links GitHub through Platform; connecting again as this one fails the same way.
  if (code === 'github_app_person_not_platform_user') return { next: 'sign_out' };
  // An already-used link usually means the install went through.
  if (code === 'github_app_link_already_used') return { next: 'refresh' };
  return { next: 'connect' };
}

/**
 * Whether the result waits on access granted elsewhere (an approval, Platform's Refresh accounts), so new
 * repositories listing means it has landed and its notice is moot.
 */
export function githubCallbackAwaitsAccess(callback: GitHubAppCallbackResult | undefined): boolean {
  if (callback?.kind === 'requested') return true;
  return callback?.kind === 'error' && githubCallbackRecovery(callback.code).next === 'refresh';
}

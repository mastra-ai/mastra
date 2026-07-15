/**
 * GitHub App client helpers.
 *
 * Wraps `@octokit/rest` + `@octokit/auth-app` to authenticate as the GitHub
 * App (app JWT) and as a specific installation (installation access token).
 * Also builds the user-facing install / OAuth-identify URLs.
 *
 * The feature is enabled only when the GitHub App env vars are present. The
 * server additionally requires web auth to be on (a per-user installation needs
 * a logged-in user); that combined check lives in `./config`.
 */

import { createAppAuth } from '@octokit/auth-app';
import { Octokit } from '@octokit/rest';

export interface GithubAppConfig {
  appId: string;
  privateKey: string;
  clientId: string;
  clientSecret: string;
  slug: string;
}

/**
 * Normalize a PEM private key supplied via env. Env tooling tends to mangle
 * multi-line PEMs, so two single-line forms are supported:
 *   - `\n`-escaped: literal `\n` sequences become real newlines
 *   - fully flattened: newlines stripped entirely — the PEM is rebuilt by
 *     re-wrapping the base64 body (Node's decoder rejects header/body/footer
 *     on one line with `error:1E08010C:DECODER routines::unsupported`)
 */
export function normalizePrivateKey(raw: string): string {
  const key = raw.replace(/\\n/g, '\n');
  if (key.includes('\n')) return key;
  const flattened = key.trim().match(/^(-----BEGIN [A-Z0-9 ]+-----)\s*(.+?)\s*(-----END [A-Z0-9 ]+-----)$/);
  if (!flattened) return key;
  const body = flattened[2]!.replace(/\s+/g, '');
  return `${flattened[1]}\n${body.match(/.{1,64}/g)!.join('\n')}\n${flattened[3]}\n`;
}

/** Required GitHub App env var names (non-secret names only). */
const GITHUB_APP_ENV_VARS = [
  'GITHUB_APP_ID',
  'GITHUB_APP_PRIVATE_KEY',
  'GITHUB_APP_CLIENT_ID',
  'GITHUB_APP_CLIENT_SECRET',
  'GITHUB_APP_SLUG',
] as const;

/**
 * Names of required GitHub App env vars that are not set. Exposed so logs and
 * status diagnostics can say *which* gate is missing instead of only
 * `enabled:false`. Only env var *names* are returned — never values.
 */
export function getMissingGithubAppEnvVars(): string[] {
  return GITHUB_APP_ENV_VARS.filter(name => !process.env[name]);
}

/**
 * Read the GitHub App config from env, or `undefined` when not fully configured.
 */
export function getGithubAppConfig(): GithubAppConfig | undefined {
  const appId = process.env.GITHUB_APP_ID;
  const privateKey = process.env.GITHUB_APP_PRIVATE_KEY;
  const clientId = process.env.GITHUB_APP_CLIENT_ID;
  const clientSecret = process.env.GITHUB_APP_CLIENT_SECRET;
  const slug = process.env.GITHUB_APP_SLUG;
  if (!appId || !privateKey || !clientId || !clientSecret || !slug) {
    return undefined;
  }
  return { appId, privateKey: normalizePrivateKey(privateKey), clientId, clientSecret, slug };
}

/**
 * True when all GitHub App env vars are present. Note this does *not* check web
 * auth; the server-level gate (`isGithubFeatureEnabled`) combines both.
 */
export function isGithubAppConfigured(): boolean {
  return getMissingGithubAppEnvVars().length === 0;
}

function requireConfig(): GithubAppConfig {
  const config = getGithubAppConfig();
  if (!config) {
    throw new Error('GitHub App is not configured (missing GITHUB_APP_* env vars).');
  }
  return config;
}

/**
 * Octokit authenticated as the GitHub App itself (app JWT). Used for
 * app-level operations and to mint installation tokens.
 */
export function getAppOctokit(): Octokit {
  const config = requireConfig();
  return new Octokit({
    authStrategy: createAppAuth,
    auth: {
      appId: config.appId,
      privateKey: config.privateKey,
      clientId: config.clientId,
      clientSecret: config.clientSecret,
    },
  });
}

/**
 * Octokit authenticated as a specific installation (installation access token).
 * Used to list repos and to operate on a repo on the user's behalf.
 */
export function getInstallationOctokit(installationId: number): Octokit {
  const config = requireConfig();
  return new Octokit({
    authStrategy: createAppAuth,
    auth: {
      appId: config.appId,
      privateKey: config.privateKey,
      clientId: config.clientId,
      clientSecret: config.clientSecret,
      installationId,
    },
  });
}

/**
 * Octokit authenticated as a user via their OAuth token (the identify step).
 */
export function getUserOctokit(userToken: string): Octokit {
  return new Octokit({ auth: userToken });
}

/**
 * Mint a short-lived installation access token. Returned token is used only
 * server-side / inside the sandbox clone URL and never sent to the browser.
 */
export async function mintInstallationToken(installationId: number): Promise<string> {
  const config = requireConfig();
  const auth = createAppAuth({
    appId: config.appId,
    privateKey: config.privateKey,
    clientId: config.clientId,
    clientSecret: config.clientSecret,
  });
  const installationAuth = await auth({ type: 'installation', installationId });
  return installationAuth.token;
}

export interface UserInstallation {
  installationId: number;
  accountLogin: string | null;
  accountType: string | null;
}

/**
 * List the installations the authenticated user can access, via their OAuth
 * token (`GET /user/installations`).
 */
export async function listUserInstallations(userToken: string): Promise<UserInstallation[]> {
  const octokit = getUserOctokit(userToken);
  const installations = await octokit.paginate(octokit.apps.listInstallationsForAuthenticatedUser, {
    per_page: 100,
  });
  return installations.map(inst => ({
    installationId: inst.id,
    accountLogin: inst.account && 'login' in inst.account ? inst.account.login : null,
    accountType: inst.account && 'type' in inst.account ? inst.account.type : null,
  }));
}

export interface RepoSummary {
  id: number;
  fullName: string;
  name: string;
  owner: string;
  defaultBranch: string;
  private: boolean;
  installationId: number;
}

/**
 * List repos accessible to an installation (paginated).
 */
export async function listInstallationRepos(installationId: number): Promise<RepoSummary[]> {
  const octokit = getInstallationOctokit(installationId);
  const repos = await octokit.paginate(octokit.apps.listReposAccessibleToInstallation, {
    per_page: 100,
  });
  return repos.map(repo => ({
    id: repo.id,
    fullName: repo.full_name,
    name: repo.name,
    owner: repo.owner.login,
    defaultBranch: repo.default_branch,
    private: repo.private,
    installationId,
  }));
}

/**
 * Fetch a single repo's metadata through an installation token and confirm the
 * installation actually has access to it. Returns `null` when the repo is not
 * accessible to the installation (so a client can't create a project for an
 * arbitrary repo under an installation id it merely owns).
 */
export type GithubRepositoryPermission = 'admin' | 'maintain' | 'write' | 'triage' | 'read' | 'none';

export async function getRepositoryCollaboratorPermission(
  installationId: number,
  repoFullName: string,
  username: string,
): Promise<GithubRepositoryPermission | undefined> {
  const parts = splitRepoFullName(repoFullName);
  if (!parts) return undefined;
  try {
    const { data } = await getInstallationOctokit(installationId).repos.getCollaboratorPermissionLevel({
      ...parts,
      username,
    });
    return data.permission as GithubRepositoryPermission;
  } catch {
    return undefined;
  }
}

export async function getInstallationRepo(installationId: number, repoFullName: string): Promise<RepoSummary | null> {
  const slash = repoFullName.indexOf('/');
  if (slash <= 0) return null;
  const owner = repoFullName.slice(0, slash);
  const repo = repoFullName.slice(slash + 1);
  const octokit = getInstallationOctokit(installationId);
  try {
    const { data } = await octokit.repos.get({ owner, repo });
    return {
      id: data.id,
      fullName: data.full_name,
      name: data.name,
      owner: data.owner.login,
      defaultBranch: data.default_branch,
      private: data.private,
      installationId,
    };
  } catch {
    return null;
  }
}

/** Split an `owner/name` full name into its parts, or `null` when malformed. */
function splitRepoFullName(repoFullName: string): { owner: string; repo: string } | null {
  const slash = repoFullName.indexOf('/');
  if (slash <= 0 || slash === repoFullName.length - 1) return null;
  return { owner: repoFullName.slice(0, slash), repo: repoFullName.slice(slash + 1) };
}

export interface IssueSummary {
  number: number;
  title: string;
  url: string;
  author: string | null;
  labels: string[];
  comments: number;
  createdAt: string;
  updatedAt: string;
}

/** Page size for issue/PR listings; one GitHub API call per page. */
export const LIST_PAGE_SIZE = 30;

export interface IssuePage {
  issues: IssueSummary[];
  /** Next page number to request, or `null` when this was the last page. */
  nextPage: number | null;
}

export interface ListRepoOpenIssuesOptions {
  label?: string;
}

export async function addIssueLabels(
  installationId: number,
  repoFullName: string,
  issueNumber: number,
  labels: string[],
): Promise<void> {
  const parts = splitRepoFullName(repoFullName);
  if (!parts) return;
  const uniqueLabels = [...new Set(labels.map(label => label.trim()).filter(Boolean))];
  if (uniqueLabels.length === 0) return;
  const octokit = getInstallationOctokit(installationId);
  await octokit.issues.addLabels({
    owner: parts.owner,
    repo: parts.repo,
    issue_number: issueNumber,
    labels: uniqueLabels,
  });
}

/**
 * List one page of a repo's open issues through an installation token. The
 * issues API also returns pull requests, so those are filtered out (the filter
 * can make a non-final page shorter than the page size — `nextPage` is derived
 * from the raw response length, not the filtered one).
 */
export async function listRepoOpenIssues(
  installationId: number,
  repoFullName: string,
  page: number,
  options: ListRepoOpenIssuesOptions = {},
): Promise<IssuePage> {
  const parts = splitRepoFullName(repoFullName);
  if (!parts) return { issues: [], nextPage: null };
  const octokit = getInstallationOctokit(installationId);
  const response = await octokit.issues.listForRepo({
    owner: parts.owner,
    repo: parts.repo,
    state: 'open',
    labels: options.label,
    sort: 'updated',
    direction: 'desc',
    per_page: LIST_PAGE_SIZE,
    page,
  });
  const issues = response.data
    .filter(issue => !issue.pull_request)
    .map(issue => ({
      number: issue.number,
      title: issue.title,
      url: issue.html_url,
      author: issue.user?.login ?? null,
      labels: issue.labels.map(label => (typeof label === 'string' ? label : (label.name ?? ''))).filter(Boolean),
      comments: issue.comments,
      createdAt: issue.created_at,
      updatedAt: issue.updated_at,
    }));
  return { issues, nextPage: response.data.length === LIST_PAGE_SIZE ? page + 1 : null };
}

export interface PullRequestSummary {
  number: number;
  title: string;
  url: string;
  author: string | null;
  baseBranch: string;
  headBranch: string;
  createdAt: string;
  updatedAt: string;
}

export interface PullRequestPage {
  pullRequests: PullRequestSummary[];
  /** Next page number to request, or `null` when this was the last page. */
  nextPage: number | null;
}

/**
 * List one page of a repo's open, non-draft pull requests through an
 * installation token. Draft filtering can make a non-final page shorter than
 * the page size — `nextPage` is derived from the raw response length.
 */
export async function listRepoOpenPullRequests(
  installationId: number,
  repoFullName: string,
  page: number,
): Promise<PullRequestPage> {
  const parts = splitRepoFullName(repoFullName);
  if (!parts) return { pullRequests: [], nextPage: null };
  const octokit = getInstallationOctokit(installationId);
  const response = await octokit.pulls.list({
    owner: parts.owner,
    repo: parts.repo,
    state: 'open',
    per_page: LIST_PAGE_SIZE,
    page,
  });
  const pullRequests = response.data
    .filter(pr => !pr.draft)
    .map(pr => ({
      number: pr.number,
      title: pr.title,
      url: pr.html_url,
      author: pr.user?.login ?? null,
      baseBranch: pr.base.ref,
      headBranch: pr.head.ref,
      createdAt: pr.created_at,
      updatedAt: pr.updated_at,
    }));
  return { pullRequests, nextPage: response.data.length === LIST_PAGE_SIZE ? page + 1 : null };
}

/**
 * Build the GitHub App install URL. `state` is carried through the install flow
 * and validated on callback.
 */
export function buildInstallUrl(state: string): string {
  const config = requireConfig();
  const url = new URL(`https://github.com/apps/${config.slug}/installations/new`);
  url.searchParams.set('state', state);
  return url.toString();
}

/**
 * Build the OAuth identify URL (authorize) used to confirm the user's identity
 * and obtain a user token for listing their installations.
 */
export function buildOAuthIdentifyUrl(state: string, redirectUri: string): string {
  const config = requireConfig();
  const url = new URL('https://github.com/login/oauth/authorize');
  url.searchParams.set('client_id', config.clientId);
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('state', state);
  return url.toString();
}

/**
 * Exchange an OAuth `code` for a user access token.
 */
export async function exchangeOAuthCode(code: string, redirectUri: string): Promise<string> {
  const config = requireConfig();
  const res = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    signal: AbortSignal.timeout(10_000),
    headers: { 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      code,
      redirect_uri: redirectUri,
    }),
  });
  if (!res.ok) {
    throw new Error(`GitHub OAuth token exchange failed: ${res.status}`);
  }
  const data = (await res.json()) as { access_token?: string; error?: string; error_description?: string };
  if (!data.access_token) {
    throw new Error(
      `GitHub OAuth token exchange returned no token: ${data.error_description ?? data.error ?? 'unknown'}`,
    );
  }
  return data.access_token;
}

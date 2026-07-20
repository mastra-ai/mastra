/**
 * `GithubIntegration` — the injectable GitHub App integration for the web
 * factory.
 *
 * The deploy entry (`src/mastra/index.ts`) reads the `GITHUB_APP_*` env vars
 * once, constructs an instance, and passes it to `MastraFactory` (the same
 * dependency-injection pattern as the auth adapter and the sandbox machine).
 * The factory seeds it into the runtime-config registry for the feature gate
 * (`./config.ts`) and hands the instance to every consumer explicitly — route
 * handlers receive it through `routes()`, the webhook fan-out and session
 * subscription tools through their deps.
 *
 * The class owns:
 *   - the GitHub App credentials (validated + PEM-normalized at construction),
 *   - every GitHub API operation the web surface performs (Octokit factories,
 *     token minting, installation/repo/issue/PR listings, OAuth exchange),
 *   - the webhook secret used to verify GitHub webhook deliveries,
 *   - its own HTTP surface: `routes()` returns the `/web/github/*` +
 *     `/auth/github/*` Mastra `apiRoutes`.
 *
 * A custom integration (different app per tenant, custom Octokit config) can
 * subclass this and override individual methods — everything downstream only
 * talks to the instance.
 */

import { createAppAuth } from '@octokit/auth-app';
import { Octokit } from '@octokit/rest';
import type { RequestContext } from '@mastra/core/request-context';
import type { ApiRoute } from '@mastra/core/server';

import type { FactoryIntegration, IntegrationContext, IntegrationTools } from '../factory-integration.js';
import { buildGithubRoutes } from './routes.js';
import { createGithubSubscriptionTools } from './session-subscriptions.js';
import type { GithubSubscriptionStorage } from './subscriptions.js';

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

export interface UserInstallation {
  installationId: number;
  accountLogin: string | null;
  accountType: string | null;
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

export type GithubRepositoryPermission = 'admin' | 'maintain' | 'write' | 'triage' | 'read' | 'none';

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

export interface GithubIntegrationConfig {
  /** GitHub App id (the numeric id, as a string). */
  appId: string;
  /**
   * App private key (PEM). Multi-line, `\n`-escaped, and fully flattened
   * single-line forms are all accepted (normalized at construction).
   */
  privateKey: string;
  /** OAuth client id of the GitHub App. */
  clientId: string;
  /** OAuth client secret of the GitHub App. */
  clientSecret: string;
  /** App slug — the URL name used to build the install URL. */
  slug: string;
  /**
   * Secret GitHub uses to sign webhook deliveries. Omitted → webhook
   * signature verification rejects all deliveries. Also serves as the default
   * replica-stable OAuth/install `state` secret (see `./config.ts`).
   */
  webhookSecret?: string;
}

/** Human-readable names of the required config fields, for construction errors. */
const REQUIRED_FIELDS = ['appId', 'privateKey', 'clientId', 'clientSecret', 'slug'] as const;

export class GithubIntegration implements FactoryIntegration {
  /** Stable integration identifier (see `../factory-integration.ts`). */
  readonly id = 'github';
  /**
   * The OAuth/install flow round-trips a signed `state` through GitHub, so a
   * multi-replica deploy needs a deployment-stable state secret.
   */
  readonly requiresStableStateSigner = true;

  readonly #appId: string;
  readonly #privateKey: string;
  readonly #clientId: string;
  readonly #clientSecret: string;
  readonly #slug: string;
  readonly #webhookSecret: string | undefined;
  #storage: IntegrationContext['storage'] | undefined;

  constructor(config: GithubIntegrationConfig) {
    const missing = REQUIRED_FIELDS.filter(field => !config[field]);
    if (missing.length > 0) {
      throw new Error(
        `GithubIntegration: missing required config field(s): ${missing.join(', ')}. ` +
          `Provide the full GitHub App credentials (appId, privateKey, clientId, clientSecret, slug) ` +
          `or omit the integration to disable GitHub-backed repositories.`,
      );
    }
    this.#appId = config.appId;
    this.#privateKey = normalizePrivateKey(config.privateKey);
    this.#clientId = config.clientId;
    this.#clientSecret = config.clientSecret;
    this.#slug = config.slug;
    this.#webhookSecret = config.webhookSecret || undefined;
  }

  /** App slug — the URL name used to build the install URL. */
  get slug(): string {
    return this.#slug;
  }

  get genericStorage(): IntegrationContext['storage']['generic'] {
    if (!this.#storage) throw new Error('GithubIntegration storage has not been initialized.');
    return this.#storage.generic;
  }

  get sourceControlStorage(): IntegrationContext['storage']['sourceControl'] {
    if (!this.#storage) throw new Error('GithubIntegration storage has not been initialized.');
    return this.#storage.sourceControl;
  }

  get integrationStorage(): GithubSubscriptionStorage {
    if (!this.#storage) throw new Error('GithubIntegration storage has not been initialized.');
    return this.#storage.generic as unknown as GithubSubscriptionStorage;
  }

  /** Secret GitHub uses to sign webhook deliveries, when configured. */
  get webhookSecret(): string | undefined {
    return this.#webhookSecret;
  }

  #appAuth() {
    return {
      appId: this.#appId,
      privateKey: this.#privateKey,
      clientId: this.#clientId,
      clientSecret: this.#clientSecret,
    };
  }

  /**
   * Octokit authenticated as the GitHub App itself (app JWT). Used for
   * app-level operations and to mint installation tokens.
   */
  getAppOctokit(): Octokit {
    return new Octokit({ authStrategy: createAppAuth, auth: this.#appAuth() });
  }

  /**
   * Octokit authenticated as a specific installation (installation access
   * token). Used to list repos and to operate on a repo on the user's behalf.
   */
  getInstallationOctokit(installationId: number): Octokit {
    return new Octokit({ authStrategy: createAppAuth, auth: { ...this.#appAuth(), installationId } });
  }

  /** Octokit authenticated as a user via their OAuth token (the identify step). */
  getUserOctokit(userToken: string): Octokit {
    return new Octokit({ auth: userToken });
  }

  /**
   * Mint a short-lived installation access token. Returned token is used only
   * server-side / inside the sandbox clone URL and never sent to the browser.
   */
  async mintInstallationToken(installationId: number): Promise<string> {
    const auth = createAppAuth(this.#appAuth());
    const installationAuth = await auth({ type: 'installation', installationId });
    return installationAuth.token;
  }

  /**
   * List the installations the authenticated user can access, via their OAuth
   * token (`GET /user/installations`).
   */
  async listUserInstallations(userToken: string): Promise<UserInstallation[]> {
    const octokit = this.getUserOctokit(userToken);
    const installations = await octokit.paginate(octokit.apps.listInstallationsForAuthenticatedUser, {
      per_page: 100,
    });
    return installations.map(inst => ({
      installationId: inst.id,
      accountLogin: inst.account && 'login' in inst.account ? inst.account.login : null,
      accountType: inst.account && 'type' in inst.account ? inst.account.type : null,
    }));
  }

  /** List repos accessible to an installation (paginated). */
  async listInstallationRepos(installationId: number): Promise<RepoSummary[]> {
    const octokit = this.getInstallationOctokit(installationId);
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
   * The authenticated user's permission level on a repo, through the
   * installation. `undefined` when the repo/user is not accessible.
   */
  async getRepositoryCollaboratorPermission(
    installationId: number,
    repoFullName: string,
    username: string,
    signal?: AbortSignal,
  ): Promise<GithubRepositoryPermission | undefined> {
    const parts = splitRepoFullName(repoFullName);
    if (!parts) return undefined;
    try {
      const { data } = await this.getInstallationOctokit(installationId).repos.getCollaboratorPermissionLevel({
        ...parts,
        username,
        request: { signal },
      });
      return data.permission as GithubRepositoryPermission;
    } catch {
      return undefined;
    }
  }

  /**
   * Fetch a single repo's metadata through an installation token and confirm
   * the installation actually has access to it. Returns `null` when the repo
   * is not accessible to the installation (so a client can't create a project
   * for an arbitrary repo under an installation id it merely owns).
   */
  async getInstallationRepo(installationId: number, repoFullName: string): Promise<RepoSummary | null> {
    const parts = splitRepoFullName(repoFullName);
    if (!parts) return null;
    const octokit = this.getInstallationOctokit(installationId);
    try {
      const { data } = await octokit.repos.get(parts);
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

  /** Add labels to an issue (deduplicated; no-op on empty/malformed input). */
  async addIssueLabels(
    installationId: number,
    repoFullName: string,
    issueNumber: number,
    labels: string[],
  ): Promise<void> {
    const parts = splitRepoFullName(repoFullName);
    if (!parts) return;
    const uniqueLabels = [...new Set(labels.map(label => label.trim()).filter(Boolean))];
    if (uniqueLabels.length === 0) return;
    const octokit = this.getInstallationOctokit(installationId);
    await octokit.issues.addLabels({
      owner: parts.owner,
      repo: parts.repo,
      issue_number: issueNumber,
      labels: uniqueLabels,
    });
  }

  /**
   * List one page of a repo's open issues through an installation token. The
   * issues API also returns pull requests, so those are filtered out (the
   * filter can make a non-final page shorter than the page size — `nextPage`
   * is derived from the raw response length, not the filtered one).
   */
  async listRepoOpenIssues(
    installationId: number,
    repoFullName: string,
    page: number,
    options: ListRepoOpenIssuesOptions = {},
  ): Promise<IssuePage> {
    const parts = splitRepoFullName(repoFullName);
    if (!parts) return { issues: [], nextPage: null };
    const octokit = this.getInstallationOctokit(installationId);
    const response = await octokit.issues.listForRepo({
      owner: parts.owner,
      repo: parts.repo,
      state: 'open',
      labels: options.label,
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

  /**
   * List one page of a repo's open, non-draft pull requests through an
   * installation token. Draft filtering can make a non-final page shorter than
   * the page size — `nextPage` is derived from the raw response length.
   */
  async listRepoOpenPullRequests(installationId: number, repoFullName: string, page: number): Promise<PullRequestPage> {
    const parts = splitRepoFullName(repoFullName);
    if (!parts) return { pullRequests: [], nextPage: null };
    const octokit = this.getInstallationOctokit(installationId);
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
   * Build the GitHub App install URL. `state` is carried through the install
   * flow and validated on callback.
   */
  buildInstallUrl(state: string): string {
    const url = new URL(`https://github.com/apps/${this.#slug}/installations/new`);
    url.searchParams.set('state', state);
    return url.toString();
  }

  /**
   * Build the OAuth identify URL (authorize) used to confirm the user's
   * identity and obtain a user token for listing their installations.
   */
  buildOAuthIdentifyUrl(state: string, redirectUri: string): string {
    const url = new URL('https://github.com/login/oauth/authorize');
    url.searchParams.set('client_id', this.#clientId);
    url.searchParams.set('redirect_uri', redirectUri);
    url.searchParams.set('state', state);
    return url.toString();
  }

  /** Exchange an OAuth `code` for a user access token. */
  async exchangeOAuthCode(code: string, redirectUri: string): Promise<string> {
    const res = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      signal: AbortSignal.timeout(10_000),
      headers: { 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({
        client_id: this.#clientId,
        client_secret: this.#clientSecret,
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

  /**
   * The integration's HTTP surface: the `/web/github/*` + `/auth/github/*`
   * Mastra `apiRoutes` (webhook handler, install/OAuth flow, project +
   * worktree + session operations). The factory folds these into the server's
   * `apiRoutes` when the feature is ready. Handlers operate on this instance.
   */
  routes(ctx: IntegrationContext): ApiRoute[] {
    this.#storage = ctx.storage;
    return buildGithubRoutes({
      github: this,
      stateSigner: ctx.stateSigner,
      baseUrl: ctx.baseUrl,
      controller: ctx.controller,
      runIssueTriage: ctx.hooks?.runIssueTriage,
    });
  }

  /**
   * Session-scoped agent tools: PR subscribe/unsubscribe for sessions bound
   * to a GitHub-backed project. Empty for sessions outside a GitHub project.
   */
  sessionTools(requestContext: RequestContext): IntegrationTools {
    return createGithubSubscriptionTools(requestContext, this);
  }

  /** Non-secret config snapshot for system diagnostics/startup logs. */
  diagnostics(): Record<string, unknown> {
    return {
      slug: this.#slug,
      webhookSecretConfigured: this.#webhookSecret !== undefined,
    };
  }
}

/** Split an `owner/name` full name into its parts, or `null` when malformed. */
function splitRepoFullName(repoFullName: string): { owner: string; repo: string } | null {
  const slash = repoFullName.indexOf('/');
  if (slash <= 0 || slash === repoFullName.length - 1) return null;
  return { owner: repoFullName.slice(0, slash), repo: repoFullName.slice(slash + 1) };
}

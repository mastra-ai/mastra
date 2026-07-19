/**
 * Mastra `apiRoutes` for the GitHub App project feature.
 *
 * Registered alongside the other `/web/*` routes, behind the WorkOS auth gate.
 * Every route additionally re-checks the authenticated user (`getWebAuthUser`)
 * and scopes all rows by that user's stable WorkOS id, so a user can only ever
 * see and operate on their own installations and projects.
 *
 * When the feature is disabled (`isGithubFeatureEnabled()` false), `buildGithubRoutes`
 * returns only `GET /web/github/status`, which reports `enabled:false`
 * so the SPA can cleanly hide all GitHub UI.
 */

import type { MountedMastraCode } from '@mastra/code-sdk';
import type { ApiRoute } from '@mastra/core/server';
import { registerApiRoute } from '@mastra/core/server';
import type { Context } from 'hono';

/**
 * Loose Hono context accepted by the shared GitHub route helpers. The
 * `registerApiRoute` handlers receive a path-parameterized context whose
 * `HonoRequest` literal-path generics are invariant and don't flow into a
 * shared helper signature. The helpers only ever touch cookies/query/tenant, so
 * we erase the path to a plain `Context` at the call boundary via `loose()`.
 */
type RouteContext = Context;

/** Erase a route handler's path-parameterized context to a plain `Context`. */
function loose(c: unknown): RouteContext {
  return c as RouteContext;
}
import { streamSSE } from 'hono/streaming';
import type { AuditEmitter } from '../audit/domain';
import { ensureWebAuthUser, getWebAuthUser, webAuthTenant } from '../auth';
import type { WebAuthTenant } from '../auth';
import type { StateSigner } from '../state-signing';
import { getGithubFeatureDiagnostics, isGithubFeatureEnabled } from './config';
import type { GithubIntegration } from './integration';
import { withProjectLock } from './project-lock';
import { handleGithubWebhook } from './webhook';
import type { GithubIssueTriageRunInput, GithubIssueTriageRunResult, ParsedGithubWebhook } from './webhook';
import {
  computeSandboxWorkdir,
  getSandboxProvider,
  isSandboxEnabled,
  reattachSandbox,
  SandboxBudgetError,
} from '../sandbox/fleet';
import type { MaterializationSandbox, PrepareProgress, ProgressFn } from '../sandbox/fleet';
import {
  commitAll,
  computeWorktreePath,
  ensureProjectSandbox,
  ensureWorktree,
  isValidGitRef as isValidGitRefSandbox,
  materializeRepo,
  MaterializeError,
  pushBranch,
  removeWorktree,
  runWorktreeSetup,
  teardownProjectSandbox,
  WorktreeError,
} from './sandbox';
import type { GitIdentity } from './sandbox';
import type {
  ProjectRepository,
  ProjectRepositorySandbox,
  ProjectSourceControlConnection,
  SourceControlInstallation,
  SourceControlRepository,
} from '../storage/domains/source-control/base';
import { getFactoryProjectsStorage } from '../storage/domains';
import { listPullRequestSubscriptionsForThread, subscribeToPullRequest } from './subscriptions';

export interface MountGithubRoutesOptions {
  /**
   * The GitHub App integration the handlers operate on (Octokit access, token
   * minting, OAuth URLs). Normally supplied by `GithubIntegration.routes()`;
   * when absent, only the disabled `status` route is served.
   */
  github?: GithubIntegration;
  /**
   * Shared OAuth/install `state` signer (created once per boot by the
   * factory). Required for the OAuth/install flow; when absent, only the
   * disabled `status` route is served.
   */
  stateSigner?: StateSigner;
  /**
   * Absolute base URL of the web server (e.g. `http://localhost:4111`), used to
   * build the OAuth/install redirect URI when one isn't explicitly configured.
   */
  baseUrl?: string;
  /** Explicit OAuth callback URI; defaults to `<baseUrl>/auth/github/callback`. */
  redirectUri?: string;
  /** Controller used to route verified webhook notifications to exact subscribed sessions. */
  controller?: MountedMastraCode['controller'];
  /** Run seam used by GitHub webhooks and manual Intake triage. */
  runIssueTriage?: (input: GithubIssueTriageRunInput) => Promise<GithubIssueTriageRunResult>;
  /** Best-effort audit emission supplied by the factory-owned audit domain. */
  emitAudit?: AuditEmitter['emit'];
  /** Authoritative Factory rule ingress for normalized, signature-verified GitHub deliveries. */
  ingestFactoryEvent?: (event: ParsedGithubWebhook) => Promise<unknown>;
  /** Revoke Factory agent authority before deleting the worktree that scopes it. */
  revokeFactoryBindingsForProjectPath?: (input: {
    orgId: string;
    factoryProjectId: string;
    projectPath: string;
  }) => Promise<void>;
}

/**
 * Resolve the Factory project's default model for a triage run. Best-effort:
 * a missing project or an uninitialized storage domain simply means "no
 * default", never a failed run.
 */
async function resolveFactoryDefaultModelId(factoryProjectId: string | undefined): Promise<string | undefined> {
  if (!factoryProjectId) return undefined;
  try {
    const project = await getFactoryProjectsStorage().getById({ id: factoryProjectId });
    return project?.defaultModelId ?? undefined;
  } catch {
    return undefined;
  }
}

function pullRequestNumberFromUrl(value: string, expectedRepo: string): number | undefined {
  try {
    const url = new URL(value);
    const match = url.pathname.match(/^\/([^/]+\/[^/]+)\/pull\/(\d+)\/?$/);
    if (
      url.protocol !== 'https:' ||
      url.hostname !== 'github.com' ||
      match?.[1]?.toLowerCase() !== expectedRepo.toLowerCase()
    ) {
      return undefined;
    }
    const number = Number(match[2]);
    return Number.isInteger(number) && number > 0 ? number : undefined;
  } catch {
    return undefined;
  }
}

/** Validate an `owner/name` repo full name. */
function isValidRepoFullName(value: unknown): value is string {
  return typeof value === 'string' && value.length <= 256 && /^[\w.-]+\/[\w.-]+$/.test(value);
}

function isCanonicalGithubIssueUrl(value: string, repoFullName: string, issueNumber: number): boolean {
  try {
    const url = new URL(value);
    const [owner, repo] = repoFullName.split('/');
    return (
      url.protocol === 'https:' &&
      url.hostname === 'github.com' &&
      url.pathname === `/${owner}/${repo}/issues/${issueNumber}` &&
      url.search === '' &&
      url.hash === ''
    );
  } catch {
    return false;
  }
}

/**
 * Validate a git branch/ref name against a strict whitelist. The value is later
 * interpolated into a shell `git clone --branch` command, so it must never
 * contain shell metacharacters. We accept only git-ref-safe characters and
 * reject anything else rather than relying on shell quoting alone.
 */
function isValidGitRef(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= 255 && /^[A-Za-z0-9_./-]+$/.test(value);
}

/**
 * Resolve the org-scoped tenant for a GitHub request. GitHub project features
 * are org-owned, so they require both a signed-in user and a WorkOS
 * organization. Returns the `(orgId, userId)` tenant (with `orgId` narrowed to a
 * non-null string) or a ready-to-return error response: 401 when unauthenticated,
 * 403 when the user has no organization (personal account).
 *
 * Resolves the WorkOS session from the request cookie itself (via
 * `ensureWebAuthUser`) instead of relying on the auth gate's context stash: on
 * platform deploys custom `apiRoutes` run on an isolated sub-app context where
 * the gate's `c.set(...)` is invisible. When the gate stash IS visible (local
 * Hono server), `ensureWebAuthUser` returns the cached user and this is a no-op.
 */
async function resolveOrgTenant(
  c: RouteContext,
): Promise<{ tenant: WebAuthTenant & { orgId: string } } | { response: Response }> {
  await ensureWebAuthUser(c);
  const tenant = webAuthTenant(c);
  if (!tenant) return { response: c.json({ error: 'unauthorized' }, 401) };
  if (!tenant.orgId) {
    return {
      response: c.json(
        {
          error: 'organization_required',
          message: 'GitHub projects require a WorkOS organization. Personal accounts cannot connect repositories.',
        },
        403,
      ),
    };
  }
  return { tenant: { orgId: tenant.orgId, userId: tenant.userId } };
}

/**
 * Parse a 1-based `page` query param. Missing means page 1; anything that is
 * not a small positive integer is rejected (`null`).
 */
function parseListPage(raw: string | undefined): number | null {
  if (raw === undefined) return 1;
  if (!/^\d{1,5}$/.test(raw)) return null;
  const page = Number(raw);
  return page >= 1 ? page : null;
}

const VALID_ISSUE_LABEL_FILTERS = new Set(['auto-triaged', 'needs-approval']);

function parseIssueLabelFilter(raw: string | undefined): string | undefined | null {
  if (raw === undefined || raw === '') return undefined;
  if (VALID_ISSUE_LABEL_FILTERS.has(raw)) return raw;
  return null;
}

function parseIssueNumberParam(raw: string | undefined): number | null {
  if (!raw || !/^\d{1,10}$/.test(raw)) return null;
  const issueNumber = Number(raw);
  return Number.isSafeInteger(issueNumber) && issueNumber > 0 ? issueNumber : null;
}

function parseStringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === 'string' && item.length > 0);
}

interface ResolvedProjectRepository extends ProjectRepository {
  connection: ProjectSourceControlConnection;
  installation: SourceControlInstallation;
  repository: SourceControlRepository;
  factoryProjectId: string;
  defaultBranch: string;
}

async function resolveProjectRepository(args: {
  github: GithubIntegration;
  orgId: string;
  projectRepositoryId: string;
}): Promise<ResolvedProjectRepository | null> {
  const projectRepository = await args.github.sourceControlStorage.projectRepositories.get({
    orgId: args.orgId,
    id: args.projectRepositoryId,
  });
  if (!projectRepository) return null;
  const connection = await args.github.sourceControlStorage.connections.get({
    orgId: args.orgId,
    id: projectRepository.connectionId,
  });
  if (!connection) return null;
  const repository = await args.github.sourceControlStorage.repositories.get({
    orgId: args.orgId,
    id: projectRepository.repositoryId,
  });
  if (!repository) return null;
  const installation = await args.github.sourceControlStorage.installations.get({
    orgId: args.orgId,
    id: connection.installationId,
  });
  if (!installation) return null;
  return {
    ...projectRepository,
    connection,
    installation,
    repository,
    factoryProjectId: connection.factoryProjectId,
    defaultBranch: projectRepository.branch ?? repository.defaultBranch,
  };
}

function polledIssueEvent(
  project: ResolvedProjectRepository,
  issue: {
    number: number;
    title: string;
    url: string;
    author: string | null;
    labels: string[];
    createdAt: string;
  },
): ParsedGithubWebhook {
  const repositoryId = Number(project.repository.externalId);
  return {
    event: 'issues',
    deliveryId: `poll:${repositoryId}:issue:${issue.number}:${issue.createdAt}`,
    payload: {
      action: 'opened',
      installation: { id: Number(project.installation.externalId) },
      repository: { id: repositoryId, full_name: project.repository.slug },
      sender: { login: issue.author ?? '__unknown__' },
      issue: {
        number: issue.number,
        title: issue.title,
        html_url: issue.url,
        labels: issue.labels.map(name => ({ name })),
      },
    },
  };
}

function polledPullRequestEvent(
  project: ResolvedProjectRepository,
  pullRequest: {
    number: number;
    title: string;
    url: string;
    author: string | null;
    headBranch: string;
    baseBranch: string;
    createdAt: string;
  },
): ParsedGithubWebhook {
  const repositoryId = Number(project.repository.externalId);
  return {
    event: 'pull_request',
    deliveryId: `poll:${repositoryId}:pull-request:${pullRequest.number}:${pullRequest.createdAt}`,
    payload: {
      action: 'opened',
      installation: { id: Number(project.installation.externalId) },
      repository: { id: repositoryId, full_name: project.repository.slug },
      sender: { login: pullRequest.author ?? '__unknown__' },
      pull_request: {
        number: pullRequest.number,
        title: pullRequest.title,
        html_url: pullRequest.url,
        state: 'open',
        merged: false,
        head: { ref: pullRequest.headBranch },
        base: { ref: pullRequest.baseBranch },
      },
    },
  };
}

async function ingestPolledEvents(
  events: ParsedGithubWebhook[],
  ingestFactoryEvent: MountGithubRoutesOptions['ingestFactoryEvent'],
): Promise<void> {
  if (!ingestFactoryEvent) return;
  const results = await Promise.allSettled(events.map(event => ingestFactoryEvent(event)));
  const rejected = results.find((result): result is PromiseRejectedResult => result.status === 'rejected');
  if (rejected) throw rejected.reason;
}

/**
 * Build the GitHub routes as Mastra `apiRoutes`. When the feature is disabled,
 * returns only the `status` route so the SPA can detect the disabled state.
 */
export function buildGithubRoutes(options: MountGithubRoutesOptions = {}): ApiRoute[] {
  const routes: ApiRoute[] = [];
  const { github, stateSigner, emitAudit } = options;

  // The status route is always registered so the SPA can detect the disabled state.
  routes.push(
    registerApiRoute('/web/github/status', {
      method: 'GET',
      requiresAuth: false,
      handler: async c => {
        if (!isGithubFeatureEnabled() || !github || !stateSigner) {
          return c.json({
            enabled: false,
            connected: false,
            installations: [],
            reason: 'missing_config',
            diagnostics: getGithubFeatureDiagnostics(),
          });
        }
        // Resolve the session from the request cookie: on platform deploys custom
        // apiRoutes run on an isolated context where the gate's stash is invisible.
        await ensureWebAuthUser(loose(c));
        const tenant = webAuthTenant(loose(c));
        if (!tenant) return c.json({ error: 'unauthorized', reason: 'auth_required' }, 401);

        // Org-scoped: personal (no-org) users have GitHub projects disabled. Report
        // enabled (so the SPA can show the org-required hint) but never connected.
        if (!tenant.orgId) {
          return c.json({
            enabled: true,
            sandboxEnabled: isSandboxEnabled(),
            organizationRequired: true,
            connected: false,
            installations: [],
            reason: 'organization_required',
            diagnostics: getGithubFeatureDiagnostics(),
          });
        }

        const rows = options.github
          ? await options.github.sourceControlStorage.installations.list({ orgId: tenant.orgId })
          : [];

        const connected = rows.length > 0;
        return c.json({
          enabled: true,
          sandboxEnabled: isSandboxEnabled(),
          connected,
          installations: rows.map(r => ({
            installationId: Number(r.externalId),
            accountLogin: r.accountName,
            accountType: r.accountType,
          })),
          reason: connected ? 'ready' : 'not_connected',
          diagnostics: getGithubFeatureDiagnostics(),
        });
      },
    }),
  );

  // Without an integration instance + state signer there is nothing the
  // remaining handlers can do — serve only the disabled `status` route
  // (mirrors the feature gate).
  if (!isGithubFeatureEnabled() || !github || !stateSigner) {
    return routes;
  }
  const signState = (orgId: string, userId: string): string => stateSigner.sign(orgId, userId);
  const verifyState = (state: string | undefined) => stateSigner.verify(state);

  const { runIssueTriage } = options;
  const runBoardIssueTriage = runIssueTriage
    ? async (input: GithubIssueTriageRunInput): Promise<GithubIssueTriageRunResult> => {
        if (!input.resourceId || !input.projectPath) {
          throw new Error('GitHub issue triage requires an explicit Factory project repository');
        }
        await github.addIssueLabels(input.installationId, input.repository, input.issueNumber, ['auto-triaged']);
        return runIssueTriage({
          ...input,
          defaultModelId: input.defaultModelId ?? (await resolveFactoryDefaultModelId(input.resourceId)),
          labels: input.labels.includes('auto-triaged') ? input.labels : [...input.labels, 'auto-triaged'],
        });
      }
    : undefined;

  routes.push(
    registerApiRoute('/web/github/subscriptions', {
      method: 'GET',
      handler: async c => {
        await ensureWebAuthUser(loose(c));
        const tenant = webAuthTenant(loose(c));
        if (!tenant?.orgId) return c.json({ error: 'unauthorized' }, 401);

        const resourceId = c.req.query('resourceId');
        const threadId = c.req.query('threadId');
        const sessionScope = c.req.query('scope');
        if (!resourceId || !threadId) return c.json({ error: 'resourceId and threadId are required' }, 400);

        const subscriptions = await listPullRequestSubscriptionsForThread(
          {
            orgId: tenant.orgId,
            resourceId,
            threadId,
            sessionScope,
          },
          github.integrationStorage,
        );
        return c.json({
          subscriptions: subscriptions.map(subscription => ({
            id: subscription.id,
            repoFullName: subscription.data.repositorySlug,
            pullRequestNumber: Number(subscription.data.changeRequestId),
            status: subscription.status,
            url: `https://github.com/${subscription.data.repositorySlug}/pull/${subscription.data.changeRequestId}`,
          })),
        });
      },
    }),
    registerApiRoute('/web/github/webhook', {
      method: 'POST',
      requiresAuth: false,
      handler: async c => {
        const result = await handleGithubWebhook(loose(c), {
          github,
          runIssueTriage: runBoardIssueTriage,
          ingestFactoryEvent: options.ingestFactoryEvent,
          ...(options.controller
            ? {
                controller: options.controller,
                onTargetError: (subscription, error) => {
                  console.warn(
                    `[GitHub Webhook] Delivery failed for subscription ${subscription.id} (${subscription.resourceId}/${subscription.threadId}).`,
                    error,
                  );
                },
              }
            : {}),
        });
        return c.json(result.body, result.status);
      },
    }),
  );

  const redirectUri = options.redirectUri ?? `${(options.baseUrl ?? '').replace(/\/$/, '')}/auth/github/callback`;

  // ── Connect: bounce through the OAuth identify flow ─────────────────────
  // Identify-first (rather than install-first) so an app that is *already*
  // installed on the org re-syncs into our DB: GitHub's install page dead-ends
  // on the installation settings screen for existing installs and never
  // redirects back to us. The callback persists whatever installations the
  // verified user token can see, and only redirects to the install URL when
  // there are none.
  //
  // `?manage=1` skips the identify bounce and sends the user straight to
  // GitHub's installation page — used by "Manage GitHub connection" to
  // add/remove accounts and repo access. For an already-authorized user the
  // identify flow completes instantly and invisibly, so without this the
  // manage button would appear to do nothing. GitHub's post-install "Save"
  // redirect lands back on the callback, which re-syncs installations.
  routes.push(
    registerApiRoute('/auth/github/connect', {
      method: 'GET',
      requiresAuth: false,
      handler: async c => {
        const resolved = await resolveOrgTenant(loose(c));
        if ('response' in resolved) return resolved.response;
        const state = signState(resolved.tenant.orgId, resolved.tenant.userId);
        if (c.req.query('manage')) return c.redirect(github.buildInstallUrl(state));
        return c.redirect(github.buildOAuthIdentifyUrl(state, redirectUri));
      },
    }),
  );

  // ── Callback: confirm identity, persist the installation against the org ──
  routes.push(
    registerApiRoute('/auth/github/callback', {
      method: 'GET',
      requiresAuth: false,
      handler: async c => {
        const resolved = await resolveOrgTenant(loose(c));
        if ('response' in resolved) return resolved.response;
        const { orgId, userId } = resolved.tenant;

        const state = c.req.query('state');
        if (!state) {
          // GitHub's "Save"/update redirect from the installation settings page
          // arrives with `installation_id` + `setup_action` but no state. We
          // never trust the raw installation_id; start a fresh identify bounce
          // bound to the current session so the update re-syncs installations.
          return c.redirect(github.buildOAuthIdentifyUrl(signState(orgId, userId), redirectUri));
        }
        const stateTenant = verifyState(state);
        if (!stateTenant || stateTenant.userId !== userId || stateTenant.orgId !== orgId) {
          // CSRF / cross-user/org linking protection: the signed state must belong
          // to the same logged-in user *and* their current org.
          console.warn(
            '[GitHub] Install callback rejected: state/tenant mismatch.',
            JSON.stringify({
              stateValid: Boolean(stateTenant),
              stateOrgId: stateTenant?.orgId,
              stateUserId: stateTenant?.userId,
              sessionOrgId: orgId,
              sessionUserId: userId,
            }),
          );
          return c.redirect('/?github=error');
        }

        const code = c.req.query('code');
        // We only ever persist installations that GitHub confirms belong to *this*
        // user via the OAuth code path. The raw `installation_id` from the install
        // redirect is not trusted on its own — anyone with a valid state could pass
        // an arbitrary id — so when no code is present we bounce through the OAuth
        // identify flow to obtain a verified user token first.
        if (!code) {
          return c.redirect(github.buildOAuthIdentifyUrl(signState(orgId, userId), redirectUri));
        }

        try {
          const userToken = await github.exchangeOAuthCode(code, redirectUri);
          const installations = await github.listUserInstallations(userToken);
          if (installations.length === 0) {
            // Verified user has no installations yet — send them to the actual
            // install page. After installing, GitHub redirects back here with
            // the same state (and no code), which bounces through identify
            // again and lands in the persist path below.
            return c.redirect(github.buildInstallUrl(signState(orgId, userId)));
          }
          for (const inst of installations) {
            // The installation is org-owned; `userId` records who connected it.
            await github.sourceControlStorage.installations.upsert({
              orgId,
              connectedByUserId: userId,
              externalId: inst.installationId.toString(),
              accountName: inst.accountLogin,
              accountType: inst.accountType,
            });
          }
        } catch (error) {
          console.warn(
            `[GitHub] Install callback failed to persist installations for org ${orgId} / user ${userId}.`,
            error,
          );
          return c.redirect('/?github=error');
        }

        return c.redirect('/?github=connected');
      },
    }),
  );

  // ── List repos across the org's installations ───────────────────────────
  routes.push(
    registerApiRoute('/web/github/repos', {
      method: 'GET',
      requiresAuth: false,
      handler: async c => {
        const resolved = await resolveOrgTenant(loose(c));
        if ('response' in resolved) return resolved.response;

        const installs = await github.sourceControlStorage.installations.list({ orgId: resolved.tenant.orgId });

        const query = (c.req.query('q') ?? '').toLowerCase();
        const repos = [];
        for (const inst of installs) {
          let list;
          try {
            list = await github.listInstallationRepos(Number(inst.externalId));
          } catch (err) {
            // GitHub 404s when the installation no longer exists for this app
            // (app uninstalled/reinstalled, or the row was recorded under
            // different app credentials). Prune the stale row so `/status`
            // reflects reality and the UI prompts a reconnect, then keep
            // listing the remaining installations.
            if ((err as { status?: number }).status !== 404) throw err;
            console.error(`[MastraCode Web] pruning stale GitHub installation ${inst.externalId} (404 from GitHub)`);
            await github.sourceControlStorage.installations.delete({ orgId: resolved.tenant.orgId, id: inst.id });
            continue;
          }
          for (const repo of list) {
            if (query && !repo.fullName.toLowerCase().includes(query)) continue;
            const repository = await github.sourceControlStorage.repositories.upsert({
              orgId: resolved.tenant.orgId,
              input: {
                installationId: inst.id,
                externalId: repo.id.toString(),
                slug: repo.fullName,
                defaultBranch: isValidGitRef(repo.defaultBranch) ? repo.defaultBranch : 'main',
                providerMetadata: { private: repo.private, owner: repo.owner },
              },
            });
            repos.push({
              ...repo,
              installationStorageId: inst.id,
              repositoryStorageId: repository.id,
              sandboxProvider: getSandboxProvider(),
              sandboxWorkdir: computeSandboxWorkdir(repo.fullName),
            });
          }
        }
        return c.json({ repos });
      },
    }),
  );

  // ── Materialize a project into the caller's per-user sandbox ─────────────
  routes.push(
    registerApiRoute('/web/github/projects/:id/ensure', {
      method: 'POST',
      requiresAuth: false,
      handler: async c => {
        const resolved = await resolveOrgTenant(loose(c));
        if ('response' in resolved) return resolved.response;
        const { orgId, userId } = resolved.tenant;

        if (!isSandboxEnabled()) {
          return c.json({ error: 'sandbox_not_configured', message: 'No sandbox provider is configured.' }, 503);
        }

        const projectRepositoryId = c.req.param('id');
        if (!projectRepositoryId) return c.json({ error: 'Project repository not found' }, 404);
        const project = await resolveProjectRepository({ github, orgId, projectRepositoryId });
        if (!project) {
          return c.json({ error: 'Project repository not found' }, 404);
        }

        // Stream live server-side progress when the client asks for it (EventSource
        // / fetch with `Accept: text/event-stream`); otherwise fall back to a single
        // JSON response so non-streaming callers and tests keep working unchanged.
        const wantsStream = (c.req.header('accept') ?? '').includes('text/event-stream');
        if (wantsStream) {
          return streamSSE(loose(c), async stream => {
            try {
              const result = await prepareProject(
                github,
                project,
                userId,
                ev => void stream.writeSSE({ event: 'progress', data: JSON.stringify(ev) }),
              );
              await stream.writeSSE({ event: 'done', data: JSON.stringify(result) });
            } catch (err) {
              await stream.writeSSE({ event: 'error', data: JSON.stringify(ensureErrorPayload(err).body) });
            }
          });
        }

        try {
          const result = await prepareProject(github, project, userId);
          return c.json(result);
        } catch (err) {
          const { status, body } = ensureErrorPayload(err);
          return c.json(body, status);
        }
      },
    }),
  );

  // ── List a project's open GitHub issues ──────────────────────────────────
  routes.push(
    registerApiRoute('/web/github/projects/:id/issues', {
      method: 'GET',
      requiresAuth: false,
      handler: async c => {
        const loaded = await loadOrgProject(github, loose(c));
        if ('response' in loaded) return loaded.response;
        const page = parseListPage(c.req.query('page'));
        if (page === null) return c.json({ error: 'invalid_page' }, 400);
        const label = parseIssueLabelFilter(c.req.query('label'));
        if (label === null) return c.json({ error: 'invalid_label' }, 400);
        try {
          const { issues, nextCursor } = await github.intake.listIssues({
            connection: {
              type: 'app-installation',
              installationId: Number(loaded.project.installation.externalId),
            },
            sourceIds: [loaded.project.repository.slug],
            labels: label ? [label] : undefined,
            cursor: String(page),
          });
          const responseIssues = issues.map(issue => ({
            number: Number(issue.id),
            title: issue.title,
            url: issue.url,
            author: issue.author,
            labels: issue.labels,
            comments: issue.commentCount ?? 0,
            createdAt: issue.createdAt,
            updatedAt: issue.updatedAt,
          }));
          await ingestPolledEvents(
            responseIssues.map(issue => polledIssueEvent(loaded.project, issue)),
            options.ingestFactoryEvent,
          );
          return c.json({
            issues: responseIssues,
            nextPage: nextCursor === null ? null : Number(nextCursor),
          });
        } catch (err) {
          return c.json(
            { error: 'github_fetch_failed', message: err instanceof Error ? err.message : String(err) },
            502,
          );
        }
      },
    }),
  );

  // ── Manually run issue triage using the same run seam as webhooks ──
  routes.push(
    registerApiRoute('/web/github/projects/:id/issues/:number/triage', {
      method: 'POST',
      requiresAuth: false,
      handler: async c => {
        const owned = await loadOwnedProject(github, loose(c));
        if ('response' in owned) return owned.response;
        const { project, sandboxRow } = owned;
        const issueNumber = parseIssueNumberParam(c.req.param('number'));
        if (issueNumber === null) return c.json({ error: 'invalid_issue_number' }, 400);

        let body: { title?: unknown; url?: unknown; labels?: unknown };
        try {
          body = await c.req.json();
        } catch {
          return c.json({ error: 'Invalid JSON body' }, 400);
        }
        if (typeof body.title !== 'string' || body.title.trim().length === 0 || body.title.length > 5000) {
          return c.json({ error: 'invalid_title' }, 400);
        }
        if (
          typeof body.url !== 'string' ||
          body.url.trim().length === 0 ||
          body.url.length > 2048 ||
          !isCanonicalGithubIssueUrl(body.url, project.repository.slug, issueNumber)
        ) {
          return c.json({ error: 'invalid_url' }, 400);
        }

        if (!runIssueTriage) return c.json({ error: 'triage_unavailable' }, 503);
        const branch = `factory/issue-${issueNumber}`;
        const projectPath = computeWorktreePath(sandboxRow.sandboxWorkdir, branch);
        await github.addIssueLabels(Number(project.installation.externalId), project.repository.slug, issueNumber, [
          'auto-triaged',
        ]);
        const result = await runIssueTriage({
          repository: project.repository.slug,
          issueNumber,
          issueTitle: body.title,
          issueUrl: body.url,
          labels: parseStringList(body.labels),
          installationId: Number(project.installation.externalId),
          resourceId: project.factoryProjectId,
          projectPath,
          branch,
          defaultModelId: await resolveFactoryDefaultModelId(project.factoryProjectId),
        });
        await emitAudit?.({
          context: loose(c),
          input: {
            action: 'factory.triage.started',
            factoryProjectId: project.factoryProjectId,
            projectRepositoryId: project.id,
            targets: [{ type: 'issue', id: String(issueNumber), name: body.title }],
            metadata: { issueNumber, branch, threadId: result.threadId },
          },
        });
        return c.json(
          {
            ok: true,
            threadId: result.threadId,
            projectPath: result.projectPath ?? projectPath,
            branch: result.branch ?? branch,
          },
          202,
        );
      },
    }),
  );

  // ── List a project's open (non-draft) pull requests ─────────────────────
  routes.push(
    registerApiRoute('/web/github/projects/:id/prs', {
      method: 'GET',
      requiresAuth: false,
      handler: async c => {
        const loaded = await loadOrgProject(github, loose(c));
        if ('response' in loaded) return loaded.response;
        const page = parseListPage(c.req.query('page'));
        if (page === null) return c.json({ error: 'invalid_page' }, 400);
        try {
          const { pullRequests, nextCursor } = await github.versionControl.listPullRequests({
            connection: {
              type: 'app-installation',
              installationId: Number(loaded.project.installation.externalId),
            },
            sourceId: loaded.project.repository.slug,
            includeDrafts: false,
            cursor: String(page),
          });
          const responsePullRequests = pullRequests.map(pr => ({
            number: Number(pr.id),
            title: pr.title,
            url: pr.url,
            author: pr.author,
            baseBranch: pr.baseBranch,
            headBranch: pr.headBranch,
            createdAt: pr.createdAt,
            updatedAt: pr.updatedAt,
          }));
          await ingestPolledEvents(
            responsePullRequests.map(pullRequest => polledPullRequestEvent(loaded.project, pullRequest)),
            options.ingestFactoryEvent,
          );
          return c.json({
            pullRequests: responsePullRequests,
            nextPage: nextCursor === null ? null : Number(nextCursor),
          });
        } catch (err) {
          return c.json(
            { error: 'github_fetch_failed', message: err instanceof Error ? err.message : String(err) },
            502,
          );
        }
      },
    }),
  );

  // ── Read per-project settings ────────────────────────────────────────────
  routes.push(
    registerApiRoute('/web/github/projects/:id/settings', {
      method: 'GET',
      requiresAuth: false,
      handler: async c => {
        const loaded = await loadOrgProject(github, loose(c));
        if ('response' in loaded) return loaded.response;
        return c.json({ setupCommand: loaded.project.setupCommand });
      },
    }),
  );

  // ── Update per-project settings ──────────────────────────────────────────
  routes.push(
    registerApiRoute('/web/github/projects/:id/settings', {
      method: 'POST',
      requiresAuth: false,
      handler: async c => {
        const loaded = await loadOrgProject(github, loose(c));
        if ('response' in loaded) return loaded.response;

        let body: { setupCommand?: unknown };
        try {
          body = await c.req.json();
        } catch {
          return c.json({ error: 'Invalid JSON body' }, 400);
        }
        if (body.setupCommand !== null && typeof body.setupCommand !== 'string') {
          return c.json({ error: 'Invalid setupCommand' }, 400);
        }
        if (typeof body.setupCommand === 'string' && body.setupCommand.length > 2000) {
          return c.json({ error: 'setupCommand too long (max 2000 characters)' }, 400);
        }
        // Reject control characters (except newline/tab). The command is a
        // shell script by design, but escape sequences and NULs have no
        // legitimate use and can spoof logs or confuse the sandbox shell.
        if (typeof body.setupCommand === 'string' && /[\0-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(body.setupCommand)) {
          return c.json({ error: 'setupCommand contains control characters' }, 400);
        }
        // An empty/whitespace command means "no setup step".
        const setupCommand =
          typeof body.setupCommand === 'string' && body.setupCommand.trim().length > 0
            ? body.setupCommand.trim()
            : null;

        await github.sourceControlStorage.projectRepositories.update({
          orgId: loaded.project.installation.orgId,
          id: loaded.project.id,
          input: { setupCommand },
        });
        return c.json({ setupCommand });
      },
    }),
  );

  // ── Worktree / branch / commit / push / PR ──────────────────────────────
  routes.push(
    ...buildProjectGitRoutes({
      github,
      emitAudit,
      revokeFactoryBindingsForProjectPath: options.revokeFactoryBindingsForProjectPath,
    }),
  );

  return routes;
}

/**
 * Load the org-owned project for a read-only GitHub API route. Unlike
 * `loadOwnedProject`, this never touches sandbox state — the issues/PR list
 * routes only need the repo + installation, so they work before a sandbox is
 * ever provisioned.
 */
async function loadOrgProject(
  github: GithubIntegration,
  c: RouteContext,
): Promise<{ project: ResolvedProjectRepository } | { response: Response }> {
  const resolved = await resolveOrgTenant(c);
  if ('response' in resolved) return { response: resolved.response };
  const { orgId } = resolved.tenant;

  const projectRepositoryId = c.req.param('id');
  if (!projectRepositoryId) {
    return { response: c.json({ error: 'Project repository not found' }, 404) };
  }
  const project = await resolveProjectRepository({ github, orgId, projectRepositoryId });
  if (!project) {
    return { response: c.json({ error: 'Project repository not found' }, 404) };
  }
  return { project };
}

/** Derive a commit/author identity from the authenticated WorkOS user. */
function identityFromUser(user: { name?: string; email?: string } | undefined): GitIdentity {
  return { name: user?.name ?? null, email: user?.email ?? null };
}

/**
 * Resolve a live, started sandbox for the caller's per-user sandbox binding. The
 * sandbox must already have been provisioned (`sandboxId` set) — the git write
 * routes never clone, they operate on the existing checkout.
 */
async function resolveProjectSandbox(sandboxRow: ProjectRepositorySandbox): Promise<MaterializationSandbox> {
  if (!sandboxRow.sandboxId) {
    throw new MaterializeError('Project sandbox is not provisioned. Open the project first.', 'clone-failed');
  }
  return reattachSandbox(sandboxRow.sandboxId);
}

/**
 * Load (or create) the caller's per-(project,user) sandbox binding row. The
 * binding inherits its workdir from the org-owned project, but `sandboxId` /
 * `materializedAt` stay null until the user first opens the project.
 */
async function loadOrCreateSandboxRow(
  github: GithubIntegration,
  project: ResolvedProjectRepository,
  userId: string,
): Promise<ProjectRepositorySandbox> {
  return github.sourceControlStorage.sandboxes.getOrCreate({ projectRepository: project, userId });
}

interface EnsureResult {
  resourceId: string;
  factoryProjectId: string;
  projectRepositoryId: string;
  sandboxId: string | null;
  sandboxWorkdir: string;
}

/**
 * Provision/reattach the caller's sandbox and materialize the repo into it,
 * emitting coarse progress events as each server step happens. Shared by both
 * the JSON and SSE variants of the `/ensure` route. Throws on failure so the
 * caller can shape the response (HTTP status vs SSE `error` event).
 */
async function prepareProject(
  github: GithubIntegration,
  project: ResolvedProjectRepository,
  userId: string,
  onProgress?: ProgressFn,
): Promise<EnsureResult> {
  const sandboxRow = await loadOrCreateSandboxRow(github, project, userId);
  const sandbox = await ensureProjectSandbox(sandboxRow, github.sourceControlStorage.sandboxes, onProgress);
  // Re-read the sandbox binding so we have the freshly persisted sandboxId.
  const fresh = await github.sourceControlStorage.sandboxes.getById({ id: sandboxRow.id });
  const token = await github.mintInstallationToken(Number(project.installation.externalId));
  const finalRow = fresh ?? sandboxRow;
  await materializeRepo(
    finalRow,
    { repoFullName: project.repository.slug, defaultBranch: project.defaultBranch },
    sandbox,
    token,
    github.sourceControlStorage.sandboxes,
    onProgress,
  );
  const result: EnsureResult = {
    resourceId: project.factoryProjectId,
    factoryProjectId: project.factoryProjectId,
    projectRepositoryId: project.id,
    sandboxId: finalRow.sandboxId,
    sandboxWorkdir: finalRow.sandboxWorkdir,
  };
  const done: PrepareProgress = { phase: 'done', message: 'Workspace ready.' };
  onProgress?.(done);
  return result;
}

/** Shape an /ensure failure into an HTTP status + JSON body (also used as the SSE error payload). */
function ensureErrorPayload(err: unknown): {
  status: 429 | 502 | 500;
  body: { error: string; message: string };
} {
  if (err instanceof SandboxBudgetError) {
    return { status: 429, body: { error: err.code, message: err.message } };
  }
  if (err instanceof MaterializeError) {
    return { status: 502, body: { error: err.code, message: err.message } };
  }
  return {
    status: 500,
    body: { error: 'materialize_failed', message: err instanceof Error ? err.message : String(err) },
  };
}

/** Map a sandbox/worktree error to an actionable HTTP response. */
function gitErrorResponse(c: Context, err: unknown) {
  if (err instanceof WorktreeError) {
    return c.json({ error: err.code, message: err.message }, err.code === 'invalid-branch' ? 400 : 502);
  }
  if (err instanceof MaterializeError) {
    return c.json({ error: err.code, message: err.message }, 502);
  }
  return c.json({ error: 'git_failed', message: err instanceof Error ? err.message : String(err) }, 500);
}

/**
 * Load the org-owned project and the caller's per-user sandbox binding for a git
 * route. Centralizes the auth + org/ownership checks every git route shares:
 * the project is scoped by `(id, orgId)`, the sandbox binding by
 * `(projectRepositoryId, userId)`. Returns the tenant, project, and sandbox row, or
 * a ready-to-return error response.
 */
async function loadOwnedProject(
  github: GithubIntegration,
  c: RouteContext,
): Promise<
  | { orgId: string; userId: string; project: ResolvedProjectRepository; sandboxRow: ProjectRepositorySandbox }
  | { response: Response }
> {
  const resolved = await resolveOrgTenant(c);
  if ('response' in resolved) return { response: resolved.response };
  const { orgId, userId } = resolved.tenant;

  if (!isSandboxEnabled()) {
    return {
      response: c.json({ error: 'sandbox_not_configured', message: 'No sandbox provider is configured.' }, 503),
    };
  }

  const projectRepositoryId = c.req.param('id');
  if (!projectRepositoryId) {
    return { response: c.json({ error: 'Project repository not found' }, 404) };
  }
  const project = await resolveProjectRepository({ github, orgId, projectRepositoryId });
  if (!project) {
    return { response: c.json({ error: 'Project repository not found' }, 404) };
  }
  const sandboxRow = await loadOrCreateSandboxRow(github, project, userId);
  return { orgId, userId, project, sandboxRow };
}

function buildProjectGitRoutes({
  github,
  emitAudit,
  revokeFactoryBindingsForProjectPath,
}: {
  github: GithubIntegration;
  emitAudit?: AuditEmitter['emit'];
  revokeFactoryBindingsForProjectPath?: (input: {
    orgId: string;
    factoryProjectId: string;
    projectPath: string;
  }) => Promise<void>;
}): ApiRoute[] {
  return [
    // ── Create / reuse a worktree + feature branch ──────────────────────────
    registerApiRoute('/web/github/projects/:id/worktree', {
      method: 'POST',
      requiresAuth: false,
      handler: async c => {
        const owned = await loadOwnedProject(github, loose(c));
        if ('response' in owned) return owned.response;
        const { orgId, userId, project, sandboxRow } = owned;

        let body: { branch?: unknown; baseBranch?: unknown };
        try {
          body = await c.req.json();
        } catch {
          return c.json({ error: 'Invalid JSON body' }, 400);
        }
        if (!isValidGitRefSandbox(body.branch)) {
          return c.json({ error: 'Invalid branch' }, 400);
        }
        const baseBranch = body.baseBranch === undefined ? project.defaultBranch : body.baseBranch;
        if (!isValidGitRefSandbox(baseBranch)) {
          return c.json({ error: 'Invalid baseBranch' }, 400);
        }
        const branch = body.branch;

        try {
          return await withProjectLock(`${project.id}:${userId}`, async () => {
            const sandbox = await resolveProjectSandbox(sandboxRow);
            const token = await github.mintInstallationToken(Number(project.installation.externalId));
            const result = await ensureWorktree(sandbox, sandboxRow.sandboxWorkdir, {
              branch,
              baseBranch,
              token,
              repoFullName: project.repository.slug,
            });

            // Run the project's setup command in the fresh checkout before the
            // route resolves — callers only start agent runs after this request
            // succeeds, so the tree is guaranteed set up before any agent
            // execution. Reused worktrees were already set up on creation.
            if (!result.reused && project.setupCommand) {
              await runWorktreeSetup(sandbox, result.worktreePath, project.setupCommand);
            }

            await github.sourceControlStorage.worktrees.upsert({
              projectRepositoryId: project.id,
              userId,
              branch: result.branch,
              baseBranch: result.baseBranch,
              worktreePath: result.worktreePath,
            });

            if (!result.reused) {
              await emitAudit?.({
                context: loose(c),
                input: {
                  action: 'factory.worktree.created',
                  factoryProjectId: project.factoryProjectId,
                  projectRepositoryId: project.id,
                  targets: [{ type: 'worktree', id: result.worktreePath, name: result.branch }],
                  metadata: {
                    branch: result.branch,
                    baseBranch: result.baseBranch,
                    worktreePath: result.worktreePath,
                  },
                },
              });
            }

            return c.json({
              worktreePath: result.worktreePath,
              branch: result.branch,
              baseBranch: result.baseBranch,
              resourceId: project.factoryProjectId,
              projectRepositoryId: project.id,
            });
          });
        } catch (err) {
          return gitErrorResponse(loose(c), err);
        }
      },
    }),

    // ── Delete a worktree + its local feature branch ────────────────────────
    registerApiRoute('/web/github/projects/:id/worktree/delete', {
      method: 'POST',
      requiresAuth: false,
      handler: async c => {
        const owned = await loadOwnedProject(github, loose(c));
        if ('response' in owned) return owned.response;
        const { orgId, userId, project, sandboxRow } = owned;

        let body: { branch?: unknown };
        try {
          body = await c.req.json();
        } catch {
          return c.json({ error: 'Invalid JSON body' }, 400);
        }
        if (!isValidGitRefSandbox(body.branch)) {
          return c.json({ error: 'Invalid branch' }, 400);
        }
        const branch = body.branch;

        // Only server-created worktrees (persisted rows owned by this user)
        // can be deleted; the repo root checkout is never a worktree row.
        const worktreeRow = await github.sourceControlStorage.worktrees.get({
          projectRepositoryId: project.id,
          userId,
          branch,
        });
        if (!worktreeRow) return c.json({ error: 'Unknown worktree' }, 404);
        if (worktreeRow.worktreePath === sandboxRow.sandboxWorkdir) {
          return c.json({ error: 'Cannot delete the repo root workspace' }, 400);
        }

        try {
          return await withProjectLock(`${project.id}:${userId}`, async () => {
            const sandbox = await resolveProjectSandbox(sandboxRow);
            await revokeFactoryBindingsForProjectPath?.({
              orgId,
              factoryProjectId: project.factoryProjectId,
              projectPath: worktreeRow.worktreePath,
            });
            await removeWorktree(sandbox, sandboxRow.sandboxWorkdir, {
              branch,
              worktreePath: worktreeRow.worktreePath,
            });
            await github.sourceControlStorage.worktrees.delete({ projectRepositoryId: project.id, userId, branch });
            await emitAudit?.({
              context: loose(c),
              input: {
                action: 'factory.worktree.deleted',
                factoryProjectId: project.factoryProjectId,
                projectRepositoryId: project.id,
                targets: [{ type: 'worktree', id: worktreeRow.worktreePath, name: branch }],
                metadata: { branch, worktreePath: worktreeRow.worktreePath },
              },
            });
            return c.json({ removed: true, branch, worktreePath: worktreeRow.worktreePath });
          });
        } catch (err) {
          return gitErrorResponse(loose(c), err);
        }
      },
    }),

    // ── Stage all + commit inside a worktree ────────────────────────────────
    registerApiRoute('/web/github/projects/:id/commit', {
      method: 'POST',
      requiresAuth: false,
      handler: async c => {
        const owned = await loadOwnedProject(github, loose(c));
        if ('response' in owned) return owned.response;
        const { userId, project, sandboxRow } = owned;

        let body: { message?: unknown; worktreePath?: unknown };
        try {
          body = await c.req.json();
        } catch {
          return c.json({ error: 'Invalid JSON body' }, 400);
        }
        if (typeof body.message !== 'string' || body.message.trim().length === 0 || body.message.length > 5000) {
          return c.json({ error: 'Invalid message' }, 400);
        }
        const workdir = await resolveWorktreePath(
          github,
          project.id,
          userId,
          body.worktreePath,
          sandboxRow.sandboxWorkdir,
        );
        if (!workdir) {
          return c.json({ error: 'Invalid worktreePath' }, 400);
        }

        try {
          return await withProjectLock(`${project.id}:${userId}`, async () => {
            const sandbox = await resolveProjectSandbox(sandboxRow);
            const result = await commitAll(
              sandbox,
              workdir,
              body.message as string,
              identityFromUser(getWebAuthUser(loose(c))),
            );
            if (result.committed) {
              await emitAudit?.({
                context: loose(c),
                input: {
                  action: 'factory.git.commit',
                  factoryProjectId: project.factoryProjectId,
                  projectRepositoryId: project.id,
                  targets: [{ type: 'worktree', id: workdir }],
                  metadata: { worktreePath: workdir },
                },
              });
            }
            return c.json({ committed: result.committed });
          });
        } catch (err) {
          return gitErrorResponse(loose(c), err);
        }
      },
    }),

    // ── Push a branch back to GitHub ────────────────────────────────────────
    registerApiRoute('/web/github/projects/:id/push', {
      method: 'POST',
      requiresAuth: false,
      handler: async c => {
        const owned = await loadOwnedProject(github, loose(c));
        if ('response' in owned) return owned.response;
        const { userId, project, sandboxRow } = owned;

        let body: { branch?: unknown; worktreePath?: unknown };
        try {
          body = await c.req.json();
        } catch {
          return c.json({ error: 'Invalid JSON body' }, 400);
        }
        if (!isValidGitRefSandbox(body.branch)) {
          return c.json({ error: 'Invalid branch' }, 400);
        }
        const branch = body.branch;
        const workdir = await resolveWorktreePath(
          github,
          project.id,
          userId,
          body.worktreePath,
          sandboxRow.sandboxWorkdir,
        );
        if (!workdir) {
          return c.json({ error: 'Invalid worktreePath' }, 400);
        }

        try {
          return await withProjectLock(`${project.id}:${userId}`, async () => {
            const sandbox = await resolveProjectSandbox(sandboxRow);
            const token = await github.mintInstallationToken(Number(project.installation.externalId));
            await pushBranch(sandbox, workdir, branch, token, project.repository.slug);
            await emitAudit?.({
              context: loose(c),
              input: {
                action: 'factory.git.push',
                factoryProjectId: project.factoryProjectId,
                projectRepositoryId: project.id,
                targets: [{ type: 'branch', id: branch }],
                metadata: { branch, worktreePath: workdir },
              },
            });
            return c.json({ pushed: true, branch });
          });
        } catch (err) {
          return gitErrorResponse(loose(c), err);
        }
      },
    }),

    // ── Open a pull request through the version-control capability ─────────
    registerApiRoute('/web/github/projects/:id/pr', {
      method: 'POST',
      requiresAuth: false,
      handler: async c => {
        const owned = await loadOwnedProject(github, loose(c));
        if ('response' in owned) return owned.response;
        const { orgId, userId, project, sandboxRow } = owned;

        let body: {
          branch?: unknown;
          base?: unknown;
          title?: unknown;
          body?: unknown;
          worktreePath?: unknown;
          sessionId?: unknown;
          threadId?: unknown;
        };
        try {
          body = await c.req.json();
        } catch {
          return c.json({ error: 'Invalid JSON body' }, 400);
        }
        if (!isValidGitRefSandbox(body.branch)) {
          return c.json({ error: 'Invalid branch' }, 400);
        }
        const base = body.base === undefined ? project.defaultBranch : body.base;
        if (!isValidGitRefSandbox(base)) {
          return c.json({ error: 'Invalid base' }, 400);
        }
        if (typeof body.title !== 'string' || body.title.trim().length === 0 || body.title.length > 256) {
          return c.json({ error: 'Invalid title' }, 400);
        }
        if (body.body !== undefined && (typeof body.body !== 'string' || body.body.length > 65536)) {
          return c.json({ error: 'Invalid body' }, 400);
        }
        const head = body.branch;
        const title = body.title;
        const prBody = body.body as string | undefined;
        const workdir = await resolveWorktreePath(
          github,
          project.id,
          userId,
          body.worktreePath,
          sandboxRow.sandboxWorkdir,
        );
        if (!workdir) {
          return c.json({ error: 'Invalid worktreePath' }, 400);
        }

        try {
          return await withProjectLock(`${project.id}:${userId}`, async () => {
            const result = await github.versionControl.createPullRequest({
              connection: {
                type: 'app-installation',
                installationId: Number(project.installation.externalId),
              },
              sourceId: project.repository.slug,
              baseBranch: base,
              headBranch: head,
              title,
              body: prBody,
            });
            await emitAudit?.({
              context: loose(c),
              input: {
                action: 'factory.git.pr_opened',
                factoryProjectId: project.factoryProjectId,
                projectRepositoryId: project.id,
                targets: [{ type: 'pull_request', id: result.url, name: title }],
                metadata: { branch: head, base, url: result.url },
              },
            });
            if (
              typeof body.sessionId === 'string' &&
              body.sessionId &&
              typeof body.threadId === 'string' &&
              body.threadId
            ) {
              const pullRequestNumber = pullRequestNumberFromUrl(result.url, project.repository.slug);
              if (pullRequestNumber) {
                await subscribeToPullRequest(
                  {
                    orgId,
                    installationExternalId: project.installation.externalId,
                    projectRepositoryId: project.id,
                    repositoryExternalId: project.repository.externalId,
                    repositorySlug: project.repository.slug,
                    changeRequestId: pullRequestNumber.toString(),
                    sessionId: body.sessionId,
                    ownerId: userId,
                    resourceId: project.factoryProjectId,
                    threadId: body.threadId,
                    sessionScope: workdir,
                    source: 'factory-pr-create',
                    subscribedByUserId: userId,
                  },
                  github.integrationStorage,
                ).catch((error: unknown) => {
                  console.warn(
                    `[GitHub] Pull request ${result.url} was created but automatic subscription failed.`,
                    error,
                  );
                });
              }
            }
            return c.json({ url: result.url });
          });
        } catch (err) {
          return c.json(
            { error: 'github_pr_create_failed', message: err instanceof Error ? err.message : String(err) },
            502,
          );
        }
      },
    }),

    // ── Tear down the caller's sandbox for a project ────────────────────────
    // Per-user teardown only: drops the caller's `(project, user)` sandbox
    // binding and stops the VM, freeing a slot in the per-replica budget. Project
    // deletion at the org level is out of scope (org admin model is later).
    registerApiRoute('/web/github/projects/:id/sandbox', {
      method: 'DELETE',
      requiresAuth: false,
      handler: async c => {
        const owned = await loadOwnedProject(github, loose(c));
        if ('response' in owned) return owned.response;
        const { userId, project, sandboxRow } = owned;

        if (!sandboxRow.sandboxId) {
          // Nothing provisioned for this user — idempotent success.
          return c.json({ tornDown: false });
        }

        try {
          return await withProjectLock(`${project.id}:${userId}`, async () => {
            const sandbox = await reattachSandbox(sandboxRow.sandboxId!);
            await teardownProjectSandbox(sandboxRow, github.sourceControlStorage.sandboxes, sandbox);
            return c.json({ tornDown: true });
          });
        } catch (err) {
          return gitErrorResponse(loose(c), err);
        }
      },
    }),
  ];
}

/**
 * Resolve and validate the worktree path a git write operation targets. The
 * path is never trusted from the client verbatim: it must either be the
 * project's repo workdir (committing/pushing on the base checkout) or match a
 * persisted worktree row for this project. Returns the validated path or
 * `undefined` when it isn't recognized.
 */
async function resolveWorktreePath(
  github: GithubIntegration,
  projectId: string,
  userId: string,
  worktreePath: unknown,
  repoWorkdir: string,
): Promise<string | undefined> {
  if (worktreePath === undefined || worktreePath === repoWorkdir) {
    return repoWorkdir;
  }
  if (typeof worktreePath !== 'string') {
    return undefined;
  }
  const row = await github.sourceControlStorage.worktrees.findByPath({
    projectRepositoryId: projectId,
    userId,
    worktreePath,
  });
  return row ? row.worktreePath : undefined;
}

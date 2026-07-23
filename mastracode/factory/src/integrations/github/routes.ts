/**
 * Mastra `apiRoutes` for the GitHub App project feature.
 *
 * Registered alongside the other `/web/*` routes, behind the host auth gate.
 * Every route additionally re-checks the authenticated user via the injected
 * `RouteAuth` seam and scopes all rows by that user's stable id, so a user can
 * only ever see and operate on their own installations and projects.
 *
 * When the feature is disabled (`isGithubFeatureEnabled()` false), `buildGithubRoutes`
 * returns only `GET /web/github/status`, which reports `enabled:false`
 * so the SPA can cleanly hide all GitHub UI.
 */

import { randomUUID } from 'node:crypto';
import type { MountedMastraCode } from '@mastra/code-sdk';
import type { ApiRoute } from '@mastra/core/server';
import { registerApiRoute } from '@mastra/core/server';
import type { FactoryStorage } from '@mastra/core/storage';
import type { Context } from 'hono';
import { streamSSE } from 'hono/streaming';
import type { RouteAuth } from '../../routes/route.js';
import { SandboxBudgetError } from '../../sandbox/fleet.js';
import type { MaterializationSandbox, PrepareProgress, ProgressFn, SandboxFleet } from '../../sandbox/fleet.js';
import type { StateSigner } from '../../state-signing.js';
import type { AuditEmitter } from '../../storage/domains/audit/domain.js';
import type { FactoryProjectsStorage } from '../../storage/domains/projects/base.js';
import type {
  ProjectRepository,
  ProjectRepositorySandbox,
  ProjectSourceControlConnection,
  SourceControlInstallation,
  SourceControlRepository,
} from '../../storage/domains/source-control/base.js';
import { getGithubFeatureDiagnostics, isGithubFeatureEnabled } from './config.js';
import type { GithubIntegration } from './integration.js';
import { clearGithubPat, getGithubPat, getGithubPatStatus, setGithubPat } from './pat.js';
import type { GithubPatKind } from './pat.js';
import { withProjectLock } from './project-lock.js';

import {
  commitAll,
  computeWorktreePath,
  ensureProjectSandbox,
  isValidGitRef as isValidGitRefSandbox,
  materializeRepo,
  MaterializeError,
  pushBranch,
  teardownProjectSandbox,
  WorktreeError,
} from './sandbox.js';
import type { GitIdentity } from './sandbox.js';
import { listPullRequestSubscriptionsForThread, subscribeToPullRequest } from './subscriptions.js';
import { handleGithubWebhook } from './webhook.js';
import type { GithubIssueTriageRunInput, GithubIssueTriageRunResult, ParsedGithubWebhook } from './webhook.js';

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

export interface MountGithubRoutesOptions {
  /** Host auth seam — resolves the signed-in user/tenant for each request. */
  auth: RouteAuth;
  /**
   * Sandbox fleet for per-project sandboxes. A fleet constructed without a
   * machine config reports `enabled: false` and the sandbox-backed routes
   * respond 503.
   */
  fleet: SandboxFleet;
  /**
   * Factory storage backend. Supplies the cross-replica `withDistributedLock`
   * capability for git write routes and the `appDbConfigured` diagnostic.
   */
  storage?: FactoryStorage;
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
  /** Factory projects domain — resolves a project's default triage model. */
  projects?: FactoryProjectsStorage;
  /** Authoritative Factory rule ingress for normalized, signature-verified GitHub deliveries. */
  ingestFactoryEvent?: (event: ParsedGithubWebhook) => Promise<unknown>;
}

/**
 * Resolve the Factory project's default model for a triage run. Best-effort:
 * a missing project or an uninitialized storage domain simply means "no
 * default", never a failed run.
 */
async function resolveFactoryDefaultModelId(
  projects: FactoryProjectsStorage | undefined,
  factoryProjectId: string | undefined,
): Promise<string | undefined> {
  if (!projects || !factoryProjectId) return undefined;
  try {
    const project = await projects.getById({ id: factoryProjectId });
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
 * Resolves the session from the request cookie itself (via `auth.ensureUser`)
 * instead of relying on the auth gate's context stash: on platform deploys
 * custom `apiRoutes` run on an isolated sub-app context where the gate's
 * `c.set(...)` is invisible. When the gate stash IS visible (local Hono
 * server), `auth.ensureUser` returns the cached user and this is a no-op.
 */
async function resolveOrgTenant(
  c: RouteContext,
  auth: RouteAuth,
): Promise<{ tenant: { orgId: string; userId: string } } | { response: Response }> {
  await auth.ensureUser(c);
  const tenant = auth.tenant(c);
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
        created_at: issue.createdAt,
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
        created_at: pullRequest.createdAt,
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
export function buildGithubRoutes(options: MountGithubRoutesOptions): ApiRoute[] {
  const routes: ApiRoute[] = [];
  const { auth, fleet, storage, github, stateSigner, emitAudit } = options;
  const diagnostics = () =>
    getGithubFeatureDiagnostics({ github, auth, appDbConfigured: storage !== undefined, stateSigner, fleet });

  // The status route is always registered so the SPA can detect the disabled state.
  routes.push(
    registerApiRoute('/web/github/status', {
      method: 'GET',
      requiresAuth: false,
      handler: async c => {
        if (!isGithubFeatureEnabled({ github, auth }) || !github || !stateSigner) {
          return c.json({
            enabled: false,
            connected: false,
            installations: [],
            reason: 'missing_config',
            diagnostics: diagnostics(),
          });
        }
        // Resolve the session from the request cookie: on platform deploys custom
        // apiRoutes run on an isolated context where the gate's stash is invisible.
        await auth.ensureUser(loose(c));
        const tenant = auth.tenant(loose(c));
        if (!tenant) return c.json({ error: 'unauthorized', reason: 'auth_required' }, 401);

        // Org-scoped: personal (no-org) users have GitHub projects disabled. Report
        // enabled (so the SPA can show the org-required hint) but never connected.
        if (!tenant.orgId) {
          return c.json({
            enabled: true,
            sandboxEnabled: fleet.enabled,
            organizationRequired: true,
            connected: false,
            installations: [],
            reason: 'organization_required',
            diagnostics: diagnostics(),
          });
        }

        const rows = options.github
          ? await options.github.sourceControlStorage.installations.list({ orgId: tenant.orgId })
          : [];

        const connected = rows.length > 0;
        return c.json({
          enabled: true,
          sandboxEnabled: fleet.enabled,
          connected,
          installations: rows.map(r => ({
            installationId: Number(r.externalId),
            accountLogin: r.accountName,
            accountType: r.accountType,
          })),
          reason: connected ? 'ready' : 'not_connected',
          diagnostics: diagnostics(),
        });
      },
    }),
  );

  // Without an integration instance + state signer there is nothing the
  // remaining handlers can do — serve only the disabled `status` route
  // (mirrors the feature gate).
  if (!isGithubFeatureEnabled({ github, auth }) || !github || !stateSigner) {
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
          defaultModelId:
            input.defaultModelId ?? (await resolveFactoryDefaultModelId(options.projects, input.resourceId)),
          labels: input.labels.includes('auto-triaged') ? input.labels : [...input.labels, 'auto-triaged'],
        });
      }
    : undefined;

  routes.push(
    registerApiRoute('/web/github/subscriptions', {
      method: 'GET',
      handler: async c => {
        await auth.ensureUser(loose(c));
        const tenant = auth.tenant(loose(c));
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
        const resolved = await resolveOrgTenant(loose(c), auth);
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
        const resolved = await resolveOrgTenant(loose(c), auth);
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
        const resolved = await resolveOrgTenant(loose(c), auth);
        if ('response' in resolved) return resolved.response;

        const installs = await github.sourceControlStorage.installations.list({ orgId: resolved.tenant.orgId });

        const query = (c.req.query('q') ?? '').toLowerCase();
        const repos = [];
        const seenRepositoryIds = new Set<number>();
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
            console.error(`[Mastra Factory] pruning stale GitHub installation ${inst.externalId} (404 from GitHub)`);
            await github.sourceControlStorage.installations.delete({ orgId: resolved.tenant.orgId, id: inst.id });
            continue;
          }
          for (const repo of list) {
            if (query && !repo.fullName.toLowerCase().includes(query)) continue;
            if (seenRepositoryIds.has(repo.id)) continue;
            seenRepositoryIds.add(repo.id);
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
              sandboxProvider: fleet.provider,
              sandboxWorkdir: fleet.computeWorkdir(repo.fullName),
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
        const resolved = await resolveOrgTenant(loose(c), auth);
        if ('response' in resolved) return resolved.response;
        const { orgId, userId } = resolved.tenant;

        if (!fleet.enabled) {
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
              const result = await prepareProject({
                github,
                fleet,
                project,
                userId,
                onProgress: ev => void stream.writeSSE({ event: 'progress', data: JSON.stringify(ev) }),
              });
              await stream.writeSSE({ event: 'done', data: JSON.stringify(result) });
            } catch (err) {
              await stream.writeSSE({ event: 'error', data: JSON.stringify(ensureErrorPayload(err).body) });
            }
          });
        }

        try {
          const result = await prepareProject({ github, fleet, project, userId });
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
        const loaded = await loadOrgProject({ github, auth, c: loose(c) });
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
        const owned = await loadOwnedProject({ github, auth, fleet, c: loose(c) });
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
          defaultModelId: await resolveFactoryDefaultModelId(options.projects, project.factoryProjectId),
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
        const loaded = await loadOrgProject({ github, auth, c: loose(c) });
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
        const loaded = await loadOrgProject({ github, auth, c: loose(c) });
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
        const loaded = await loadOrgProject({ github, auth, c: loose(c) });
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

  // ── Org GitHub PATs ──────────────────────────────────────────────────────
  // Installation tokens are the wrong credential for the `gh` CLI (integration
  // -restricted endpoints 403 regardless of permissions), so orgs paste
  // classic PATs the sandboxes use instead: a `default` worker token, and an
  // optional `reviewer` token that review-board sessions use so PR reviews
  // come from a different account. Tokens are never sent back to the browser —
  // only whether each is configured.
  const parsePatKind = (value: unknown): GithubPatKind | null => {
    if (value === undefined || value === null || value === 'default') return 'default';
    if (value === 'reviewer') return 'reviewer';
    return null;
  };
  routes.push(
    registerApiRoute('/web/github/pat', {
      method: 'GET',
      requiresAuth: false,
      handler: async c => {
        const resolved = await resolveOrgTenant(loose(c), auth);
        if ('response' in resolved) return resolved.response;
        return c.json(await getGithubPatStatus(() => github.integrationStorage, resolved.tenant.orgId));
      },
    }),
    registerApiRoute('/web/github/pat', {
      method: 'POST',
      requiresAuth: false,
      handler: async c => {
        const resolved = await resolveOrgTenant(loose(c), auth);
        if ('response' in resolved) return resolved.response;

        let body: { token?: unknown; kind?: unknown };
        try {
          body = await c.req.json();
        } catch {
          return c.json({ error: 'Invalid JSON body' }, 400);
        }
        const kind = parsePatKind(body.kind);
        if (!kind) return c.json({ error: "kind must be 'default' or 'reviewer'" }, 400);
        const token = typeof body.token === 'string' ? body.token.trim() : '';
        if (!token) return c.json({ error: 'A token is required' }, 400);
        if (token.length > 500) return c.json({ error: 'Token too long (max 500 characters)' }, 400);
        if (/\s/.test(token)) return c.json({ error: 'Token must not contain whitespace' }, 400);

        await setGithubPat(github.integrationStorage, resolved.tenant.orgId, token, kind);
        return c.json(await getGithubPatStatus(() => github.integrationStorage, resolved.tenant.orgId));
      },
    }),
    registerApiRoute('/web/github/pat', {
      method: 'DELETE',
      requiresAuth: false,
      handler: async c => {
        const resolved = await resolveOrgTenant(loose(c), auth);
        if ('response' in resolved) return resolved.response;
        const kind = parsePatKind(c.req.query('kind'));
        if (!kind) return c.json({ error: "kind must be 'default' or 'reviewer'" }, 400);
        await clearGithubPat(github.integrationStorage, resolved.tenant.orgId, kind);
        return c.json(await getGithubPatStatus(() => github.integrationStorage, resolved.tenant.orgId));
      },
    }),
  );

  // ── Sessions / commit / push / PR ────────────────────────────────────────
  routes.push(...buildProjectGitRoutes({ github, auth, fleet, storage, emitAudit }));

  return routes;
}

/**
 * Load the org-owned project for a read-only GitHub API route. Unlike
 * `loadOwnedProject`, this never touches sandbox state — the issues/PR list
 * routes only need the repo + installation, so they work before a sandbox is
 * ever provisioned.
 */
async function loadOrgProject(options: {
  github: GithubIntegration;
  auth: RouteAuth;
  c: RouteContext;
}): Promise<{ project: ResolvedProjectRepository; userId: string } | { response: Response }> {
  const { github, auth, c } = options;
  const resolved = await resolveOrgTenant(c, auth);
  if ('response' in resolved) return { response: resolved.response };
  const { orgId, userId } = resolved.tenant;

  const projectRepositoryId = c.req.param('id');
  if (!projectRepositoryId) {
    return { response: c.json({ error: 'Project repository not found' }, 404) };
  }
  const project = await resolveProjectRepository({ github, orgId, projectRepositoryId });
  if (!project) {
    return { response: c.json({ error: 'Project repository not found' }, 404) };
  }
  return { project, userId };
}

/** Derive a commit/author identity from the authenticated host user. */
function identityFromUser(user: unknown): GitIdentity {
  const u = user as { name?: string; email?: string } | null | undefined;
  return { name: u?.name ?? null, email: u?.email ?? null };
}

/**
 * Resolve a live, started sandbox for the caller's per-user sandbox binding. The
 * sandbox must already have been provisioned (`sandboxId` set) — the git write
 * routes never clone, they operate on the existing checkout.
 */
async function resolveProjectSandbox(options: {
  fleet: SandboxFleet;
  sandboxRow: ProjectRepositorySandbox;
}): Promise<MaterializationSandbox> {
  const { fleet, sandboxRow } = options;
  if (!sandboxRow.sandboxId) {
    throw new MaterializeError('Project sandbox is not provisioned. Open the project first.', 'clone-failed');
  }
  return fleet.reattachSandbox(sandboxRow.sandboxId);
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
async function prepareProject(options: {
  github: GithubIntegration;
  fleet: SandboxFleet;
  project: ResolvedProjectRepository;
  userId: string;
  onProgress?: ProgressFn;
}): Promise<EnsureResult> {
  const { github, fleet, project, userId, onProgress } = options;
  const sandboxRow = await loadOrCreateSandboxRow(github, project, userId);
  const access = await github.versionControl.getRepositoryAccess({
    orgId: project.installation.orgId,
    repositoryId: project.repository.id,
  });
  if (!access.authorization) {
    throw new MaterializeError('Repository access did not include a bearer token.', 'clone-failed');
  }
  // The sandbox env token feeds the `gh` CLI — a configured org PAT wins
  // there. Git clone/pull below keep the minted installation token.
  const ghCliToken =
    (await getGithubPat(() => github.integrationStorage, project.installation.orgId)) ?? access.authorization.token;
  const sandbox = await ensureProjectSandbox({
    fleet,
    row: sandboxRow,
    storage: github.sourceControlStorage.sandboxes,
    token: ghCliToken,
    onProgress,
  });
  // Re-read the sandbox binding so we have the freshly persisted sandboxId.
  const fresh = await github.sourceControlStorage.sandboxes.getById({ id: sandboxRow.id });
  const finalRow = fresh ?? sandboxRow;
  await materializeRepo({
    row: finalRow,
    repoInfo: { repoFullName: project.repository.slug, defaultBranch: project.defaultBranch },
    sandbox,
    token: access.authorization.token,
    storage: github.sourceControlStorage.sandboxes,
    onProgress,
  });
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
async function loadOwnedProject(options: {
  github: GithubIntegration;
  auth: RouteAuth;
  fleet: SandboxFleet;
  c: RouteContext;
}): Promise<
  | { orgId: string; userId: string; project: ResolvedProjectRepository; sandboxRow: ProjectRepositorySandbox }
  | { response: Response }
> {
  const { github, auth, fleet, c } = options;
  const resolved = await resolveOrgTenant(c, auth);
  if ('response' in resolved) return { response: resolved.response };
  const { orgId, userId } = resolved.tenant;

  if (!fleet.enabled) {
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
  auth,
  fleet,
  storage,
  emitAudit,
}: {
  github: GithubIntegration;
  auth: RouteAuth;
  fleet: SandboxFleet;
  storage?: FactoryStorage;
  emitAudit?: AuditEmitter['emit'];
}): ApiRoute[] {
  return [
    // ── Create / list Factory sessions ──────────────────────────────────────
    registerApiRoute('/web/github/projects/:id/sessions', {
      method: 'GET',
      requiresAuth: false,
      handler: async c => {
        const resolved = await resolveOrgTenant(loose(c), auth);
        if ('response' in resolved) return resolved.response;
        const { orgId, userId } = resolved.tenant;
        const projectRepositoryId = c.req.param('id');
        const project = projectRepositoryId
          ? await resolveProjectRepository({ github, orgId, projectRepositoryId })
          : null;
        if (!project) return c.json({ error: 'Project repository not found' }, 404);
        const sessions = await github.sourceControlStorage.sessions.list({ projectRepositoryId: project.id, userId });
        return c.json({ sessions });
      },
    }),
    registerApiRoute('/web/github/projects/:id/sessions', {
      method: 'POST',
      requiresAuth: false,
      handler: async c => {
        const resolved = await resolveOrgTenant(loose(c), auth);
        if ('response' in resolved) return resolved.response;
        const { orgId, userId } = resolved.tenant;
        const projectRepositoryId = c.req.param('id');
        const project = projectRepositoryId
          ? await resolveProjectRepository({ github, orgId, projectRepositoryId })
          : null;
        if (!project) return c.json({ error: 'Project repository not found' }, 404);
        let body: { branch?: unknown; baseBranch?: unknown };
        try {
          body = await c.req.json();
        } catch {
          return c.json({ error: 'Invalid JSON body' }, 400);
        }
        if (!isValidGitRefSandbox(body.branch)) return c.json({ error: 'Invalid branch' }, 400);
        const baseBranch = body.baseBranch === undefined ? project.defaultBranch : body.baseBranch;
        if (!isValidGitRefSandbox(baseBranch)) return c.json({ error: 'Invalid baseBranch' }, 400);
        const session = await github.sourceControlStorage.sessions.create({
          sessionId: randomUUID(),
          projectRepositoryId: project.id,
          orgId,
          userId,
          branch: body.branch,
          baseBranch,
        });
        return c.json({ session });
      },
    }),
    registerApiRoute('/web/user-sessions/:sessionId', {
      method: 'GET',
      requiresAuth: false,
      handler: async c => {
        const resolved = await resolveOrgTenant(loose(c), auth);
        if ('response' in resolved) return resolved.response;
        const session = await github.sourceControlStorage.sessions.getBySessionId(c.req.param('sessionId'));
        if (!session || session.orgId !== resolved.tenant.orgId || session.userId !== resolved.tenant.userId) {
          return c.json({ error: 'Session not found' }, 404);
        }
        return c.json({ session });
      },
    }),
    registerApiRoute('/web/user-sessions/:sessionId', {
      method: 'DELETE',
      requiresAuth: false,
      handler: async c => {
        const resolved = await resolveOrgTenant(loose(c), auth);
        if ('response' in resolved) return resolved.response;
        const session = await github.sourceControlStorage.sessions.getBySessionId(c.req.param('sessionId'));
        if (!session || session.orgId !== resolved.tenant.orgId || session.userId !== resolved.tenant.userId) {
          return c.json({ error: 'Session not found' }, 404);
        }
        let sandbox: MaterializationSandbox | undefined;
        if (session.sandboxId) {
          try {
            sandbox = await fleet.reattachSandbox(session.sandboxId);
          } catch {
            // The provider may already have reclaimed the sandbox.
          }
          await fleet.teardownSandbox(
            {
              sandboxId: session.sandboxId,
              setSandboxId: async () => {},
              clear: async () => {
                await github.sourceControlStorage.sessions.setSandbox({
                  id: session.id,
                  sandboxId: null,
                  sandboxWorkdir: session.sandboxWorkdir ?? '',
                });
              },
            },
            sandbox,
          );
        }
        await github.sourceControlStorage.sessions.delete(session.id);
        return c.json({ removed: true });
      },
    }),

    // ── Stage all + commit inside a Factory session workspace ──────────────
    registerApiRoute('/web/github/projects/:id/commit', {
      method: 'POST',
      requiresAuth: false,
      handler: async c => {
        const owned = await loadOwnedProject({ github, auth, fleet, c: loose(c) });
        if ('response' in owned) return owned.response;
        const { userId, project } = owned;

        let body: { message?: unknown; sessionId?: unknown };
        try {
          body = await c.req.json();
        } catch {
          return c.json({ error: 'Invalid JSON body' }, 400);
        }
        if (typeof body.message !== 'string' || body.message.trim().length === 0 || body.message.length > 5000) {
          return c.json({ error: 'Invalid message' }, 400);
        }
        const sessionWorkspace = await resolveSessionWorkspace(github, project.id, userId, body.sessionId);
        if (!sessionWorkspace) {
          return c.json({ error: 'Invalid sessionId' }, 400);
        }
        const { workdir, sandboxBinding } = sessionWorkspace;

        try {
          return await withProjectLock({
            key: `${project.id}:${userId}`,
            storage,
            fn: async (_signal, steps) => {
              const sandbox = await steps.step('fleet.resolveSandbox', () =>
                resolveProjectSandbox({ fleet, sandboxRow: sandboxBinding }),
              );
              const identity = identityFromUser(await steps.step('auth.ensureUser', () => auth.ensureUser(loose(c))));
              const result = await steps.step('sandbox.commitAll', () =>
                commitAll(sandbox, workdir, body.message as string, identity),
              );
              if (result.committed && emitAudit) {
                await steps.step('audit.git.commit', () =>
                  emitAudit({
                    context: loose(c),
                    input: {
                      action: 'factory.git.commit',
                      factoryProjectId: project.factoryProjectId,
                      projectRepositoryId: project.id,
                      targets: [{ type: 'session', id: sessionWorkspace.session.sessionId }],
                      metadata: { sessionId: sessionWorkspace.session.sessionId },
                    },
                  }),
                );
              }
              return c.json({ committed: result.committed });
            },
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
        const owned = await loadOwnedProject({ github, auth, fleet, c: loose(c) });
        if ('response' in owned) return owned.response;
        const { orgId, userId, project } = owned;

        let body: { branch?: unknown; sessionId?: unknown };
        try {
          body = await c.req.json();
        } catch {
          return c.json({ error: 'Invalid JSON body' }, 400);
        }
        if (!isValidGitRefSandbox(body.branch)) {
          return c.json({ error: 'Invalid branch' }, 400);
        }
        const branch = body.branch;
        const sessionWorkspace = await resolveSessionWorkspace(github, project.id, userId, body.sessionId);
        if (!sessionWorkspace) {
          return c.json({ error: 'Invalid sessionId' }, 400);
        }
        const { workdir, sandboxBinding } = sessionWorkspace;

        try {
          return await withProjectLock({
            key: `${project.id}:${userId}`,
            storage,
            fn: async (_signal, steps) => {
              const sandbox = await steps.step('fleet.resolveSandbox', () =>
                resolveProjectSandbox({ fleet, sandboxRow: sandboxBinding }),
              );
              const access = await steps.step('github.getRepositoryAccess', () =>
                github.versionControl.getRepositoryAccess({
                  orgId,
                  repositoryId: project.repository.id,
                }),
              );
              if (!access.authorization) throw new Error('Repository access did not include a bearer token.');
              await steps.step('sandbox.pushBranch', () =>
                pushBranch(sandbox, workdir, branch, access.authorization!.token, project.repository.slug),
              );
              if (emitAudit) {
                await steps.step('audit.git.push', () =>
                  emitAudit({
                    context: loose(c),
                    input: {
                      action: 'factory.git.push',
                      factoryProjectId: project.factoryProjectId,
                      projectRepositoryId: project.id,
                      targets: [{ type: 'branch', id: branch }],
                      metadata: { branch, sessionId: sessionWorkspace.session.sessionId },
                    },
                  }),
                );
              }
              return c.json({ pushed: true, branch });
            },
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
        const owned = await loadOwnedProject({ github, auth, fleet, c: loose(c) });
        if ('response' in owned) return owned.response;
        const { orgId, userId, project } = owned;

        let body: {
          branch?: unknown;
          base?: unknown;
          title?: unknown;
          body?: unknown;
          sessionId?: unknown;
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
        const sessionWorkspace = await resolveSessionWorkspace(github, project.id, userId, body.sessionId);
        if (!sessionWorkspace) {
          return c.json({ error: 'Invalid sessionId' }, 400);
        }

        try {
          return await withProjectLock({
            key: `${project.id}:${userId}`,
            storage,
            fn: async (_signal, steps) => {
              const result = await steps.step('github.createPullRequest', () =>
                github.versionControl.createPullRequest({
                  connection: {
                    type: 'app-installation',
                    installationId: Number(project.installation.externalId),
                  },
                  sourceId: project.repository.slug,
                  baseBranch: base,
                  headBranch: head,
                  title,
                  body: prBody,
                  actingUserId: userId,
                }),
              );
              if (emitAudit) {
                await steps.step('audit.git.pr_opened', () =>
                  emitAudit({
                    context: loose(c),
                    input: {
                      action: 'factory.git.pr_opened',
                      factoryProjectId: project.factoryProjectId,
                      projectRepositoryId: project.id,
                      targets: [{ type: 'pull_request', id: result.url, name: title }],
                      metadata: { branch: head, base, url: result.url },
                    },
                  }),
                );
              }
              const pullRequestNumber = pullRequestNumberFromUrl(result.url, project.repository.slug);
              if (pullRequestNumber) {
                const sessionId = sessionWorkspace.session.sessionId;
                await steps.step('storage.subscribeToPullRequest', () =>
                  subscribeToPullRequest(
                    {
                      orgId,
                      installationExternalId: project.installation.externalId,
                      projectRepositoryId: project.id,
                      repositoryExternalId: project.repository.externalId,
                      repositorySlug: project.repository.slug,
                      changeRequestId: pullRequestNumber.toString(),
                      sessionId,
                      ownerId: userId,
                      resourceId: sessionId,
                      threadId: sessionId,
                      source: 'factory-pr-create',
                      subscribedByUserId: userId,
                    },
                    github.integrationStorage,
                  ).catch((error: unknown) => {
                    console.warn(
                      `[GitHub] Pull request ${result.url} was created but automatic subscription failed.`,
                      error,
                    );
                  }),
                );
              }
              return c.json({ url: result.url });
            },
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
        const owned = await loadOwnedProject({ github, auth, fleet, c: loose(c) });
        if ('response' in owned) return owned.response;
        const { userId, project, sandboxRow } = owned;

        if (!sandboxRow.sandboxId) {
          // Nothing provisioned for this user — idempotent success.
          return c.json({ tornDown: false });
        }

        try {
          return await withProjectLock({
            key: `${project.id}:${userId}`,
            storage,
            fn: async (_signal, steps) => {
              const sandbox = await steps.step('fleet.reattachSandbox', () =>
                fleet.reattachSandbox(sandboxRow.sandboxId!),
              );
              await steps.step('sandbox.teardown', () =>
                teardownProjectSandbox({
                  fleet,
                  row: sandboxRow,
                  storage: github.sourceControlStorage.sandboxes,
                  sandbox,
                }),
              );
              return c.json({ tornDown: true });
            },
          });
        } catch (err) {
          return gitErrorResponse(loose(c), err);
        }
      },
    }),
  ];
}

/** Resolve the materialized workspace owned by a Factory session. */
async function resolveSessionWorkspace(
  github: GithubIntegration,
  projectId: string,
  userId: string,
  sessionId: unknown,
) {
  if (typeof sessionId !== 'string') {
    return undefined;
  }
  const session = await github.sourceControlStorage.sessions.getBySessionId(sessionId);
  if (
    session?.projectRepositoryId !== projectId ||
    session.userId !== userId ||
    !session.sandboxId ||
    !session.sandboxWorkdir
  ) {
    return undefined;
  }
  return {
    session,
    workdir: session.sandboxWorkdir,
    sandboxBinding: {
      id: session.id,
      projectRepositoryId: session.projectRepositoryId,
      userId: session.userId,
      sandboxId: session.sandboxId,
      sandboxWorkdir: session.sandboxWorkdir,
      materializedAt: session.materializedAt,
      createdAt: session.createdAt,
    },
  };
}

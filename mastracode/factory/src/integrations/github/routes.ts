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
import { resolveModel } from '@mastra/code-sdk/agents/model';
import { RequestContext } from '@mastra/core/request-context';
import type { ApiRoute, IUserProvider } from '@mastra/core/server';
import { registerApiRoute } from '@mastra/core/server';
import { UniqueViolationError } from '@mastra/core/storage';
import type { FactoryStorage } from '@mastra/core/storage';
import type { Context } from 'hono';
import type { RouteAuth } from '../../routes/route.js';
import { requireExec } from '../../sandbox/materialization.js';
import type { ExecutableSandbox } from '../../sandbox/materialization.js';
import type { MastraFactorySandboxConfig } from '../../sandbox/session-sandbox.js';
import { peekSessionSandbox } from '../../sandbox/session-sandbox.js';
import { sanitizeSegment } from '../../sandbox/workdir.js';
import { normalizeSessionTitle } from '../../session/session-title.js';
import type { StateSigner } from '../../state-signing.js';
import type { AuditEmitter } from '../../storage/domains/audit/domain.js';
import type { MemorySettingsStorage } from '../../storage/domains/memory-settings/base.js';
import type { FactoryProjectsStorage } from '../../storage/domains/projects/base.js';
import type {
  ProjectRepository,
  ProjectSourceControlConnection,
  SourceControlInstallation,
  SourceControlRepository,
} from '../../storage/domains/source-control/base.js';
import { listRepositoryCommits } from './commits.js';
import { getGithubFeatureDiagnostics, isGithubFeatureEnabled } from './config.js';
import type { GithubIntegration } from './integration.js';
import { clearGithubPat, getGithubPat, getGithubPatStatus, setGithubPat } from './pat.js';
import type { GithubPatKind } from './pat.js';

import { reclaimDeletedSessionSandbox } from './sandbox-release.js';
import {
  commitAll,
  isValidGitRef as isValidGitRefSandbox,
  MaterializeError,
  pushBranch,
  SetupCommandError,
} from './sandbox.js';
import type { GitIdentity } from './sandbox.js';

const sessionOperationLocks = new Map<string, Promise<unknown>>();
const USER_SESSION_BRANCH_PREFIX = 'user/session-';
// lowercase only (crypto.randomUUID output), so casing cannot fork one logical ID into two sessions
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
/**
 * Serialize same-session mutations within one Factory process. Factory sessions
 * normally issue these operations sequentially, so this lock is probably not
 * necessary; keep the cheap local guard until that invariant is enforced by
 * the request protocol. It intentionally does not consume a database connection.
 */
function withSessionOperationLock<T>(sessionId: string, fn: () => Promise<T>): Promise<T> {
  const previous = sessionOperationLocks.get(sessionId) ?? Promise.resolve();
  const next = previous.then(fn, fn);
  const tail = next.then(
    () => undefined,
    () => undefined,
  );
  sessionOperationLocks.set(sessionId, tail);
  void tail.then(() => {
    if (sessionOperationLocks.get(sessionId) === tail) sessionOperationLocks.delete(sessionId);
  });
  return next;
}
import { listPullRequestSubscriptionsForThread, subscribeToPullRequest } from './subscriptions.js';
import { handleGithubWebhook } from './webhook.js';
import type { ParsedGithubWebhook } from './webhook.js';

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
  /** Optional user directory used to resolve session-owner display profiles. */
  users?: SessionOwnerUserProvider;
  /**
   * The host's session-sandbox callback. Routes only read whether it is
   * configured: without one, `/web/github/status` reports
   * `sandboxEnabled: false` and sandbox-backed routes respond 503. Sandboxes
   * themselves are constructed per session and started lazily elsewhere.
   */
  sandbox?: MastraFactorySandboxConfig;
  /** Factory storage backend used for the `appDbConfigured` diagnostic. */
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
  /** Owner-scoped observational-memory settings — the source of the model that names a thread. */
  memorySettings: Pick<MemorySettingsStorage, 'get'>;
  /** Best-effort audit emission supplied by the factory-owned audit domain. */
  emitAudit?: AuditEmitter['emit'];
  /** Factory projects domain — resolves a project's default triage model. */
  projects?: FactoryProjectsStorage;
  sessionRetirement?: import('../../sandbox/session-retirement.js').SessionRetirementCoordinator;
  /** Work-items domain — session deletion strips the refs work items hold on it. */
  workItems?: Pick<import('../../storage/domains/work-items/base.js').WorkItemsStorage, 'clearSessionReferences'>;
  /** Authoritative Factory rule ingress for normalized, signature-verified GitHub deliveries. */
  ingestFactoryEvent?: (event: ParsedGithubWebhook) => Promise<unknown>;
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

/**
 * Validate a git branch/ref name against a strict whitelist. The value is later
 * interpolated into a shell `git clone --branch` command, so it must never
 * contain shell metacharacters. We accept only git-ref-safe characters and
 * reject anything else rather than relying on shell quoting alone.
 */
function isValidGitRef(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= 255 && /^[A-Za-z0-9_./-]+$/.test(value);
}

function isJsonObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
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

function parseResourceNumber(raw: string | undefined): number | null {
  if (raw === undefined || !/^\d{1,10}$/.test(raw)) return null;
  const parsed = Number(raw);
  return parsed > 0 ? parsed : null;
}

const VALID_ISSUE_LABEL_FILTERS = new Set(['status: auto-triaged', 'status: needs approval']);

function parseIssueLabelFilter(raw: string | undefined): string | undefined | null {
  if (raw === undefined || raw === '') return undefined;
  if (VALID_ISSUE_LABEL_FILTERS.has(raw)) return raw;
  return null;
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
    assignee: string | null;
    assignees?: string[];
    labels: string[];
    createdAt: string;
  },
): ParsedGithubWebhook {
  const repositoryId = Number(project.repository.externalId);
  const assigneeLogins = issue.assignees ?? (issue.assignee ? [issue.assignee] : []);
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
        assignees: assigneeLogins.map(login => ({ login })),
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
    assignees: string[];
    requestedReviewers: string[];
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
        assignees: pullRequest.assignees.map(login => ({ login })),
        requested_reviewers: pullRequest.requestedReviewers.map(login => ({ login })),
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
  const {
    auth,
    sandbox,
    users,
    storage,
    github,
    stateSigner,
    controller,
    memorySettings,
    emitAudit,
    sessionRetirement,
    workItems,
  } = options;
  const diagnostics = () =>
    getGithubFeatureDiagnostics({ github, auth, appDbConfigured: storage !== undefined, stateSigner, sandbox });

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
            sandboxEnabled: !!sandbox,
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
          sandboxEnabled: !!sandbox,
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

        const orgId = resolved.tenant.orgId;
        const installs = await github.sourceControlStorage.installations.list({ orgId });

        const query = (c.req.query('q') ?? '').toLowerCase();
        // List every installation's repositories in parallel — installations
        // are independent upstream calls, and serial listing multiplied
        // worst-case latency by installation count.
        const listed = await Promise.all(
          installs.map(async inst => {
            try {
              return { inst, list: await github.listInstallationRepos(Number(inst.externalId)) };
            } catch (err) {
              // GitHub 404s when the installation no longer exists for this app
              // (app uninstalled/reinstalled, or the row was recorded under
              // different app credentials). Prune the stale row so `/status`
              // reflects reality and the UI prompts a reconnect, then keep
              // listing the remaining installations.
              if ((err as { status?: number }).status !== 404) throw err;
              console.error(`[Mastra Factory] pruning stale GitHub installation ${inst.externalId} (404 from GitHub)`);
              await github.sourceControlStorage.installations.delete({ orgId, id: inst.id });
              return { inst, list: [] };
            }
          }),
        );

        // Filter + dedupe by repo id in installation order — same result
        // ordering as the previous serial loop.
        const matches = [];
        const seenRepositoryIds = new Set<number>();
        for (const { inst, list } of listed) {
          for (const repo of list) {
            if (query && !repo.fullName.toLowerCase().includes(query)) continue;
            if (seenRepositoryIds.has(repo.id)) continue;
            seenRepositoryIds.add(repo.id);
            matches.push({ inst, repo });
          }
        }

        // Mirror matches into storage with bounded concurrency instead of one
        // awaited upsert per repository.
        const repos = new Array(matches.length);
        const upsertConcurrency = 10;
        for (let start = 0; start < matches.length; start += upsertConcurrency) {
          await Promise.all(
            matches.slice(start, start + upsertConcurrency).map(async ({ inst, repo }, offset) => {
              const repository = await github.sourceControlStorage.repositories.upsert({
                orgId,
                input: {
                  installationId: inst.id,
                  externalId: repo.id.toString(),
                  slug: repo.fullName,
                  defaultBranch: isValidGitRef(repo.defaultBranch) ? repo.defaultBranch : 'main',
                  providerMetadata: { private: repo.private, owner: repo.owner },
                },
              });
              repos[start + offset] = {
                ...repo,
                installationStorageId: inst.id,
                repositoryStorageId: repository.id,
                sandboxProvider: sandbox ? 'custom' : 'none',
                // Display only — the runtime workdir is resolved from the
                // live sandbox at open time, never read from this row. Repos
                // clone into the VM's home; `~/<repo>` is the honest
                // listing-time guess.
                sandboxWorkdir: `~/${sanitizeSegment(repo.fullName.split('/', 2)[1] || 'repo')}`,
              };
            }),
          );
        }
        return c.json({ repos });
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
            assignee: issue.assignee,
            assignees: issue.assignees,
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

  routes.push(
    registerApiRoute('/web/github/projects/:id/issues/:number', {
      method: 'GET',
      requiresAuth: false,
      handler: async c => {
        const loaded = await loadOrgProject({ github, auth, c: loose(c) });
        if ('response' in loaded) return loaded.response;
        const number = parseResourceNumber(c.req.param('number'));
        if (number === null) return c.json({ error: 'invalid_number' }, 400);
        try {
          const detail = await github.intake.getIssue({
            connection: {
              type: 'app-installation',
              installationId: Number(loaded.project.installation.externalId),
            },
            sourceId: loaded.project.repository.slug,
            issueId: String(number),
          });
          if (detail === null) return c.json({ error: 'issue_not_found' }, 404);
          return c.json({
            number: Number(detail.id),
            title: detail.title,
            url: detail.url,
            author: detail.author,
            assignee: detail.assignee,
            labels: detail.labels,
            comments: detail.commentCount ?? 0,
            createdAt: detail.createdAt,
            updatedAt: detail.updatedAt,
            description: detail.description,
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
            assignees: pr.assignees ?? [],
            requestedReviewers: pr.requestedReviewers ?? [],
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

  routes.push(
    registerApiRoute('/web/github/projects/:id/prs/:number', {
      method: 'GET',
      requiresAuth: false,
      handler: async c => {
        const loaded = await loadOrgProject({ github, auth, c: loose(c) });
        if ('response' in loaded) return loaded.response;
        const number = parseResourceNumber(c.req.param('number'));
        if (number === null) return c.json({ error: 'invalid_number' }, 400);
        try {
          const pr = await github.versionControl.getPullRequest({
            connection: {
              type: 'app-installation',
              installationId: Number(loaded.project.installation.externalId),
            },
            sourceId: loaded.project.repository.slug,
            pullRequestId: String(number),
          });
          if (pr === null) return c.json({ error: 'pull_request_not_found' }, 404);
          return c.json({
            number: Number(pr.id),
            title: pr.title,
            url: pr.url,
            author: pr.author,
            assignees: pr.assignees ?? [],
            requestedReviewers: pr.requestedReviewers ?? [],
            baseBranch: pr.baseBranch,
            headBranch: pr.headBranch,
            createdAt: pr.createdAt,
            updatedAt: pr.updatedAt,
            description: pr.body,
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
        return c.json({
          setupCommand: loaded.project.setupCommand,
          teardownCommand: loaded.project.teardownCommand,
        });
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

        let body: { setupCommand?: unknown; teardownCommand?: unknown };
        try {
          body = await c.req.json();
        } catch {
          return c.json({ error: 'Invalid JSON body' }, 400);
        }

        const commands = ['setupCommand', 'teardownCommand'] as const;
        for (const command of commands) {
          const value = body[command];
          if (value === undefined) continue;
          if (value !== null && typeof value !== 'string') {
            return c.json({ error: `Invalid ${command}` }, 400);
          }
          if (typeof value === 'string' && value.length > 2000) {
            return c.json({ error: `${command} too long (max 2000 characters)` }, 400);
          }
          // Reject control characters (except newline/tab). Commands are shell
          // scripts by design, but escape sequences and NULs can spoof logs or
          // confuse the sandbox shell.
          if (typeof value === 'string' && /[\0-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(value)) {
            return c.json({ error: `${command} contains control characters` }, 400);
          }
        }

        const normalizeCommand = (value: unknown): string | null | undefined => {
          if (value === undefined) return undefined;
          return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
        };
        const setupCommand = normalizeCommand(body.setupCommand);
        const teardownCommand = normalizeCommand(body.teardownCommand);

        await github.sourceControlStorage.projectRepositories.update({
          orgId: loaded.project.installation.orgId,
          id: loaded.project.id,
          input: {
            ...(setupCommand !== undefined ? { setupCommand } : {}),
            ...(teardownCommand !== undefined ? { teardownCommand } : {}),
          },
        });
        return c.json({
          setupCommand: setupCommand === undefined ? loaded.project.setupCommand : setupCommand,
          teardownCommand: teardownCommand === undefined ? loaded.project.teardownCommand : teardownCommand,
        });
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
  routes.push(
    ...buildProjectGitRoutes({
      github,
      auth,
      sandbox,
      users,
      controller,
      memorySettings,
      emitAudit,
      sessionRetirement,
      workItems,
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
async function loadOrgProject(options: {
  github: GithubIntegration;
  auth: RouteAuth;
  c: RouteContext;
}): Promise<{ project: ResolvedProjectRepository; orgId: string; userId: string } | { response: Response }> {
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
  return { project, orgId, userId };
}

/** Derive a commit/author identity from the authenticated host user. */
function identityFromUser(user: unknown): GitIdentity {
  const u = user as { name?: string; email?: string } | null | undefined;
  return { name: u?.name ?? null, email: u?.email ?? null };
}

/** Map a sandbox/setup-command error to an actionable HTTP response. */
function gitErrorResponse(c: Context, err: unknown) {
  if (err instanceof SetupCommandError) {
    return c.json({ error: err.code, message: err.message }, 502);
  }
  if (err instanceof MaterializeError) {
    return c.json({ error: err.code, message: err.message }, 502);
  }
  return c.json({ error: 'git_failed', message: err instanceof Error ? err.message : String(err) }, 500);
}

/**
 * Load the org-owned project for a git route. Centralizes the auth +
 * org/ownership checks every git route shares: the project is scoped by
 * `(id, orgId)`. Returns the tenant and project, or a ready-to-return error
 * response.
 */
async function loadOwnedProject(options: {
  github: GithubIntegration;
  auth: RouteAuth;
  sandbox?: MastraFactorySandboxConfig;
  c: RouteContext;
}): Promise<
  { orgId: string; userId: string; project: ResolvedProjectRepository } | { response: Response }
> {
  const { github, auth, sandbox, c } = options;
  const resolved = await resolveOrgTenant(c, auth);
  if ('response' in resolved) return { response: resolved.response };
  const { orgId, userId } = resolved.tenant;

  if (!sandbox) {
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
  return { orgId, userId, project };
}

/**
 * One naming per session at a time: a second caller joins the run already in
 * flight instead of paying for another model call and racing its rename.
 */
function createSessionNaming() {
  const inFlight = new Map<string, Promise<string | null>>();
  return (sessionId: string, run: () => Promise<string | null>) => {
    const pending = inFlight.get(sessionId);
    if (pending) return pending;
    const started = run().finally(() => inFlight.delete(sessionId));
    inFlight.set(sessionId, started);
    return started;
  };
}

/**
 * Name a thread with a stored model id. Resolution has to go through
 * mastracode's gateway: a bare id handed to core's model router looks for a
 * process env key instead of the caller's stored provider credentials.
 */
function titleModel(modelId: string) {
  return ({ requestContext }: { requestContext: RequestContext }) =>
    resolveModel(modelId, { remapForCodexOAuth: true, requestContext });
}

interface SessionOwnerProfile {
  id: string;
  name: string;
  avatarUrl?: string;
}

type SessionOwnerUserProvider = Pick<IUserProvider, 'getUser'> & Partial<Pick<IUserProvider, 'getUsers'>>;

/** A screenful of history; GitHub caps its own page at 100. */
const DEFAULT_COMMIT_PAGE = 20;
const MAX_COMMIT_PAGE = 100;

const MAX_SESSION_OWNER_PROFILES = 100;
const MAX_SESSION_OWNER_PROFILE_CACHE_ENTRIES = 500;
const SESSION_OWNER_PROFILE_TTL_MS = 5 * 60_000;

function createSessionOwnerProfileResolver(users: SessionOwnerUserProvider | undefined) {
  const cache = new Map<string, { profile?: SessionOwnerProfile; expiresAt: number }>();
  const cacheProfile = (userId: string, profile: SessionOwnerProfile | undefined, expiresAt: number) => {
    cache.delete(userId);
    cache.set(userId, { profile, expiresAt });
    if (cache.size > MAX_SESSION_OWNER_PROFILE_CACHE_ENTRIES) {
      const oldestUserId = cache.keys().next().value;
      if (oldestUserId !== undefined) cache.delete(oldestUserId);
    }
  };

  return async (userIds: string[]): Promise<Map<string, SessionOwnerProfile>> => {
    if (!users) return new Map();

    const requestedUserIds = [...new Set(userIds)].slice(0, MAX_SESSION_OWNER_PROFILES);
    const profiles = new Map<string, SessionOwnerProfile>();
    const unresolvedUserIds: string[] = [];
    const now = Date.now();

    for (const userId of requestedUserIds) {
      const cached = cache.get(userId);
      if (!cached || cached.expiresAt <= now) {
        cache.delete(userId);
        unresolvedUserIds.push(userId);
      } else if (cached.profile) {
        profiles.set(userId, cached.profile);
      }
    }

    if (unresolvedUserIds.length === 0) return profiles;

    let resolvedUsers: Array<Awaited<ReturnType<SessionOwnerUserProvider['getUser']>>>;
    if (users.getUsers) {
      try {
        resolvedUsers = await users.getUsers(unresolvedUserIds);
      } catch (error) {
        console.warn('[GitHub Sessions] Bulk session owner profile lookup failed; falling back to individual lookups', {
          error: error instanceof Error ? error.message : String(error),
        });
        resolvedUsers = (await Promise.allSettled(unresolvedUserIds.map(userId => users.getUser(userId))))
          .filter(result => result.status === 'fulfilled')
          .map(result => result.value);
      }
    } else {
      resolvedUsers = (await Promise.allSettled(unresolvedUserIds.map(userId => users.getUser(userId))))
        .filter(result => result.status === 'fulfilled')
        .map(result => result.value);
    }

    for (const user of resolvedUsers) {
      if (!user) continue;
      const name = user.name?.trim() || user.email?.trim();
      if (!name) continue;
      profiles.set(user.id, {
        id: user.id,
        name,
        ...(user.avatarUrl ? { avatarUrl: user.avatarUrl } : {}),
      });
    }

    const expiresAt = now + SESSION_OWNER_PROFILE_TTL_MS;
    for (const userId of unresolvedUserIds) {
      cacheProfile(userId, profiles.get(userId), expiresAt);
    }
    return profiles;
  };
}

function buildProjectGitRoutes({
  github,
  auth,
  sandbox,
  users,
  controller,
  memorySettings,
  emitAudit,
  sessionRetirement,
  workItems,
}: {
  github: GithubIntegration;
  auth: RouteAuth;
  sandbox?: MastraFactorySandboxConfig;
  users?: SessionOwnerUserProvider;
  controller?: MountedMastraCode['controller'];
  memorySettings: MountGithubRoutesOptions['memorySettings'];
  emitAudit?: AuditEmitter['emit'];
  sessionRetirement?: MountGithubRoutesOptions['sessionRetirement'];
  workItems?: MountGithubRoutesOptions['workItems'];
}): ApiRoute[] {
  const nameSession = createSessionNaming();
  const resolveSessionOwnerProfiles = createSessionOwnerProfileResolver(users);
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
        const sessions = await github.sourceControlStorage.sessions.list({
          projectRepositoryId: project.id,
          viewerUserId: userId,
        });
        const owners = await resolveSessionOwnerProfiles(sessions.map(session => session.userId));
        return c.json({
          sessions: sessions.map(session => {
            const owner = owners.get(session.userId);
            return { ...session, ...(owner ? { owner } : {}) };
          }),
        });
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
        let body: unknown;
        try {
          body = await c.req.json();
        } catch {
          return c.json({ error: 'Invalid JSON body' }, 400);
        }
        if (!isJsonObject(body)) return c.json({ error: 'Invalid JSON body' }, 400);
        const requestedBaseBranch = body.baseBranch;
        if (requestedBaseBranch !== undefined && typeof requestedBaseBranch !== 'string') {
          return c.json({ error: 'Invalid baseBranch' }, 400);
        }
        const baseBranch = requestedBaseBranch ?? project.defaultBranch;
        if (!isValidGitRefSandbox(baseBranch)) return c.json({ error: 'Invalid baseBranch' }, 400);

        const requestedSessionId = body.sessionId;
        if (
          requestedSessionId !== undefined &&
          (typeof requestedSessionId !== 'string' || !UUID_PATTERN.test(requestedSessionId))
        ) {
          return c.json({ error: 'Invalid sessionId' }, 400);
        }
        const sessionId = requestedSessionId ?? randomUUID();

        const requestedTitle = body.title;
        if (requestedTitle !== undefined && typeof requestedTitle !== 'string') {
          return c.json({ error: 'Invalid title' }, 400);
        }
        const normalizedTitle = requestedTitle === undefined ? null : normalizeSessionTitle(requestedTitle);

        const requestedBranch = body.branch;
        let branch: string;
        if (requestedBranch === undefined) {
          branch = `${USER_SESSION_BRANCH_PREFIX}${sessionId}`;
        } else if (typeof requestedBranch === 'string' && isValidGitRefSandbox(requestedBranch)) {
          branch = requestedBranch;
        } else {
          return c.json({ error: 'Invalid branch' }, 400);
        }

        if (requestedSessionId !== undefined) {
          const existing = await github.sourceControlStorage.sessions.getBySessionId(sessionId);
          if (existing) {
            if (
              existing.projectRepositoryId !== project.id ||
              existing.orgId !== orgId ||
              existing.userId !== userId ||
              existing.branch !== branch
            ) {
              return c.json({ error: 'Session ID conflict' }, 409);
            }
            return c.json({ session: existing });
          }
        }

        const session = await github.sourceControlStorage.sessions
          .create({
            sessionId,
            projectRepositoryId: project.id,
            orgId,
            userId,
            branch,
            baseBranch,
            title: normalizedTitle,
            visibility: 'org',
          })
          .catch(async error => {
            if (!(error instanceof UniqueViolationError) || requestedSessionId === undefined) throw error;
            const conflict = await github.sourceControlStorage.sessions.getBySessionId(sessionId);
            if (!conflict) throw error;
            return conflict;
          });
        if (
          requestedSessionId !== undefined &&
          (session.sessionId !== sessionId ||
            session.projectRepositoryId !== project.id ||
            session.orgId !== orgId ||
            session.userId !== userId ||
            session.branch !== branch)
        ) {
          return c.json({ error: 'Session ID conflict' }, 409);
        }
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
        // Private sessions 404 (not 403) for non-owners so their IDs do not
        // leak existence; the body must match the genuinely-missing case.
        if (
          !session ||
          session.orgId !== resolved.tenant.orgId ||
          (session.visibility === 'private' && session.userId !== resolved.tenant.userId)
        ) {
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
        try {
          await controller?.deleteSession({ resourceId: session.sessionId });
        } catch (error) {
          console.error('[GitHub Sessions] Failed to tear down live controller session', {
            sessionId: session.sessionId,
            error,
          });
        }
        if (sessionRetirement) {
          await sessionRetirement.retireSession({
            sourceControl: github.sourceControlStorage,
            ...(workItems ? { workItems } : {}),
            orgId: session.orgId,
            sessionId: session.sessionId,
            deleteSession: true,
          });
        } else {
          await workItems?.clearSessionReferences({ orgId: session.orgId, sessionId: session.sessionId });
          await github.sourceControlStorage.sessions.delete(session.id);
          void reclaimDeletedSessionSandbox({ session }).catch((error: unknown) => {
            console.error('[GitHub Sessions] Failed to reclaim sandbox for deleted session', {
              sessionId: session.sessionId,
              sandboxId: session.sandboxId,
              error,
            });
          });
        }
        return c.json({ removed: true });
      },
    }),

    // ── Re-name a session's thread with the title model ────────────────────
    registerApiRoute('/web/user-sessions/:sessionId/title', {
      method: 'POST',
      requiresAuth: false,
      handler: async c => {
        const resolved = await resolveOrgTenant(loose(c), auth);
        if ('response' in resolved) return resolved.response;
        const sessionId = c.req.param('sessionId');
        const row = await github.sourceControlStorage.sessions.getBySessionId(sessionId);
        if (!row || row.orgId !== resolved.tenant.orgId || row.userId !== resolved.tenant.userId) {
          return c.json({ error: 'Session not found' }, 404);
        }
        if (!controller) return c.json({ error: 'Sessions are not available on this server.' }, 503);

        const threads = await controller.queryThreads({ resourceId: sessionId });
        const thread = threads.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())[0];
        if (!thread) return c.json({ error: 'This session has no conversation to name yet.' }, 409);

        // A session that is not live carries neither the observer model that names
        // its threads nor the identity whose provider credentials pay for it.
        const stored = await memorySettings.get({ orgId: row.orgId, userId: row.userId });
        const requestContext = new RequestContext();
        requestContext.set('user', { workosId: row.userId, organizationId: row.orgId });

        try {
          const title = await nameSession(sessionId, async () => {
            const generated = await controller.generateThreadTitle({
              threadId: thread.id,
              resourceId: sessionId,
              requestContext,
              ...(stored?.observerModelId ? { model: titleModel(stored.observerModelId) } : {}),
            });
            const named = generated ? normalizeSessionTitle(generated) : null;
            if (named) await github.sourceControlStorage.sessions.rename({ sessionId, title: named });
            return named;
          });
          if (!title) return c.json({ error: 'The model returned an empty title. Try again.' }, 502);
          return c.json({ title });
        } catch (error) {
          return c.json({ error: error instanceof Error ? error.message : String(error) }, 500);
        }
      },
    }),

    // ── Stage all + commit inside a Factory session workspace ──────────────
    registerApiRoute('/web/github/projects/:id/commit', {
      method: 'POST',
      requiresAuth: false,
      handler: async c => {
        const owned = await loadOwnedProject({ github, auth, sandbox, c: loose(c) });
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
        const { workdir, sandbox: sessionSandbox } = sessionWorkspace;

        try {
          return await withSessionOperationLock(sessionWorkspace.session.sessionId, async () => {
            const result = await commitAll(
              sessionSandbox,
              workdir,
              body.message as string,
              identityFromUser(await auth.ensureUser(loose(c))),
            );
            if (result.committed) {
              await emitAudit?.({
                context: loose(c),
                input: {
                  action: 'factory.git.commit',
                  factoryProjectId: project.factoryProjectId,
                  projectRepositoryId: project.id,
                  targets: [{ type: 'session', id: sessionWorkspace.session.sessionId }],
                  metadata: { sessionId: sessionWorkspace.session.sessionId },
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

    // ── Recent commits on a repository branch ───────────────────────────────
    registerApiRoute('/web/github/projects/:id/commits', {
      method: 'GET',
      requiresAuth: false,
      handler: async c => {
        const loaded = await loadOrgProject({ github, auth, c: loose(c) });
        if ('response' in loaded) return loaded.response;
        const { orgId, project } = loaded;

        const branch = c.req.query('branch') ?? project.defaultBranch;
        if (!isValidGitRefSandbox(branch)) return c.json({ error: 'Invalid branch' }, 400);
        // GitHub takes `per_page` as an integer, so a fractional limit would go out verbatim.
        const limit = Math.min(
          Math.max(Math.floor(Number(c.req.query('limit') ?? DEFAULT_COMMIT_PAGE)) || DEFAULT_COMMIT_PAGE, 1),
          MAX_COMMIT_PAGE,
        );

        try {
          const commits = await listRepositoryCommits(github, { orgId, project, branch, limit });
          return c.json({ commits, branch });
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
        const owned = await loadOwnedProject({ github, auth, sandbox, c: loose(c) });
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
        const { workdir, sandbox: sessionSandbox } = sessionWorkspace;

        try {
          return await withSessionOperationLock(sessionWorkspace.session.sessionId, async () => {
            const access = await github.versionControl.getRepositoryAccess({
              orgId,
              repositoryId: project.repository.id,
            });
            if (!access.authorization) throw new Error('Repository access did not include a bearer token.');
            await pushBranch(sessionSandbox, workdir, branch, access.authorization.token, project.repository.slug);
            await emitAudit?.({
              context: loose(c),
              input: {
                action: 'factory.git.push',
                factoryProjectId: project.factoryProjectId,
                projectRepositoryId: project.id,
                targets: [{ type: 'branch', id: branch }],
                metadata: { branch, sessionId: sessionWorkspace.session.sessionId },
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
        const owned = await loadOwnedProject({ github, auth, sandbox, c: loose(c) });
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
          return await withSessionOperationLock(sessionWorkspace.session.sessionId, async () => {
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
              actingUserId: userId,
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
            const pullRequestNumber = pullRequestNumberFromUrl(result.url, project.repository.slug);
            if (pullRequestNumber) {
              const sessionId = sessionWorkspace.session.sessionId;
              await subscribeToPullRequest(
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
              });
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
  if (session?.projectRepositoryId !== projectId || session.userId !== userId) {
    return undefined;
  }
  // Session sandboxes live in the per-process memo, keyed by the session row
  // id. Passive resolution only — git write routes never provision. An
  // unresolved workdir means the sandbox never started here: nothing is
  // materialized, so there is no workspace to operate on.
  const entry = peekSessionSandbox(session.id);
  if (!entry?.workdir) return undefined;
  return {
    session,
    workdir: entry.workdir,
    sandbox: requireExec(entry.sandbox),
  };
}

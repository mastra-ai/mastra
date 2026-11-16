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

import type { MountedMastraCode } from '@mastra/code-sdk';
import type { ApiRoute } from '@mastra/core/server';
import { registerApiRoute } from '@mastra/core/server';
import type { FactoryStorage } from '@mastra/core/storage';
import type { FactorySandbox } from '@mastra/core/workspace';
import type { Context } from 'hono';
import { loose } from '../../routes/route.js';
import type { RouteAuth } from '../../routes/route.js';
import { requireExec } from '../../sandbox/materialization.js';
import type { ExecutableSandbox } from '../../sandbox/materialization.js';
import { peekSessionSandbox } from '../../sandbox/session-sandbox.js';
import type { StateSigner } from '../../state-signing.js';
import type { AuditEmitter } from '../../storage/domains/audit/domain.js';
import type { FactoryProjectsStorage } from '../../storage/domains/projects/base.js';
import type {
  ProjectRepository,
  ProjectSourceControlConnection,
  SourceControlInstallation,
  SourceControlRepository,
} from '../../storage/domains/source-control/base.js';

import { getGithubFeatureDiagnostics, isGithubFeatureEnabled } from './config.js';
import type { GithubIntegration } from './integration.js';
import { clearGithubPat, getGithubPat, getGithubPatStatus, setGithubPat } from './pat.js';
import type { GithubPatKind } from './pat.js';
import { listedPullRequestState, polledPullRequestEvent } from './rules.js';
import type { ReconcileRepository } from './rules.js';

import {
  commitAll,
  isValidGitRef as isValidGitRefSandbox,
  MaterializeError,
  pushBranch,
  SetupCommandError,
} from './sandbox.js';
import type { GitIdentity } from './sandbox.js';

const sessionOperationLocks = new Map<string, Promise<unknown>>();

/** Most repositories one `/web/github/repos` request returns when the caller limits it. */
const MAX_REPO_LIST_LIMIT = 100;

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

export interface MountGithubRoutesOptions {
  /** Host auth seam — resolves the signed-in user/tenant for each request. */
  auth: RouteAuth;
  /**
   * The host's session-sandbox callback. Routes only read whether it is
   * configured: without one, `/web/github/status` reports
   * `sandboxEnabled: false` and sandbox-backed routes respond 503. Sandboxes
   * themselves are constructed per session and started lazily elsewhere.
   */
  sandbox?: FactorySandbox;
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
  /** Best-effort audit emission supplied by the factory-owned audit domain. */
  emitAudit?: AuditEmitter['emit'];
  /** Factory projects domain — resolves a project's default triage model. */
  projects?: FactoryProjectsStorage;
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

function parseResourceNumber(raw: string | undefined): number | null {
  if (raw === undefined || !/^\d{1,10}$/.test(raw)) return null;
  const parsed = Number(raw);
  return parsed > 0 ? parsed : null;
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

function reconcileRepositoryOf(project: ResolvedProjectRepository): ReconcileRepository {
  return {
    id: Number(project.repository.externalId),
    fullName: project.repository.slug,
    installationId: Number(project.installation.externalId),
  };
}

async function ingestPolledEvents(
  events: ParsedGithubWebhook[],
  ingestFactoryEvent: MountGithubRoutesOptions['ingestFactoryEvent'],
): Promise<void> {
  if (!ingestFactoryEvent) return;
  const results = await Promise.allSettled(events.map(event => ingestFactoryEvent(event)));
  const rejected = results.find((result): result is PromiseRejectedResult => result.status === 'rejected');
  // Best-effort: one failed row must not stop the rest of the backlog page from landing.
  if (rejected) {
    console.warn('[Mastra Factory] Failed to ingest polled GitHub events', { error: rejected.reason });
  }
}

const LINKED_BACKLOG_MAX_PAGES = 5;

function listedIssueOf(issue: Awaited<ReturnType<GithubIntegration['intake']['listIssues']>>['issues'][number]) {
  return {
    number: Number(issue.id),
    title: issue.title,
    url: issue.url,
    author: issue.author,
    assignee: issue.assignee,
    assignees: issue.assignees,
    labels: issue.labels,
    createdAt: issue.createdAt,
  };
}

/**
 * Feed a just-linked repository's open issues and pull requests through the
 * rules ingress, so its backlog reaches the board without anyone browsing it.
 * The reconcile sweeps only recover items filed after the link. Rows owned by
 * another integration don't resolve through this integration's storage handle
 * and are skipped.
 */
export async function ingestLinkedRepositoryBacklog(args: {
  github: GithubIntegration;
  orgId: string;
  projectRepositoryId: string;
  ingestFactoryEvent: MountGithubRoutesOptions['ingestFactoryEvent'];
}): Promise<void> {
  if (!args.ingestFactoryEvent) return;
  const project = await resolveProjectRepository(args);
  if (!project) return;
  const connection = {
    type: 'app-installation' as const,
    installationId: Number(project.installation.externalId),
    orgId: project.installation.orgId,
  };
  const sourceId = project.repository.slug;

  for (let page = 1; page <= LINKED_BACKLOG_MAX_PAGES; page += 1) {
    const { issues, nextCursor } = await args.github.intake.listIssues({
      connection,
      sourceIds: [sourceId],
      cursor: String(page),
    });
    await ingestPolledEvents(
      issues.map(issue => polledIssueEvent(project, listedIssueOf(issue))),
      args.ingestFactoryEvent,
    );
    if (nextCursor === null) break;
  }
  for (let page = 1; page <= LINKED_BACKLOG_MAX_PAGES; page += 1) {
    const { pullRequests, nextCursor } = await args.github.versionControl.listPullRequests({
      connection,
      sourceId,
      includeDrafts: false,
      cursor: String(page),
    });
    await ingestPolledEvents(
      pullRequests.map(pr => {
        const state = listedPullRequestState(pr);
        return polledPullRequestEvent(reconcileRepositoryOf(project), state.number, state);
      }),
      args.ingestFactoryEvent,
    );
    if (nextCursor === null) break;
  }
}

/**
 * Build the GitHub routes as Mastra `apiRoutes`. When the feature is disabled,
 * returns only the `status` route so the SPA can detect the disabled state.
 */
export function buildGithubRoutes(options: MountGithubRoutesOptions): ApiRoute[] {
  const routes: ApiRoute[] = [];
  const { auth, sandbox, storage, github, stateSigner, emitAudit } = options;
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

        // Sessions read by session id; resourceId is the older address.
        const sessionId = c.req.query('sessionId');
        const resourceId = c.req.query('resourceId');
        const threadId = c.req.query('threadId');
        const target = !threadId
          ? null
          : sessionId
            ? { orgId: tenant.orgId, sessionId, threadId }
            : resourceId
              ? { orgId: tenant.orgId, resourceId, threadId }
              : null;
        if (!target) return c.json({ error: 'sessionId (or resourceId) and threadId are required' }, 400);

        const subscriptions = await listPullRequestSubscriptionsForThread(target, github.integrationStorage);
        return c.json({
          subscriptions: subscriptions.map(subscription => ({
            id: subscription.id,
            repoFullName: subscription.data.repositorySlug,
            pullRequestNumber: Number(subscription.data.changeRequestId),
            status: subscription.status,
            updatedAt: subscription.updatedAt.toISOString(),
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

        const query = (c.req.query('q') ?? '').trim().toLowerCase();
        const fresh = c.req.query('refresh') === '1';
        // `limit` asks each installation for only its most recently pushed
        // matches, so the picker opens fast on accounts with many repositories.
        const limitParam = Number(c.req.query('limit'));
        const limit =
          Number.isInteger(limitParam) && limitParam > 0 ? Math.min(limitParam, MAX_REPO_LIST_LIMIT) : undefined;
        // List every installation's repositories in parallel — installations
        // are independent upstream calls, and serial listing multiplied
        // worst-case latency by installation count.
        const listed = await Promise.all(
          installs.map(async inst => {
            try {
              return {
                inst,
                list: await github.listInstallationRepos(Number(inst.externalId), {
                  fresh,
                  ...(query && { query }),
                  ...(limit && { limit }),
                }),
              };
            } catch (err) {
              // 403 means this credential may not use the installation (e.g. the
              // Platform refuses personal-account installations to org API
              // keys). Skip it so the org's usable installations still list.
              if ((err as { status?: number }).status === 403) {
                console.warn(
                  `[Mastra Factory] skipping GitHub installation ${inst.externalId} (${inst.accountName}): ${(err as Error).message}`,
                );
                return { inst, list: [] };
              }
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

        // A limited listing merges installations by last push and keeps the
        // overall most recent.
        if (limit) {
          matches.sort((a, b) => (b.repo.pushedAt ?? '').localeCompare(a.repo.pushedAt ?? ''));
          matches.length = Math.min(matches.length, limit);
        }

        const repos = matches.map(({ inst, repo }) => ({
          ...repo,
          installationStorageId: inst.id,
        }));
        return c.json({ repos });
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
              orgId: loaded.project.installation.orgId,
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
              orgId: loaded.project.installation.orgId,
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

  // ── Commit / push / PR ────────────────────────────────────────
  routes.push(...buildProjectGitRoutes({ github, auth, sandbox, emitAudit }));

  return routes;
}

/**
 * Load the org-owned project for a read-only GitHub API route. Unlike
 * `loadOwnedProject`, this never touches sandbox state — the issue/PR detail
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
  sandbox?: FactorySandbox;
  c: RouteContext;
}): Promise<{ orgId: string; userId: string; project: ResolvedProjectRepository } | { response: Response }> {
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

function buildProjectGitRoutes({
  github,
  auth,
  sandbox,
  emitAudit,
}: {
  github: GithubIntegration;
  auth: RouteAuth;
  sandbox?: FactorySandbox;
  emitAudit?: AuditEmitter['emit'];
}): ApiRoute[] {
  return [
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
                orgId: project.installation.orgId,
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
                  resourceId: project.factoryProjectId,
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

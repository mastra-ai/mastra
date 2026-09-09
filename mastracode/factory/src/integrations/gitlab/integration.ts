/**
 * `GitLabIntegration` — GitLab issues as a Factory intake source.
 *
 * Implements the system-wide `FactoryIntegration` contract (`../base.ts`):
 * the deploy entry reads the GITLAB_* env vars ONCE, constructs an instance
 * with explicit credentials, and passes it to `MastraFactory` via
 * `integrations: [...]`. No other module reads `GITLAB_*` env vars.
 *
 * SCOPE: intake only (issues in). It deliberately does NOT implement the
 * `versionControl` capability — the factory resolves its source-control owner
 * by the literal integration id `"github"` (see `factory.js` and
 * `rules/types.js`), so merge requests, branches, and clone auth cannot be
 * served from here today. The supported shape is GitLab issues in, GitHub pull
 * requests out — the same split Linear already runs under.
 *
 * CREDENTIALS: OAuth 2.0 authorization code + PKCE, stored as the org's
 * connection in the factory's generic integration storage. A static token from
 * the entry's env remains supported as a fallback for single-user setups that
 * would rather not register an application.
 *
 * TENANCY CAVEAT: `IntegrationStorageHandle.connections` is keyed by `orgId`
 * alone — one connection per org, the same as Linear. So the OAuth grant is
 * org-wide: whoever connects authorizes access for everyone in that org, and
 * per-user GitLab permissions are NOT enforced per request. Access control at
 * that granularity would need per-user credentials, which this storage slot
 * does not model.
 */
import { registerApiRoute } from '@mastra/core/server';
import type { ApiRoute } from '@mastra/core/server';
import type { Context } from 'hono';
import type { IntegrationConnection } from '../../capabilities/connection.js';
import type {
  CreateIntakeCommentInput,
  CreatedIntakeComment,
  GetIntakeIssueInput,
  Intake,
  IntakeIssue,
  IntakeIssueDetail,
  IntakeIssuePage,
  IntakeItem,
  IntakeItemPage,
  IntakeSource,
  ListIntakeIssuesInput,
  ListIntakeItemsInput,
  ListIntakeSourcesInput,
  ResolveIntakeDispatchInput,
  ResolvedIntakeDispatch,
  UpdateIntakeIssueInput,
} from '../../capabilities/intake.js';
import type { RouteAuth } from '../../routes/route.js';
import type { StateSigner } from '../../state-signing.js';
import type { IntakeStorage } from '../../storage/domains/intake/base.js';
import type { IntegrationStorageHandle } from '../../storage/domains/integrations/base.js';
import type { FactoryProjectsStorage } from '../../storage/domains/projects/base.js';
import type { FactoryIntegration, IntegrationContext } from '../base.js';
import { GitLabClient, parseIssueRef, type GitLabIssue } from './client.js';
import { toIntakeIssue, toIntakeIssueDetail, toIntakeItem, toStateEvent } from './intake.js';
import {
  buildAuthorizeUrl,
  DEFAULT_GITLAB_SCOPE,
  exchangeAuthorizationCode,
  generatePkce,
  isExpired,
  refreshAccessToken,
  revokeToken,
  safeEqual,
  type GitLabOAuthAppConfig,
  type GitLabTokenSet,
} from './oauth.js';

const DEFAULT_BASE_URL = 'https://gitlab.com';

/** Callback path. Must match the redirect URI registered on the GitLab app exactly. */
const OAUTH_CALLBACK_PATH = '/web/gitlab/oauth/callback';

/** A started-but-unfinished authorization is useless after this long. */
const PKCE_TTL_MS = 10 * 60 * 1000;

/** Tenant used when the host runs without web auth (single-user local dev). */
const LOCAL_TENANT = { orgId: 'local', userId: 'local' } as const;



export interface GitLabIntegrationOptions {
  /** Instance origin. Defaults to gitlab.com; set this for self-hosted. */
  baseUrl?: string;
  /** OAuth application credentials. Both required to enable the connect flow. */
  clientId?: string;
  clientSecret?: string;
  /** Defaults to `api` — GitLab has no narrower issue-write scope. */
  scope?: string;
  /**
   * Static fallback token (personal or group access token), used when the org
   * has no stored OAuth connection. Optional once OAuth is configured.
   */
  accessToken?: string;
  /**
   * Browser-facing origin used to build the redirect URI. Falls back to the
   * factory's `publicUrl`, then to the request's own origin.
   */
  publicUrl?: string;
  /** Shared secret compared against `X-Gitlab-Token` on the webhook route. */
  webhookSecret?: string;
}

/** Shape this integration persists as its org-owned connection payload. */
interface GitLabConnectionData {
  /** Open record: `connections.upsert` takes `Record<string, unknown>` payloads. */
  [key: string]: unknown;
  accessToken: string;
  refreshToken?: string;
  /** Absolute epoch ms. Absent for a static-token connection, which never expires. */
  expiresAt?: number;
  scope?: string | null;
  baseUrl?: string;
  /** GitLab username that authorized the grant — display only. */
  connectedAs?: string;
}

/** In-flight PKCE state, parked in the `(org, user)` settings row between legs. */
interface GitLabPendingAuth {
  pkceVerifier: string;
  nonce: string;
  redirectUri: string;
  startedAt: number;
}

function str(value: unknown): string | undefined {
  return typeof value === 'string' && value !== '' ? value : undefined;
}

function num(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function readConnectionData(data: Record<string, unknown> | undefined): GitLabConnectionData | null {
  const accessToken = str(data?.['accessToken']);
  if (!accessToken) return null;
  return {
    accessToken,
    ...(str(data?.['refreshToken']) ? { refreshToken: str(data?.['refreshToken']) } : {}),
    ...(num(data?.['expiresAt']) !== undefined ? { expiresAt: num(data?.['expiresAt']) } : {}),
    ...(str(data?.['baseUrl']) ? { baseUrl: str(data?.['baseUrl']) } : {}),
    ...(str(data?.['connectedAs']) ? { connectedAs: str(data?.['connectedAs']) } : {}),
  };
}

function readPendingAuth(settings: Record<string, unknown> | null): GitLabPendingAuth | null {
  const pending = settings?.['gitlabPendingAuth'];
  if (!pending || typeof pending !== 'object') return null;
  const record = pending as Record<string, unknown>;
  const pkceVerifier = str(record['pkceVerifier']);
  const nonce = str(record['nonce']);
  const redirectUri = str(record['redirectUri']);
  const startedAt = num(record['startedAt']);
  if (!pkceVerifier || !nonce || !redirectUri || startedAt === undefined) return null;
  return { pkceVerifier, nonce, redirectUri, startedAt };
}

/**
 * Narrow the caller's selected GitLab sources to the ones that feed this
 * Factory project.
 *
 * A GitLab issue carries no Factory project of its own, so without a binding
 * every board would ingest every selected project's issues into whichever
 * Factory happened to be on screen. Bound sources win; when the org has no
 * bindings at all we fall back to the full selection for single-Factory
 * installs, where "which project" is unambiguous. Same rule as Linear.
 */
async function scopeSourceIdsToProject({
  intake,
  projects,
  orgId,
  factoryProjectId,
  selectedIds,
}: {
  intake: IntakeStorage;
  projects: FactoryProjectsStorage | undefined;
  orgId: string;
  factoryProjectId: string;
  selectedIds: string[];
}): Promise<string[]> {
  const bound = await intake.listBoundSourceIds({ orgId, integrationId: 'gitlab', factoryProjectId });
  if (bound.length > 0) {
    const boundSet = new Set(bound);
    return selectedIds.filter(id => boundSet.has(id));
  }
  if ((await intake.listBindings({ orgId, integrationId: 'gitlab' })).length > 0) return [];
  if (!projects) return [];
  return (await projects.list({ orgId })).length <= 1 ? selectedIds : [];
}

/** Reject a cursor that could not have come from us before it reaches GitLab. */
function parseCursor(raw: string | undefined): string | undefined | null {
  if (raw === undefined || raw === '') return undefined;
  return /^\d{1,6}$/.test(raw) ? raw : null;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Erase a path-parameterized route handler's context to a plain `Context`. */
function loose(c: unknown): Context {
  return c as Context;
}

export class GitLabIntegration implements FactoryIntegration {
  /** Stable identifier — intake config, work-item `externalSource`, and audit rows key on this. */
  readonly id = 'gitlab';

  readonly intake: Intake;

  /**
   * The OAuth `state` round-trips through GitLab, so a per-process random
   * signer would break the callback on any replica but the one that started it,
   * and the factory fails loud at boot rather than letting that ship.
   *
   * Conditional on the OAuth app: a static-token deployment signs no `state`
   * at all, so demanding a deployment-stable secret there would block boot over
   * a facility it never touches.
   */
  readonly requiresStableStateSigner: boolean;

  private readonly baseUrl: string;
  private readonly oauthApp: GitLabOAuthAppConfig | undefined;
  private readonly fallbackToken: string | undefined;
  private readonly configuredPublicUrl: string | undefined;
  private readonly webhookSecret: string | undefined;

  /** Bound once by the factory in `prepare()`, before any surface is used. */
  private storageHandle: IntegrationStorageHandle | undefined;
  private projects: FactoryProjectsStorage | undefined;
  private auth: RouteAuth | undefined;

  /** Captured in `routes()` from the `IntegrationContext`. */
  private stateSigner: StateSigner | undefined;
  private contextBaseUrl: string | undefined;
  private intakeStorage: IntakeStorage | undefined;
  private projectsStorage: FactoryProjectsStorage | undefined;

  /**
   * One in-flight refresh per org. GitLab rotates the refresh token on every
   * use, so two concurrent refreshes would race and the loser's token would be
   * permanently dead — this collapses them onto one request.
   */
  private readonly refreshInFlight = new Map<string, Promise<GitLabConnectionData | null>>();

  constructor(options: GitLabIntegrationOptions) {
    const clientId = options.clientId?.trim();
    const clientSecret = options.clientSecret?.trim();
    const accessToken = options.accessToken?.trim();

    if (!accessToken && !(clientId && clientSecret)) {
      // Fail at construction, like the other integrations: a half-configured
      // instance that 500s per request is worse than a boot-time error.
      throw new Error(
        'GitLabIntegration requires either an accessToken or a complete OAuth app (clientId + clientSecret).',
      );
    }

    this.baseUrl = (options.baseUrl?.trim() || DEFAULT_BASE_URL).replace(/\/+$/, '');
    this.oauthApp =
      clientId && clientSecret
        ? { baseUrl: this.baseUrl, clientId, clientSecret, scope: options.scope?.trim() || DEFAULT_GITLAB_SCOPE }
        : undefined;
    this.fallbackToken = accessToken || undefined;
    this.requiresStableStateSigner = Boolean(this.oauthApp);
    this.configuredPublicUrl = options.publicUrl?.trim().replace(/\/+$/, '') || undefined;
    this.webhookSecret = options.webhookSecret?.trim() || undefined;

    // Bound as arrow properties so `this` survives the factory destructuring
    // the capability off the instance — the same idiom LinearIntegration uses.
    this.intake = {
      resolveIntakeDispatch: input => this.resolveIntakeDispatch(input),
      listSources: input => this.listSources(input),
      listItems: input => this.listItems(input),
      listIssues: input => this.listIssues(input),
      getIssue: input => this.getIssue(input),
      createComment: input => this.createComment(input),
      updateIssue: input => this.updateIssue(input),
    };
  }

  initialize(args: {
    storage: IntegrationStorageHandle;
    projects: FactoryProjectsStorage;
    auth: RouteAuth;
  }): void {
    this.storageHandle = args.storage;
    this.projects = args.projects;
    this.auth = args.auth;
  }

  private get storage(): IntegrationStorageHandle {
    if (!this.storageHandle) {
      throw new Error('GitLabIntegration is not initialized — the factory binds storage during prepare().');
    }
    return this.storageHandle;
  }

  // ---------------------------------------------------------------------------
  // Credential resolution
  // ---------------------------------------------------------------------------

  /**
   * The org's usable credential: stored OAuth connection (refreshed when due)
   * first, configured static token second.
   */
  private async resolveConnectionData(orgId: string): Promise<GitLabConnectionData | null> {
    const stored = readConnectionData((await this.storageHandle?.connections.get(orgId))?.data);

    if (stored) {
      if (stored.expiresAt === undefined || !isExpired(stored.expiresAt)) return stored;
      const refreshed = await this.refreshConnection(orgId, stored);
      if (refreshed) return refreshed;
      // Refresh failed (revoked grant, rotated-away token). Fall through to the
      // static token when one is configured rather than hard-failing the board.
    }

    return this.fallbackToken ? { accessToken: this.fallbackToken } : null;
  }

  /** Single-flight, atomic token rotation. Returns null when the grant is unrecoverable. */
  private refreshConnection(orgId: string, current: GitLabConnectionData): Promise<GitLabConnectionData | null> {
    const existing = this.refreshInFlight.get(orgId);
    if (existing) return existing;

    const attempt = (async (): Promise<GitLabConnectionData | null> => {
      try {
        if (!this.oauthApp || !current.refreshToken) return null;
        const tokens = await refreshAccessToken(this.oauthApp, {
          refreshToken: current.refreshToken,
          redirectUri: this.redirectUri(),
        });
        // `connections.update` is an atomic read-modify-write, so a concurrent
        // writer (the callback route completing a reconnect) can't be clobbered.
        const updated = await this.storage.connections.update(orgId, data => ({
          ...data,
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
          expiresAt: tokens.expiresAt,
          scope: tokens.scope,
        }));
        return readConnectionData(updated?.data) ?? { ...current, ...this.toConnectionFields(tokens) };
      } catch (error) {
        console.warn(`[gitlab] token refresh failed for org ${orgId} — reconnect required.`, error);
        return null;
      } finally {
        // MUTANT: cleanup removed
      }
    })();

    this.refreshInFlight.set(orgId, attempt);
    return attempt;
  }

  private toConnectionFields(tokens: GitLabTokenSet): Partial<GitLabConnectionData> {
    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresAt: tokens.expiresAt,
      scope: tokens.scope,
    };
  }

  private async clientForOrg(orgId: string): Promise<GitLabClient | null> {
    const connection = await this.resolveConnectionData(orgId);
    if (!connection) return null;
    return new GitLabClient({
      baseUrl: connection.baseUrl ?? this.baseUrl,
      accessToken: connection.accessToken,
    });
  }

  /**
   * The `connection` the board hands back on per-issue calls. `type: 'oauth'`
   * is the contract's bearer-token variant — it covers static tokens too, since
   * GitLab accepts both in the same `Authorization: Bearer` header.
   */
  private clientForConnection(connection: IntegrationConnection): GitLabClient {
    if (connection.type !== 'oauth') {
      throw new Error('GitLabIntegration only supports bearer-token connections.');
    }
    return new GitLabClient({ baseUrl: this.baseUrl, accessToken: connection.accessToken });
  }

  private async bearerForOrg(orgId: string): Promise<IntegrationConnection | null> {
    const connection = await this.resolveConnectionData(orgId);
    return connection ? { type: 'oauth', accessToken: connection.accessToken } : null;
  }

  // ---------------------------------------------------------------------------
  // Intake capability
  // ---------------------------------------------------------------------------

  /** Sources are GitLab projects the token can act on. */
  private async listSources({ orgId }: ListIntakeSourcesInput): Promise<IntakeSource[]> {
    const client = await this.clientForOrg(orgId);
    if (!client) return [];
    return (await client.listProjects()).map(project => ({
      id: String(project.id),
      name: project.name_with_namespace,
      type: 'project',
      metadata: { path: project.path_with_namespace, url: project.web_url },
    }));
  }

  /**
   * Board rows for the selected sources.
   *
   * Sequential per project so one 429 doesn't cascade, and the cursor belongs
   * to whichever project still has pages — good enough for a handful of
   * sources, and the place to add a composite cursor if that grows.
   */
  private async listItems({ orgId, sourceIds, cursor }: ListIntakeItemsInput): Promise<IntakeItemPage> {
    if (sourceIds.length === 0) return { items: [], nextCursor: null };
    const client = await this.clientForOrg(orgId);
    if (!client) return { items: [], nextCursor: null };

    const items: IntakeItem[] = [];
    let nextCursor: string | null = null;
    for (const projectId of sourceIds) {
      const page = await client.listProjectIssues({ projectId, ...(cursor ? { cursor } : {}) });
      items.push(...page.items.map(toIntakeItem));
      nextCursor ??= page.nextCursor;
    }
    return { items, nextCursor };
  }

  private async listIssues({
    connection,
    sourceIds,
    labels,
    cursor,
  }: ListIntakeIssuesInput): Promise<IntakeIssuePage> {
    if (sourceIds.length === 0) return { issues: [], nextCursor: null };
    const client = this.clientForConnection(connection);

    const issues: IntakeIssue[] = [];
    let nextCursor: string | null = null;
    for (const projectId of sourceIds) {
      const page = await client.listProjectIssues({
        projectId,
        ...(labels?.length ? { labels } : {}),
        ...(cursor ? { cursor } : {}),
      });
      issues.push(...page.items.map(toIntakeIssue));
      nextCursor ??= page.nextCursor;
    }
    return { issues, nextCursor };
  }

  private async getIssue({ connection, issueId }: GetIntakeIssueInput): Promise<IntakeIssueDetail | null> {
    const ref = parseIssueRef(issueId);
    if (!ref) return null;
    const client = this.clientForConnection(connection);
    const issue = await client.getIssue(ref);
    if (!issue) return null;
    return toIntakeIssueDetail(issue, await client.listIssueNotes(ref));
  }

  private async createComment({
    connection,
    issueId,
    body,
  }: CreateIntakeCommentInput): Promise<CreatedIntakeComment | null> {
    const ref = parseIssueRef(issueId);
    if (!ref) return null;
    const client = this.clientForConnection(connection);
    const issue = await client.getIssue(ref);
    if (!issue) return null;
    const note = await client.createIssueNote(ref, body);
    // GitLab's note payload carries no canonical permalink; anchor on the issue.
    return { id: String(note.id), url: `${issue.web_url}#note_${note.id}` };
  }

  /** `null` means "target not applicable" — never an error. See `Intake.updateIssue`. */
  private async updateIssue({ connection, issueId, state }: UpdateIntakeIssueInput): Promise<IntakeIssue | null> {
    const ref = parseIssueRef(issueId);
    if (!ref) return null;
    const event = toStateEvent(state);
    if (!event) return null;

    const client = this.clientForConnection(connection);
    const current = await client.getIssue(ref);
    if (!current) return null;
    // Idempotency: GitLab accepts a redundant state_event, but skipping the
    // write keeps the issue's updated_at (and its activity feed) honest.
    const alreadyThere = event === 'close' ? current.state === 'closed' : current.state === 'opened';
    const issue: GitLabIssue = alreadyThere ? current : await client.setIssueState(ref, event);
    return toIntakeIssue(issue);
  }

  /** Background dispatch: resolve a stored work item back to a live connection. */
  private async resolveIntakeDispatch({
    orgId,
    externalSource,
  }: ResolveIntakeDispatchInput): Promise<ResolvedIntakeDispatch | null> {
    if (externalSource.type !== 'issue') return null;
    const ref = parseIssueRef(externalSource.externalId);
    if (!ref) return null;
    const connection = await this.bearerForOrg(orgId);
    if (!connection) return null;
    return { connection, sourceId: ref.projectId, issueId: externalSource.externalId };
  }

  // ---------------------------------------------------------------------------
  // OAuth plumbing
  // ---------------------------------------------------------------------------

  /**
   * Redirect URI handed to GitLab. Must match the application's registered
   * value byte-for-byte, so it is derived from one configured origin rather
   * than the incoming request wherever possible.
   */
  private redirectUri(requestOrigin?: string): string {
    const origin = this.configuredPublicUrl ?? this.contextBaseUrl ?? requestOrigin ?? 'http://localhost:4111';
    return `${origin.replace(/\/+$/, '')}${OAUTH_CALLBACK_PATH}`;
  }

  /**
   * Resolve the caller's tenant. GitLab connections are org-owned, so a
   * tenant-mode host requires both a signed-in user and an organization;
   * an auth-disabled host takes the single-user local path.
   */
  private async resolveTenant(
    c: Context,
  ): Promise<{ orgId: string; userId: string } | { response: Response }> {
    const auth = this.auth;
    if (!auth?.enabled()) return { ...LOCAL_TENANT };
    await auth.ensureUser(c);
    const tenant = auth.tenant(c);
    if (!tenant) return { response: c.json({ error: 'unauthorized' }, 401) };
    if (!tenant.orgId) return { response: c.json({ error: 'organization_required' }, 400) };
    return { orgId: tenant.orgId, userId: tenant.userId };
  }

  private async savePendingAuth(orgId: string, userId: string, pending: GitLabPendingAuth | null): Promise<void> {
    const existing = (await this.storage.settings.get(orgId, userId)) ?? {};
    const next = { ...existing };
    if (pending) next['gitlabPendingAuth'] = pending;
    else delete next['gitlabPendingAuth'];
    await this.storage.settings.save(orgId, userId, next);
  }

  // ---------------------------------------------------------------------------
  // HTTP surface
  // ---------------------------------------------------------------------------

  routes(ctx: IntegrationContext): ApiRoute[] {
    this.stateSigner = ctx.stateSigner;
    this.contextBaseUrl = ctx.baseUrl;
    this.intakeStorage = ctx.storage.intake;
    this.projectsStorage = ctx.storage.projects;

    return [
      registerApiRoute('/web/gitlab/status', {
        method: 'GET',
        handler: async c => {
          const resolved = await this.resolveTenant(loose(c));
          if ('response' in resolved) return resolved.response;

          const stored = readConnectionData((await this.storageHandle?.connections.get(resolved.orgId))?.data);
          const client = await this.clientForOrg(resolved.orgId);
          if (!client) {
            return c.json({
              configured: false,
              oauthAvailable: Boolean(this.oauthApp),
              baseUrl: this.baseUrl,
              reason: 'no_connection',
            });
          }

          // Prove the credential actually works — a self-hosted misconfiguration
          // (bad CA, unreachable host, revoked token) is far more legible here
          // than as a silently empty issue list.
          try {
            const [user, version] = await Promise.all([client.getCurrentUser(), client.getVersion()]);
            return c.json({
              configured: true,
              oauthAvailable: Boolean(this.oauthApp),
              baseUrl: this.baseUrl,
              connectedAs: user.username,
              credential: stored?.refreshToken ? 'oauth' : 'static-token',
              expiresAt: stored?.expiresAt ?? null,
              instanceVersion: version.version,
            });
          } catch (error) {
            return c.json({
              configured: false,
              oauthAvailable: Boolean(this.oauthApp),
              baseUrl: this.baseUrl,
              reason: 'credential_rejected',
              detail: error instanceof Error ? error.message : String(error),
            });
          }
        },
      }),

      // The board's issue feed for one Factory project. Distinct from the
      // generic `/web/intake/*` endpoints: a board request is also an ingest,
      // so it only ever sees the sources bound to the project being viewed.
      // Mirrors `/web/linear/issues`.
      registerApiRoute('/web/gitlab/issues', {
        method: 'GET',
        handler: async c => {
          const resolved = await this.resolveTenant(loose(c));
          if ('response' in resolved) return resolved.response;

          const cursor = parseCursor(c.req.query('cursor'));
          if (cursor === null) return c.json({ error: 'invalid_cursor' }, 400);
          const factoryProjectId = c.req.query('factoryProjectId');
          if (factoryProjectId && !UUID_RE.test(factoryProjectId)) {
            return c.json({ error: 'invalid_factory_project_id' }, 400);
          }

          const connection = await this.bearerForOrg(resolved.orgId);
          if (!connection) {
            return c.json({ error: 'gitlab_not_connected', message: 'Connect GitLab to see intake issues.' }, 409);
          }

          const intake = this.intakeStorage;
          if (!intake) return c.json({ error: 'intake_unavailable' }, 503);
          await intake.ensureReady();
          const config = await intake.getConfig({
            orgId: resolved.orgId,
            userId: resolved.userId,
            integrationIds: ['gitlab'],
          });
          const selection = config['gitlab'];
          if (!selection?.enabled) {
            return c.json(
              { error: 'gitlab_intake_disabled', message: 'GitLab intake is turned off in Settings.' },
              404,
            );
          }

          // No projects picked means nothing is synced — don't fan out to GitLab.
          const selectedIds = selection.sourceIds ?? [];
          const sourceIds = factoryProjectId
            ? await scopeSourceIdsToProject({
                intake,
                projects: this.projectsStorage,
                orgId: resolved.orgId,
                factoryProjectId,
                selectedIds,
              })
            : selectedIds;
          if (sourceIds.length === 0) return c.json({ issues: [], nextCursor: null });

          try {
            // `IntakeIssue` is already provider-neutral, so it is the wire
            // shape too — no per-provider payload mapping to keep in sync.
            const page = await this.listIssues({ connection, sourceIds, ...(cursor ? { cursor } : {}) });
            return c.json(page);
          } catch (error) {
            console.warn(`[gitlab] issue feed failed for org ${resolved.orgId}.`, error);
            return c.json(
              {
                error: 'gitlab_unavailable',
                message: error instanceof Error ? error.message : 'GitLab could not be reached.',
              },
              502,
            );
          }
        },
      }),

      // One issue with its description and comments, for the card body.
      // `:issueId` is the intake external id (`project!iid`), URL-encoded.
      registerApiRoute('/web/gitlab/issues/:issueId', {
        method: 'GET',
        handler: async c => {
          const resolved = await this.resolveTenant(loose(c));
          if ('response' in resolved) return resolved.response;

          const issueId = c.req.param('issueId');
          const ref = parseIssueRef(issueId);
          if (!ref) return c.json({ error: 'invalid_issue_id' }, 400);

          const connection = await this.bearerForOrg(resolved.orgId);
          if (!connection) {
            return c.json({ error: 'gitlab_not_connected', message: 'Connect GitLab to see this issue.' }, 409);
          }

          // Scope by the caller's own selection: an issue from a project this
          // user never picked is not theirs to read through the board.
          const intake = this.intakeStorage;
          if (!intake) return c.json({ error: 'intake_unavailable' }, 503);
          await intake.ensureReady();
          const config = await intake.getConfig({
            orgId: resolved.orgId,
            userId: resolved.userId,
            integrationIds: ['gitlab'],
          });
          const selectedIds = config['gitlab']?.sourceIds ?? [];
          if (!selectedIds.includes(ref.projectId)) return c.json({ error: 'not_found' }, 404);

          try {
            const detail = await this.getIssue({ connection, issueId });
            return detail ? c.json(detail) : c.json({ error: 'not_found' }, 404);
          } catch (error) {
            console.warn(`[gitlab] issue detail failed for org ${resolved.orgId}.`, error);
            return c.json(
              {
                error: 'gitlab_unavailable',
                message: error instanceof Error ? error.message : 'GitLab could not be reached.',
              },
              502,
            );
          }
        },
      }),

      // Leg 1: mint PKCE + signed state, park the verifier, redirect to GitLab.
      registerApiRoute('/web/gitlab/oauth/start', {
        method: 'GET',
        handler: async c => {
          if (!this.oauthApp) return c.json({ error: 'oauth_not_configured' }, 400);
          if (!this.stateSigner) return c.json({ error: 'state_signer_unavailable' }, 503);

          const resolved = await this.resolveTenant(loose(c));
          if ('response' in resolved) return resolved.response;

          const { verifier, challenge } = generatePkce();
          const state = this.stateSigner.sign(resolved.orgId, resolved.userId);
          const verified = this.stateSigner.verify(state);
          if (!verified) return c.json({ error: 'state_signing_failed' }, 500);

          const redirectUri = this.redirectUri(new URL(c.req.url).origin);
          // The verifier must never reach the browser, so it is parked
          // server-side against the tenant that started the flow, keyed by the
          // state's own nonce so a stale start can't validate a later callback.
          await this.savePendingAuth(resolved.orgId, resolved.userId, {
            pkceVerifier: verifier,
            nonce: verified.nonce,
            redirectUri,
            startedAt: Date.now(),
          });

          return c.redirect(buildAuthorizeUrl(this.oauthApp, { redirectUri, state, challenge }));
        },
      }),

      // Leg 2: verify state, spend the verifier, persist the grant.
      registerApiRoute(OAUTH_CALLBACK_PATH, {
        method: 'GET',
        // GitLab redirects the user's browser here with no session guarantee of
        // its own; the signed `state` is what authenticates the callback.
        requiresAuth: false,
        handler: async c => {
          if (!this.oauthApp) return c.json({ error: 'oauth_not_configured' }, 400);
          if (!this.stateSigner) return c.json({ error: 'state_signer_unavailable' }, 503);

          const error = c.req.query('error');
          if (error) {
            console.warn(`[gitlab] authorization denied: ${c.req.query('error_description') ?? error}`);
            return c.redirect('/?gitlab=denied');
          }

          const code = c.req.query('code');
          const tenant = this.stateSigner.verify(c.req.query('state'));
          if (!code || !tenant) return c.redirect('/?gitlab=error');

          const pending = readPendingAuth(await this.storage.settings.get(tenant.orgId, tenant.userId));
          if (!pending || !safeEqual(pending.nonce, tenant.nonce)) return c.redirect('/?gitlab=error');
          if (Date.now() - pending.startedAt > PKCE_TTL_MS) {
            await this.savePendingAuth(tenant.orgId, tenant.userId, null);
            return c.redirect('/?gitlab=expired');
          }

          try {
            const tokens = await exchangeAuthorizationCode(this.oauthApp, {
              code,
              // The registered redirect URI is part of the grant; reuse the one
              // leg 1 actually sent rather than recomputing it.
              redirectUri: pending.redirectUri,
              verifier: pending.pkceVerifier,
            });

            let connectedAs: string | undefined;
            try {
              connectedAs = (
                await new GitLabClient({ baseUrl: this.baseUrl, accessToken: tokens.accessToken }).getCurrentUser()
              ).username;
            } catch {
              // Identity is display-only; a working grant should not be
              // discarded because /user happened to fail.
            }

            const data: GitLabConnectionData = {
              accessToken: tokens.accessToken,
              refreshToken: tokens.refreshToken,
              expiresAt: tokens.expiresAt,
              scope: tokens.scope,
              baseUrl: this.baseUrl,
              ...(connectedAs ? { connectedAs } : {}),
            };
            await this.storage.connections.upsert(tenant.orgId, { userId: tenant.userId, data });
            return c.redirect('/?gitlab=connected');
          } catch (exchangeError) {
            console.warn(`[gitlab] token exchange failed for org ${tenant.orgId}.`, exchangeError);
            return c.redirect('/?gitlab=error');
          } finally {
            // One-shot: the verifier is spent whether or not the exchange worked.
            await this.savePendingAuth(tenant.orgId, tenant.userId, null);
          }
        },
      }),

      registerApiRoute('/web/gitlab/oauth', {
        method: 'DELETE',
        handler: async c => {
          const resolved = await this.resolveTenant(loose(c));
          if ('response' in resolved) return resolved.response;

          const stored = readConnectionData((await this.storageHandle?.connections.get(resolved.orgId))?.data);
          if (stored?.refreshToken && this.oauthApp) {
            // Best effort: a failed revoke must not block local disconnect.
            try {
              await revokeToken(this.oauthApp, stored.refreshToken);
            } catch (revokeError) {
              console.warn(`[gitlab] token revoke failed for org ${resolved.orgId}.`, revokeError);
            }
          }
          const deleted = await this.storage.connections.delete(resolved.orgId);
          await this.savePendingAuth(resolved.orgId, resolved.userId, null);
          return c.json({ disconnected: deleted });
        },
      }),

      registerApiRoute('/web/gitlab/webhook', {
        method: 'POST',
        // GitLab authenticates itself with a shared secret header, not a user
        // session, so this route must bypass the host's user auth.
        requiresAuth: false,
        handler: async c => {
          if (this.webhookSecret && c.req.header('x-gitlab-token') !== this.webhookSecret) {
            return c.json({ error: 'invalid_signature' }, 401);
          }
          // TODO: map `object_kind: 'issue' | 'note'` onto work-item rules via
          // `ctx.rules` and signal live sessions through `ctx.controller`. The
          // secret check above is optional only because this handler does
          // nothing yet — the moment payloads drive rules, `webhookSecret` must
          // become mandatory (reject the delivery when it is unset) so an
          // unauthenticated caller cannot move cards.
          return c.json({ ok: true, ignored: true });
        },
      }),
    ];
  }

  /**
   * Non-secret snapshot merged into the factory's diagnostics and startup log.
   * Booleans and names only — never token values.
   */
  diagnostics(): Record<string, unknown> {
    return {
      configured: true,
      baseUrl: this.baseUrl,
      oauthConfigured: Boolean(this.oauthApp),
      oauthScope: this.oauthApp?.scope ?? null,
      staticTokenFallback: Boolean(this.fallbackToken),
      redirectUri: this.redirectUri(),
      webhookSecretConfigured: Boolean(this.webhookSecret),
      storageBound: Boolean(this.storageHandle),
      projectsBound: Boolean(this.projects),
      capabilities: { intake: true, versionControl: false },
    };
  }
}

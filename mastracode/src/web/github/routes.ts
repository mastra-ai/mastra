/**
 * Hono routes for the GitHub App project feature.
 *
 * Mounted alongside the other `/api/web/*` routes, behind the WorkOS auth gate.
 * Every route additionally re-checks the authenticated user (`getWebAuthUser`)
 * and scopes all rows by that user's stable WorkOS id, so a user can only ever
 * see and operate on their own installations and projects.
 *
 * When the feature is disabled (`isGithubFeatureEnabled()` false), `mountGithubRoutes`
 * is a no-op except for `GET /api/web/github/status`, which reports `enabled:false`
 * so the SPA can cleanly hide all GitHub UI.
 */

import { and, eq } from 'drizzle-orm';
import type { Context, Hono } from 'hono';
import { streamSSE } from 'hono/streaming';
import { ensureWebAuthUser, getWebAuthUser, webAuthTenant } from '../auth';
import type { WebAuthTenant } from '../auth';
import {
  buildInstallUrl,
  buildOAuthIdentifyUrl,
  exchangeOAuthCode,
  getInstallationRepo,
  listInstallationRepos,
  listUserInstallations,
  mintInstallationToken,
} from './client';
import { isGithubFeatureEnabled, signState, verifyState } from './config';
import { getAppDb } from './db';
import { withProjectLock } from './project-lock';
import {
  commitAll,
  computeSandboxWorkdir,
  createPullRequest,
  ensureProjectSandbox,
  ensureWorktree,
  getSandboxProvider,
  isSandboxEnabled,
  isValidGitRef as isValidGitRefSandbox,
  materializeRepo,
  MaterializeError,
  pushBranch,
  reattachProjectSandbox,
  SandboxBudgetError,
  teardownProjectSandbox,
  WorktreeError,
} from './sandbox';
import type { GitIdentity, MaterializationSandbox, PrepareProgress, ProgressFn } from './sandbox';
import { githubInstallations, githubProjects, githubProjectSandboxes, githubWorktrees } from './schema';
import type { GithubProjectRow, GithubProjectSandboxRow } from './schema';

export interface MountGithubRoutesOptions {
  /**
   * Absolute base URL of the web server (e.g. `http://localhost:4111`), used to
   * build the OAuth/install redirect URI when one isn't explicitly configured.
   */
  baseUrl?: string;
  /** Explicit OAuth callback URI; defaults to `<baseUrl>/auth/github/callback`. */
  redirectUri?: string;
}

/** Validate an `owner/name` repo full name. */
function isValidRepoFullName(value: unknown): value is string {
  return typeof value === 'string' && value.length <= 256 && /^[\w.-]+\/[\w.-]+$/.test(value);
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
 */
function resolveOrgTenant(c: Context): { tenant: WebAuthTenant & { orgId: string } } | { response: Response } {
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
 * Shape returned to the SPA for a GitHub-backed project, matching the front-end
 * `Project` model (`source: 'github'`).
 */
function toProjectPayload(row: GithubProjectRow) {
  return {
    id: row.id,
    name: row.repoFullName,
    source: 'github' as const,
    githubProjectId: row.id,
  };
}

/**
 * Mount the GitHub routes. Returns whether the feature is enabled.
 */
export function mountGithubRoutes(app: Hono<any>, options: MountGithubRoutesOptions = {}): boolean {
  // The status route is always mounted so the SPA can detect the disabled state.
  app.get('/api/web/github/status', async c => {
    if (!isGithubFeatureEnabled()) {
      return c.json({ enabled: false, connected: false, installations: [] });
    }
    const tenant = webAuthTenant(c);
    if (!tenant) return c.json({ error: 'unauthorized' }, 401);

    // Org-scoped: personal (no-org) users have GitHub projects disabled. Report
    // enabled (so the SPA can show the org-required hint) but never connected.
    if (!tenant.orgId) {
      return c.json({
        enabled: true,
        sandboxEnabled: isSandboxEnabled(),
        organizationRequired: true,
        connected: false,
        installations: [],
      });
    }

    const rows = await getAppDb().select().from(githubInstallations).where(eq(githubInstallations.orgId, tenant.orgId));

    return c.json({
      enabled: true,
      sandboxEnabled: isSandboxEnabled(),
      connected: rows.length > 0,
      installations: rows.map(r => ({
        installationId: r.installationId,
        accountLogin: r.accountLogin,
        accountType: r.accountType,
      })),
    });
  });

  if (!isGithubFeatureEnabled()) {
    return false;
  }

  const redirectUri = options.redirectUri ?? `${(options.baseUrl ?? '').replace(/\/$/, '')}/auth/github/callback`;

  // ── Connect: redirect to the GitHub App install URL ─────────────────────
  app.get('/auth/github/connect', async c => {
    // Cookie-based browser navigation: the auth gate skips `/auth/*`, so resolve
    // the session from the request cookie before scoping the tenant.
    await ensureWebAuthUser(c);
    const resolved = resolveOrgTenant(c);
    if ('response' in resolved) return resolved.response;
    const state = signState(resolved.tenant.orgId, resolved.tenant.userId);
    return c.redirect(buildInstallUrl(state));
  });

  // ── Callback: confirm identity, persist the installation against the org ──
  app.get('/auth/github/callback', async c => {
    // Cookie-based browser navigation: the auth gate skips `/auth/*`, so resolve
    // the session from the request cookie before scoping the tenant.
    await ensureWebAuthUser(c);
    const resolved = resolveOrgTenant(c);
    if ('response' in resolved) return resolved.response;
    const { orgId, userId } = resolved.tenant;

    const state = c.req.query('state');
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
      return c.redirect(buildOAuthIdentifyUrl(signState(orgId, userId), redirectUri));
    }

    try {
      const userToken = await exchangeOAuthCode(code, redirectUri);
      const installations = await listUserInstallations(userToken);
      const db = getAppDb();
      for (const inst of installations) {
        // The installation is org-owned; `userId` records who connected it.
        await db
          .insert(githubInstallations)
          .values({
            orgId,
            userId,
            installationId: inst.installationId,
            accountLogin: inst.accountLogin,
            accountType: inst.accountType,
          })
          .onConflictDoNothing({
            target: [githubInstallations.orgId, githubInstallations.installationId],
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
  });

  // ── List repos across the org's installations ───────────────────────────
  app.get('/api/web/github/repos', async c => {
    const resolved = resolveOrgTenant(c);
    if ('response' in resolved) return resolved.response;

    const installs = await getAppDb()
      .select()
      .from(githubInstallations)
      .where(eq(githubInstallations.orgId, resolved.tenant.orgId));

    const query = (c.req.query('q') ?? '').toLowerCase();
    const repos = [];
    for (const inst of installs) {
      const list = await listInstallationRepos(inst.installationId);
      for (const repo of list) {
        if (query && !repo.fullName.toLowerCase().includes(query)) continue;
        repos.push(repo);
      }
    }
    return c.json({ repos });
  });

  // ── Create a project from a repo (no sandbox, no clone yet) ──────────────
  app.post('/api/web/github/projects', async c => {
    const resolved = resolveOrgTenant(c);
    if ('response' in resolved) return resolved.response;
    const { orgId, userId } = resolved.tenant;

    let body: { repoFullName?: unknown; installationId?: unknown };
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: 'Invalid JSON body' }, 400);
    }

    if (!isValidRepoFullName(body.repoFullName)) {
      return c.json({ error: 'Invalid repoFullName' }, 400);
    }
    const installationId = Number(body.installationId);
    if (!Number.isFinite(installationId)) {
      return c.json({ error: 'Invalid installationId' }, 400);
    }

    // The installation must belong to this org.
    const owned = await getAppDb()
      .select()
      .from(githubInstallations)
      .where(and(eq(githubInstallations.orgId, orgId), eq(githubInstallations.installationId, installationId)));
    if (owned.length === 0) {
      return c.json({ error: 'Installation not found for organization' }, 404);
    }

    // Verify the repo is actually accessible to the installation and use the
    // server-returned metadata rather than trusting the client's repoId /
    // defaultBranch. This prevents creating a project for an arbitrary repo.
    const repo = await getInstallationRepo(installationId, body.repoFullName);
    if (!repo) {
      return c.json({ error: 'Repository not accessible to installation' }, 404);
    }
    const defaultBranch = isValidGitRef(repo.defaultBranch) ? repo.defaultBranch : 'main';
    const sandboxWorkdir = computeSandboxWorkdir(repo.fullName);

    const [row] = await getAppDb()
      .insert(githubProjects)
      .values({
        orgId,
        userId,
        installationId,
        repoFullName: repo.fullName,
        repoId: repo.id,
        defaultBranch,
        sandboxProvider: getSandboxProvider(),
        sandboxWorkdir,
      })
      .onConflictDoUpdate({
        target: [githubProjects.orgId, githubProjects.repoId],
        set: { installationId, repoFullName: repo.fullName, defaultBranch, sandboxWorkdir },
      })
      .returning();

    return c.json({ project: toProjectPayload(row!) });
  });

  // ── Materialize a project into the caller's per-user sandbox ─────────────
  app.post('/api/web/github/projects/:id/ensure', async c => {
    const resolved = resolveOrgTenant(c);
    if ('response' in resolved) return resolved.response;
    const { orgId, userId } = resolved.tenant;

    if (!isSandboxEnabled()) {
      return c.json({ error: 'sandbox_not_configured', message: 'No sandbox provider is configured.' }, 503);
    }

    const projectId = c.req.param('id');
    if (!projectId) return c.json({ error: 'Project not found' }, 404);
    const [project] = await getAppDb()
      .select()
      .from(githubProjects)
      .where(and(eq(githubProjects.id, projectId), eq(githubProjects.orgId, orgId)));
    if (!project) {
      return c.json({ error: 'Project not found' }, 404);
    }

    // Stream live server-side progress when the client asks for it (EventSource
    // / fetch with `Accept: text/event-stream`); otherwise fall back to a single
    // JSON response so non-streaming callers and tests keep working unchanged.
    const wantsStream = (c.req.header('accept') ?? '').includes('text/event-stream');
    if (wantsStream) {
      return streamSSE(c, async stream => {
        try {
          const result = await prepareProject(
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
      const result = await prepareProject(project, userId);
      return c.json(result);
    } catch (err) {
      const { status, body } = ensureErrorPayload(err);
      return c.json(body, status);
    }
  });

  // ── Worktree / branch / commit / push / PR ──────────────────────────────
  mountProjectGitRoutes(app);

  return true;
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
async function resolveProjectSandbox(sandboxRow: GithubProjectSandboxRow): Promise<MaterializationSandbox> {
  if (!sandboxRow.sandboxId) {
    throw new MaterializeError('Project sandbox is not provisioned. Open the project first.', 'clone-failed');
  }
  return reattachProjectSandbox(sandboxRow.sandboxId);
}

/**
 * Load (or create) the caller's per-(project,user) sandbox binding row. The
 * binding inherits its workdir from the org-owned project, but `sandboxId` /
 * `materializedAt` stay null until the user first opens the project.
 */
async function loadOrCreateSandboxRow(project: GithubProjectRow, userId: string): Promise<GithubProjectSandboxRow> {
  const [existing] = await getAppDb()
    .select()
    .from(githubProjectSandboxes)
    .where(and(eq(githubProjectSandboxes.githubProjectId, project.id), eq(githubProjectSandboxes.userId, userId)));
  if (existing) return existing;

  const [created] = await getAppDb()
    .insert(githubProjectSandboxes)
    .values({
      githubProjectId: project.id,
      userId,
      sandboxWorkdir: project.sandboxWorkdir,
    })
    .onConflictDoNothing({ target: [githubProjectSandboxes.githubProjectId, githubProjectSandboxes.userId] })
    .returning();
  if (created) return created;

  // Lost a race: another request inserted the binding first. Re-read it.
  const [row] = await getAppDb()
    .select()
    .from(githubProjectSandboxes)
    .where(and(eq(githubProjectSandboxes.githubProjectId, project.id), eq(githubProjectSandboxes.userId, userId)));
  return row!;
}

interface EnsureResult {
  resourceId: string;
  githubProjectId: string;
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
  project: GithubProjectRow,
  userId: string,
  onProgress?: ProgressFn,
): Promise<EnsureResult> {
  const sandboxRow = await loadOrCreateSandboxRow(project, userId);
  const sandbox = await ensureProjectSandbox(sandboxRow, onProgress);
  // Re-read the sandbox binding so we have the freshly persisted sandboxId.
  const [fresh] = await getAppDb()
    .select()
    .from(githubProjectSandboxes)
    .where(eq(githubProjectSandboxes.id, sandboxRow.id));
  const token = await mintInstallationToken(project.installationId);
  const finalRow = fresh ?? sandboxRow;
  await materializeRepo(
    finalRow,
    { repoFullName: project.repoFullName, defaultBranch: project.defaultBranch },
    sandbox,
    token,
    onProgress,
  );
  const result: EnsureResult = {
    resourceId: project.id,
    githubProjectId: project.id,
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
 * `(githubProjectId, userId)`. Returns the tenant, project, and sandbox row, or
 * a ready-to-return error response.
 */
async function loadOwnedProject(
  c: Context,
): Promise<
  | { orgId: string; userId: string; project: GithubProjectRow; sandboxRow: GithubProjectSandboxRow }
  | { response: Response }
> {
  const resolved = resolveOrgTenant(c);
  if ('response' in resolved) return { response: resolved.response };
  const { orgId, userId } = resolved.tenant;

  if (!isSandboxEnabled()) {
    return {
      response: c.json({ error: 'sandbox_not_configured', message: 'No sandbox provider is configured.' }, 503),
    };
  }

  const projectId = c.req.param('id');
  if (!projectId) {
    return { response: c.json({ error: 'Project not found' }, 404) };
  }
  const [project] = await getAppDb()
    .select()
    .from(githubProjects)
    .where(and(eq(githubProjects.id, projectId), eq(githubProjects.orgId, orgId)));
  if (!project) {
    return { response: c.json({ error: 'Project not found' }, 404) };
  }
  const sandboxRow = await loadOrCreateSandboxRow(project, userId);
  return { orgId, userId, project, sandboxRow };
}

function mountProjectGitRoutes(app: Hono<any>): void {
  // ── Create / reuse a worktree + feature branch ──────────────────────────
  app.post('/api/web/github/projects/:id/worktree', async c => {
    const owned = await loadOwnedProject(c);
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
        const result = await ensureWorktree(sandbox, sandboxRow.sandboxWorkdir, { branch, baseBranch });

        await getAppDb()
          .insert(githubWorktrees)
          .values({
            orgId,
            userId,
            githubProjectId: project.id,
            branch: result.branch,
            baseBranch: result.baseBranch,
            worktreePath: result.worktreePath,
          })
          .onConflictDoUpdate({
            target: [githubWorktrees.githubProjectId, githubWorktrees.userId, githubWorktrees.branch],
            set: { baseBranch: result.baseBranch, worktreePath: result.worktreePath },
          });

        return c.json({
          worktreePath: result.worktreePath,
          branch: result.branch,
          baseBranch: result.baseBranch,
          resourceId: project.id,
        });
      });
    } catch (err) {
      return gitErrorResponse(c, err);
    }
  });

  // ── Stage all + commit inside a worktree ────────────────────────────────
  app.post('/api/web/github/projects/:id/commit', async c => {
    const owned = await loadOwnedProject(c);
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
    const workdir = await resolveWorktreePath(project.id, userId, body.worktreePath, sandboxRow.sandboxWorkdir);
    if (!workdir) {
      return c.json({ error: 'Invalid worktreePath' }, 400);
    }

    try {
      return await withProjectLock(`${project.id}:${userId}`, async () => {
        const sandbox = await resolveProjectSandbox(sandboxRow);
        const result = await commitAll(sandbox, workdir, body.message as string, identityFromUser(getWebAuthUser(c)));
        return c.json({ committed: result.committed });
      });
    } catch (err) {
      return gitErrorResponse(c, err);
    }
  });

  // ── Push a branch back to GitHub ────────────────────────────────────────
  app.post('/api/web/github/projects/:id/push', async c => {
    const owned = await loadOwnedProject(c);
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
    const workdir = await resolveWorktreePath(project.id, userId, body.worktreePath, sandboxRow.sandboxWorkdir);
    if (!workdir) {
      return c.json({ error: 'Invalid worktreePath' }, 400);
    }

    try {
      return await withProjectLock(`${project.id}:${userId}`, async () => {
        const sandbox = await resolveProjectSandbox(sandboxRow);
        const token = await mintInstallationToken(project.installationId);
        await pushBranch(sandbox, workdir, branch, token, project.repoFullName);
        return c.json({ pushed: true, branch });
      });
    } catch (err) {
      return gitErrorResponse(c, err);
    }
  });

  // ── Open a pull request via the gh CLI ──────────────────────────────────
  app.post('/api/web/github/projects/:id/pr', async c => {
    const owned = await loadOwnedProject(c);
    if ('response' in owned) return owned.response;
    const { userId, project, sandboxRow } = owned;

    let body: { branch?: unknown; base?: unknown; title?: unknown; body?: unknown; worktreePath?: unknown };
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
    const workdir = await resolveWorktreePath(project.id, userId, body.worktreePath, sandboxRow.sandboxWorkdir);
    if (!workdir) {
      return c.json({ error: 'Invalid worktreePath' }, 400);
    }

    try {
      return await withProjectLock(`${project.id}:${userId}`, async () => {
        const sandbox = await resolveProjectSandbox(sandboxRow);
        const token = await mintInstallationToken(project.installationId);
        const result = await createPullRequest(sandbox, workdir, { token, base, head, title, body: prBody });
        return c.json({ url: result.url });
      });
    } catch (err) {
      return gitErrorResponse(c, err);
    }
  });

  // ── Tear down the caller's sandbox for a project ────────────────────────
  // Per-user teardown only: drops the caller's `(project, user)` sandbox
  // binding and stops the VM, freeing a slot in the per-replica budget. Project
  // deletion at the org level is out of scope (org admin model is later).
  app.delete('/api/web/github/projects/:id/sandbox', async c => {
    const owned = await loadOwnedProject(c);
    if ('response' in owned) return owned.response;
    const { userId, project, sandboxRow } = owned;

    if (!sandboxRow.sandboxId) {
      // Nothing provisioned for this user — idempotent success.
      return c.json({ tornDown: false });
    }

    try {
      return await withProjectLock(`${project.id}:${userId}`, async () => {
        const sandbox = await reattachProjectSandbox(sandboxRow.sandboxId!);
        await teardownProjectSandbox(sandboxRow, sandbox);
        return c.json({ tornDown: true });
      });
    } catch (err) {
      return gitErrorResponse(c, err);
    }
  });
}

/**
 * Resolve and validate the worktree path a git write operation targets. The
 * path is never trusted from the client verbatim: it must either be the
 * project's repo workdir (committing/pushing on the base checkout) or match a
 * persisted worktree row for this project. Returns the validated path or
 * `undefined` when it isn't recognized.
 */
async function resolveWorktreePath(
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
  const [row] = await getAppDb()
    .select()
    .from(githubWorktrees)
    .where(
      and(
        eq(githubWorktrees.githubProjectId, projectId),
        eq(githubWorktrees.userId, userId),
        eq(githubWorktrees.worktreePath, worktreePath),
      ),
    );
  return row ? row.worktreePath : undefined;
}

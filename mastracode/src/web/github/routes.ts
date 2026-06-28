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
import { getWebAuthUser, getWebAuthUserId } from '../auth';
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
  WorktreeError,
} from './sandbox';
import type { GitIdentity, MaterializationSandbox } from './sandbox';
import { githubInstallations, githubProjects, githubWorktrees } from './schema';
import type { GithubProjectRow } from './schema';

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
    const userId = getWebAuthUserId(getWebAuthUser(c));
    if (!userId) return c.json({ error: 'unauthorized' }, 401);

    const rows = await getAppDb().select().from(githubInstallations).where(eq(githubInstallations.userId, userId));

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
  app.get('/auth/github/connect', c => {
    const userId = getWebAuthUserId(getWebAuthUser(c));
    if (!userId) return c.json({ error: 'unauthorized' }, 401);
    const state = signState(userId);
    return c.redirect(buildInstallUrl(state));
  });

  // ── Callback: confirm identity, persist the installation ────────────────
  app.get('/auth/github/callback', async c => {
    const userId = getWebAuthUserId(getWebAuthUser(c));
    if (!userId) return c.json({ error: 'unauthorized' }, 401);

    const state = c.req.query('state');
    const stateUserId = verifyState(state);
    if (!stateUserId || stateUserId !== userId) {
      // CSRF / cross-user linking protection: the signed state must belong to
      // the same logged-in user.
      return c.redirect('/?github=error');
    }

    const code = c.req.query('code');
    // We only ever persist installations that GitHub confirms belong to *this*
    // user via the OAuth code path. The raw `installation_id` from the install
    // redirect is not trusted on its own — anyone with a valid state could pass
    // an arbitrary id — so when no code is present we bounce through the OAuth
    // identify flow to obtain a verified user token first.
    if (!code) {
      return c.redirect(buildOAuthIdentifyUrl(signState(userId), redirectUri));
    }

    try {
      const userToken = await exchangeOAuthCode(code, redirectUri);
      const installations = await listUserInstallations(userToken);
      const db = getAppDb();
      for (const inst of installations) {
        await db
          .insert(githubInstallations)
          .values({
            userId,
            installationId: inst.installationId,
            accountLogin: inst.accountLogin,
            accountType: inst.accountType,
          })
          .onConflictDoNothing({
            target: [githubInstallations.userId, githubInstallations.installationId],
          });
      }
    } catch {
      return c.redirect('/?github=error');
    }

    return c.redirect('/?github=connected');
  });

  // ── List repos across the user's installations ──────────────────────────
  app.get('/api/web/github/repos', async c => {
    const userId = getWebAuthUserId(getWebAuthUser(c));
    if (!userId) return c.json({ error: 'unauthorized' }, 401);

    const installs = await getAppDb().select().from(githubInstallations).where(eq(githubInstallations.userId, userId));

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
    const userId = getWebAuthUserId(getWebAuthUser(c));
    if (!userId) return c.json({ error: 'unauthorized' }, 401);

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

    // The installation must belong to this user.
    const owned = await getAppDb()
      .select()
      .from(githubInstallations)
      .where(and(eq(githubInstallations.userId, userId), eq(githubInstallations.installationId, installationId)));
    if (owned.length === 0) {
      return c.json({ error: 'Installation not found for user' }, 404);
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
        userId,
        installationId,
        repoFullName: repo.fullName,
        repoId: repo.id,
        defaultBranch,
        sandboxProvider: getSandboxProvider(),
        sandboxWorkdir,
      })
      .onConflictDoUpdate({
        target: [githubProjects.userId, githubProjects.repoId],
        set: { installationId, repoFullName: repo.fullName, defaultBranch, sandboxWorkdir },
      })
      .returning();

    return c.json({ project: toProjectPayload(row!) });
  });

  // ── Materialize a project into its sandbox ──────────────────────────────
  app.post('/api/web/github/projects/:id/ensure', async c => {
    const userId = getWebAuthUserId(getWebAuthUser(c));
    if (!userId) return c.json({ error: 'unauthorized' }, 401);

    if (!isSandboxEnabled()) {
      return c.json({ error: 'sandbox_not_configured', message: 'No sandbox provider is configured.' }, 503);
    }

    const projectId = c.req.param('id');
    const [row] = await getAppDb()
      .select()
      .from(githubProjects)
      .where(and(eq(githubProjects.id, projectId), eq(githubProjects.userId, userId)));
    if (!row) {
      return c.json({ error: 'Project not found' }, 404);
    }

    try {
      const sandbox = await ensureProjectSandbox(row);
      // Re-read the row so we have the freshly persisted sandboxId.
      const [fresh] = await getAppDb().select().from(githubProjects).where(eq(githubProjects.id, row.id));
      const token = await mintInstallationToken(row.installationId);
      const finalRow = fresh ?? row;
      await materializeRepo(finalRow, sandbox, token);

      return c.json({
        resourceId: row.id,
        githubProjectId: row.id,
        sandboxId: finalRow.sandboxId,
        sandboxWorkdir: finalRow.sandboxWorkdir,
      });
    } catch (err) {
      if (err instanceof MaterializeError) {
        return c.json({ error: err.code, message: err.message }, 502);
      }
      return c.json({ error: 'materialize_failed', message: err instanceof Error ? err.message : String(err) }, 500);
    }
  });

  // ── Worktree / branch / commit / push / PR ──────────────────────────────
  mountProjectGitRoutes(app);

  return true;
}

/**
 * In-process per-project async mutex. The push/PR flows temporarily rewrite the
 * sandbox git remote to a tokenized URL and scrub it again in a `finally`; two
 * concurrent operations on the same project could interleave those rewrites and
 * leak a tokenized remote. Serializing per `githubProjectId` removes that race.
 *
 * This lock is in-process only; multi-replica deploys need a shared lock
 * (called out as out-of-scope follow-up in the plan).
 */
const projectLocks = new Map<string, Promise<unknown>>();

function withProjectLock<T>(projectId: string, fn: () => Promise<T>): Promise<T> {
  const prev = projectLocks.get(projectId) ?? Promise.resolve();
  const next = prev.then(fn, fn);
  // Keep the chain alive but swallow rejections so one failure doesn't poison
  // the lock for subsequent callers.
  projectLocks.set(
    projectId,
    next.then(
      () => undefined,
      () => undefined,
    ),
  );
  return next;
}

/** Derive a commit/author identity from the authenticated WorkOS user. */
function identityFromUser(user: { name?: string; email?: string } | undefined): GitIdentity {
  return { name: user?.name ?? null, email: user?.email ?? null };
}

/**
 * Resolve a live, started sandbox for a project row. The project must already
 * have been materialized (`sandboxId` set) — the git write routes never clone,
 * they operate on the existing checkout.
 */
async function resolveProjectSandbox(row: GithubProjectRow): Promise<MaterializationSandbox> {
  if (!row.sandboxId) {
    throw new MaterializeError('Project sandbox is not provisioned. Open the project first.', 'clone-failed');
  }
  return reattachProjectSandbox(row.sandboxId);
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
 * Look up a project row scoped to the authenticated user. Returns the userId and
 * row, or a ready-to-return error response. Centralizes the auth + ownership
 * checks every git route shares.
 */
async function loadOwnedProject(
  c: Context,
): Promise<{ userId: string; row: GithubProjectRow } | { response: Response }> {
  const userId = getWebAuthUserId(getWebAuthUser(c));
  if (!userId) return { response: c.json({ error: 'unauthorized' }, 401) };

  if (!isSandboxEnabled()) {
    return {
      response: c.json({ error: 'sandbox_not_configured', message: 'No sandbox provider is configured.' }, 503),
    };
  }

  const projectId = c.req.param('id');
  if (!projectId) {
    return { response: c.json({ error: 'Project not found' }, 404) };
  }
  const [row] = await getAppDb()
    .select()
    .from(githubProjects)
    .where(and(eq(githubProjects.id, projectId), eq(githubProjects.userId, userId)));
  if (!row) {
    return { response: c.json({ error: 'Project not found' }, 404) };
  }
  return { userId, row };
}

function mountProjectGitRoutes(app: Hono<any>): void {
  // ── Create / reuse a worktree + feature branch ──────────────────────────
  app.post('/api/web/github/projects/:id/worktree', async c => {
    const owned = await loadOwnedProject(c);
    if ('response' in owned) return owned.response;
    const { userId, row } = owned;

    let body: { branch?: unknown; baseBranch?: unknown };
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: 'Invalid JSON body' }, 400);
    }
    if (!isValidGitRefSandbox(body.branch)) {
      return c.json({ error: 'Invalid branch' }, 400);
    }
    const baseBranch = body.baseBranch === undefined ? row.defaultBranch : body.baseBranch;
    if (!isValidGitRefSandbox(baseBranch)) {
      return c.json({ error: 'Invalid baseBranch' }, 400);
    }
    const branch = body.branch;

    try {
      return await withProjectLock(row.id, async () => {
        const sandbox = await resolveProjectSandbox(row);
        const result = await ensureWorktree(sandbox, row.sandboxWorkdir, { branch, baseBranch });

        await getAppDb()
          .insert(githubWorktrees)
          .values({
            userId,
            githubProjectId: row.id,
            branch: result.branch,
            baseBranch: result.baseBranch,
            worktreePath: result.worktreePath,
          })
          .onConflictDoUpdate({
            target: [githubWorktrees.githubProjectId, githubWorktrees.branch],
            set: { baseBranch: result.baseBranch, worktreePath: result.worktreePath },
          });

        return c.json({
          worktreePath: result.worktreePath,
          branch: result.branch,
          baseBranch: result.baseBranch,
          resourceId: row.id,
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
    const { row } = owned;

    let body: { message?: unknown; worktreePath?: unknown };
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: 'Invalid JSON body' }, 400);
    }
    if (typeof body.message !== 'string' || body.message.trim().length === 0 || body.message.length > 5000) {
      return c.json({ error: 'Invalid message' }, 400);
    }
    const workdir = await resolveWorktreePath(row.id, body.worktreePath, row.sandboxWorkdir);
    if (!workdir) {
      return c.json({ error: 'Invalid worktreePath' }, 400);
    }

    try {
      return await withProjectLock(row.id, async () => {
        const sandbox = await resolveProjectSandbox(row);
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
    const { row } = owned;

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
    const workdir = await resolveWorktreePath(row.id, body.worktreePath, row.sandboxWorkdir);
    if (!workdir) {
      return c.json({ error: 'Invalid worktreePath' }, 400);
    }

    try {
      return await withProjectLock(row.id, async () => {
        const sandbox = await resolveProjectSandbox(row);
        const token = await mintInstallationToken(row.installationId);
        await pushBranch(sandbox, workdir, branch, token, row.repoFullName);
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
    const { row } = owned;

    let body: { branch?: unknown; base?: unknown; title?: unknown; body?: unknown; worktreePath?: unknown };
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: 'Invalid JSON body' }, 400);
    }
    if (!isValidGitRefSandbox(body.branch)) {
      return c.json({ error: 'Invalid branch' }, 400);
    }
    const base = body.base === undefined ? row.defaultBranch : body.base;
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
    const workdir = await resolveWorktreePath(row.id, body.worktreePath, row.sandboxWorkdir);
    if (!workdir) {
      return c.json({ error: 'Invalid worktreePath' }, 400);
    }

    try {
      return await withProjectLock(row.id, async () => {
        const sandbox = await resolveProjectSandbox(row);
        const token = await mintInstallationToken(row.installationId);
        const result = await createPullRequest(sandbox, workdir, { token, base, head, title, body: prBody });
        return c.json({ url: result.url });
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
    .where(and(eq(githubWorktrees.githubProjectId, projectId), eq(githubWorktrees.worktreePath, worktreePath)));
  return row ? row.worktreePath : undefined;
}

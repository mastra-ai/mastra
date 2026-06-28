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
import type { Hono } from 'hono';
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
  computeSandboxWorkdir,
  ensureProjectSandbox,
  getSandboxProvider,
  isSandboxEnabled,
  materializeRepo,
  MaterializeError,
} from './sandbox';
import { githubInstallations, githubProjects } from './schema';
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

  return true;
}

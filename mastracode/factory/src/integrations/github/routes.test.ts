import { createHmac } from 'node:crypto';
import { Hono } from 'hono';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ListIntakeIssuesInput } from '../../capabilities/intake.js';
import type { CreatePullRequestInput, ListPullRequestsInput } from '../../capabilities/version-control.js';
import type { RouteAuth } from '../../routes/route.js';
import { mountApiRoutes } from '../../routes/test-utils.js';

import { SessionRetirementCoordinator } from '../../sandbox/session-retirement.js';
import { __clearSessionSandboxesForTests, getSessionSandbox } from '../../sandbox/session-sandbox.js';

// ── Mocks ────────────────────────────────────────────────────────────────
// Mock drizzle's `eq`/`and` so the fake DB below can honour `where` predicates.
// Each `eq(col, val)` yields a `{ column, value }` descriptor (using the
// column's `.name`), and `and(...)` wraps them so `filterRows` can apply them.
vi.mock('drizzle-orm', () => ({
  eq: (column: any, value: any) => ({ kind: 'eq', column: column?.name, value }),
  and: (...conds: any[]) => ({ kind: 'and', conds: conds.filter(Boolean) }),
}));

// In-memory tables so route handlers exercise real query-builder call shapes
// against a tiny fake. We only model the operations the routes actually use.
interface Tables {
  installations: Array<Record<string, any>>;
  repositories: Array<Record<string, any>>;
  connections: Array<Record<string, any>>;
  projectRepositories: Array<Record<string, any>>;
  sandboxes: Array<Record<string, any>>;
  worktrees: Array<Record<string, any>>;
  sessions: Array<Record<string, any>>;
  subscriptions: Array<Record<string, any>>;
}
const tables: Tables = {
  installations: [],
  repositories: [],
  connections: [],
  projectRepositories: [],
  sandboxes: [],
  worktrees: [],
  sessions: [],
  subscriptions: [],
};

import { SourceControlStorageInMemory } from '../../storage/domains/source-control/inmemory.js';
const sourceControlStorage = new SourceControlStorageInMemory();

function installationRow(row: Record<string, any>) {
  return {
    id: row.id ?? `installation-${row.orgId}-${row.installationId}`,
    integrationId: 'github',
    orgId: row.orgId,
    connectedByUserId: row.userId,
    externalId: String(row.installationId),
    accountName: row.accountLogin ?? null,
    accountType: row.accountType ?? null,
    providerMetadata: {},
    createdAt: row.createdAt ?? new Date(),
  };
}

function projectRepositoryRow(row: Record<string, any>) {
  const installationId = `installation-${row.orgId}-${row.installationId}`;
  const repositoryId = `repository-${row.repoId ?? row.repoFullName}`;
  const connectionId = `connection-${row.id}`;
  const now = row.createdAt ?? new Date();

  if (!tables.installations.some(candidate => candidate.id === installationId)) {
    tables.installations.push(
      installationRow({
        id: installationId,
        orgId: row.orgId,
        userId: row.userId,
        installationId: row.installationId,
        accountLogin: row.accountLogin ?? 'octo',
        accountType: row.accountType ?? 'User',
        createdAt: now,
      }),
    );
  }
  if (!tables.repositories.some(candidate => candidate.id === repositoryId)) {
    tables.repositories.push({
      id: repositoryId,
      installationId,
      externalId: String(row.repoId ?? 99),
      slug: row.repoFullName,
      defaultBranch: row.defaultBranch ?? 'main',
      providerMetadata: row.providerMetadata ?? {},
      createdAt: now,
      updatedAt: now,
    });
  }
  if (!tables.connections.some(candidate => candidate.id === connectionId)) {
    tables.connections.push({
      id: connectionId,
      factoryProjectId: row.factoryProjectId ?? `factory-${row.id}`,
      integrationId: 'github',
      installationId,
      createdByUserId: row.userId,
      createdAt: now,
    });
  }

  return {
    id: row.id,
    connectionId,
    repositoryId,
    branch: row.defaultBranch ?? null,
    sandboxProvider: row.sandboxProvider ?? 'railway',
    sandboxWorkdir: row.sandboxWorkdir,
    setupCommand: row.setupCommand ?? null,
    teardownCommand: row.teardownCommand ?? null,
    createdAt: now,
    updatedAt: now,
  };
}

function sandboxRow(row: Record<string, any>) {
  return { ...row, projectRepositoryId: row.projectRepositoryId };
}

function subscriptionRow(row: Record<string, any>) {
  if (row.targetKey) return row;
  return {
    id: row.id,
    integrationId: 'github',
    orgId: row.orgId,
    targetKey: `change-request:${row.installationId}:${row.repoId}:${row.pullRequestNumber}`,
    sessionId: row.sessionId,
    resourceId: row.resourceId,
    threadId: row.threadId,
    sessionScope: row.sessionScope ?? '',
    status: row.status,
    data: {
      installationExternalId: String(row.installationId),
      projectRepositoryId: row.projectRepositoryId,
      repositoryExternalId: String(row.repoId),
      repositorySlug: row.repoFullName,
      changeRequestId: String(row.pullRequestNumber),
      ownerId: row.ownerId,
      source: row.source,
      subscribedByUserId: row.subscribedByUserId ?? null,
    },
    createdAt: row.createdAt ?? new Date(),
    updatedAt: row.updatedAt ?? new Date(),
  };
}

const settingsRows = new Map<string, Record<string, any>>();

const integrationStorage = {
  settings: {
    get: vi.fn(async (orgId: string, userId: string) => settingsRows.get(`${orgId}:${userId}`) ?? null),
    save: vi.fn(async (orgId: string, userId: string, config: Record<string, any>) => {
      settingsRows.set(`${orgId}:${userId}`, config);
    }),
  },
  subscriptions: {
    create: vi.fn(async (input: Record<string, any>) => {
      const row = subscriptionRow({
        ...input,
        id: `subscription-${tables.subscriptions.length + 1}`,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      tables.subscriptions.push(row);
      return row;
    }),
    listByTarget: vi.fn(async (targetKey: string) =>
      tables.subscriptions.map(subscriptionRow).filter(row => row.targetKey === targetKey),
    ),
    listBySession: vi.fn(async (sessionId: string) =>
      tables.subscriptions.map(subscriptionRow).filter(row => row.sessionId === sessionId),
    ),
    listByThread: vi.fn(async (resourceId: string, threadId: string) =>
      tables.subscriptions
        .map(subscriptionRow)
        .filter(row => row.resourceId === resourceId && row.threadId === threadId),
    ),
    updateStatus: vi.fn(async (id: string, status: string) => {
      const row = tables.subscriptions.find(candidate => candidate.id === id);
      if (row) row.status = status;
    }),
    delete: vi.fn(async (id: string) => {
      const index = tables.subscriptions.findIndex(row => row.id === id);
      if (index >= 0) tables.subscriptions.splice(index, 1);
    }),
    deleteWhere: vi.fn(async () => 0),
  },
};

// Capture events through the injected audit seam. The fake preserves the
// domain's actor resolution and never-throw behavior so route tests stay focused.
let auditRecorded: Array<Record<string, any>> = [];
let auditFailure: Error | undefined;

vi.mock('./db', () => {
  // Minimal chainable drizzle-like stub keyed off the table object identity.
  const makeDb = () => ({
    select: () => ({
      from: (table: any) => ({
        where: async (cond: any) => filterRows(table, cond),
      }),
    }),
    insert: (table: any) => ({
      values: (vals: any) => {
        const chain = {
          onConflictDoNothing: (opts?: any) => {
            const ret = insertIfAbsent(table, vals, opts);
            const promise: any = Promise.resolve(ret ? [ret] : []);
            promise.returning = async () => (ret ? [ret] : []);
            return promise;
          },
          onConflictDoUpdate: (opts: any) => {
            const ret = upsertRow(table, vals, opts);
            return { returning: async () => [ret] };
          },
          returning: async () => [insertRow(table, vals)],
        };
        return chain;
      },
    }),
    update: (table: any) => ({
      set: (vals: any) => ({ where: async () => updateRows(table, vals) }),
    }),
    delete: (table: any) => ({
      where: async (cond: any) => deleteRows(table, cond),
    }),
  });
  return { getAppDb: () => makeDb() };
});

const listRepoOpenIssues = vi.fn(
  async (_installationId: number, _repoFullName: string, _page: number, _options?: { label?: string }) => ({
    issues: [
      {
        number: 12,
        title: 'Fix flaky test',
        url: 'https://github.com/octo/hello/issues/12',
        author: 'ada',
        assignee: 'grace',
        labels: ['bug'],
        comments: 3,
        createdAt: '2026-07-01T00:00:00Z',
        updatedAt: '2026-07-02T00:00:00Z',
      },
    ],
    nextPage: null as number | null,
  }),
);
const addIssueLabels = vi.fn(
  async (_installationId: number, _repoFullName: string, _issueNumber: number, _labels: string[]) => {},
);
const removeIssueLabel = vi.fn(
  async (_installationId: number, _repoFullName: string, _issueNumber: number, _label: string) => {},
);
const listRepoOpenPullRequests = vi.fn(async (_installationId: number, _repoFullName: string, _page: number) => ({
  pullRequests: [
    {
      number: 34,
      title: 'Add factory pages',
      url: 'https://github.com/octo/hello/pull/34',
      author: 'grace',
      assignees: ['ada'],
      requestedReviewers: ['octocat'],
      baseBranch: 'main',
      headBranch: 'feat/factory',
      createdAt: '2026-07-03T00:00:00Z',
      updatedAt: '2026-07-04T00:00:00Z',
    },
  ],
  nextPage: null as number | null,
}));
const getIssueDetail = vi.fn(
  async (_installationId: number, _repoFullName: string, issueId: string): Promise<Record<string, unknown> | null> =>
    issueId === '12'
      ? {
          id: '12',
          identifier: '#12',
          title: 'Fix flaky test',
          url: 'https://github.com/octo/hello/issues/12',
          author: 'ada',
          state: 'open',
          stateType: 'open',
          priority: null,
          assignee: 'grace',
          source: 'octo/hello',
          labels: ['bug'],
          commentCount: 3,
          createdAt: '2026-07-01T00:00:00Z',
          updatedAt: '2026-07-02T00:00:00Z',
          description: 'The test flakes on CI.',
          comments: [],
        }
      : null,
);
const getPullRequestDetail = vi.fn(
  async (
    _installationId: number,
    _repoFullName: string,
    pullRequestId: string,
  ): Promise<Record<string, unknown> | null> =>
    pullRequestId === '34'
      ? {
          id: '34',
          title: 'Add factory pages',
          url: 'https://github.com/octo/hello/pull/34',
          author: 'grace',
          assignees: ['ada'],
          requestedReviewers: [],
          labels: [],
          body: 'Implements the factory pages.',
          state: 'open',
          draft: false,
          merged: false,
          mergeable: null,
          baseBranch: 'main',
          headBranch: 'feat/factory',
          headSha: 'abc123',
          createdAt: '2026-07-03T00:00:00Z',
          updatedAt: '2026-07-04T00:00:00Z',
        }
      : null,
);

// Stub GithubIntegration instance injected into `buildGithubRoutes` — real DI
// instead of module mocking (github/client.ts no longer exists).
const githubStub = {
  sourceControlStorage,
  integrationStorage,
  webhookSecret: undefined as string | undefined,
  buildInstallUrl: (state: string) => `https://github.com/apps/test/installations/new?state=${state}`,
  buildOAuthIdentifyUrl: (state: string) => `https://github.com/login/oauth/authorize?state=${state}`,
  exchangeOAuthCode: vi.fn(async () => 'user-token'),
  getRepositoryCollaboratorPermission: vi.fn(async () => 'write'),
  listUserInstallations: vi.fn(async () => [{ installationId: 7, accountLogin: 'octo', accountType: 'User' }]),
  listInstallationRepos: vi.fn(async (_installationId: number) => [
    {
      id: 99,
      fullName: 'octo/hello',
      name: 'hello',
      owner: 'octo',
      defaultBranch: 'main',
      private: false,
      installationId: 7,
    },
  ]),
  getInstallationRepo: vi.fn(async (installationId: number, fullName: string) =>
    fullName === 'octo/hello'
      ? {
          id: 99,
          fullName: 'octo/hello',
          name: 'hello',
          owner: 'octo',
          defaultBranch: 'main',
          private: false,
          installationId,
        }
      : null,
  ),
  mintInstallationToken: vi.fn(async () => 'install-token'),
  addIssueLabels: (installationId: number, repoFullName: string, issueNumber: number, labels: string[]) =>
    addIssueLabels(installationId, repoFullName, issueNumber, labels),
  removeIssueLabel: (installationId: number, repoFullName: string, issueNumber: number, label: string) =>
    removeIssueLabel(installationId, repoFullName, issueNumber, label),
  listRepoOpenIssues: (installationId: number, repoFullName: string, page: number, options?: { label?: string }) =>
    listRepoOpenIssues(installationId, repoFullName, page, options),
  intake: {
    getIssue: async (input: {
      connection: { type: string; installationId: number };
      sourceId?: string;
      issueId: string;
    }) => {
      if (input.connection.type !== 'app-installation') throw new Error('expected installation connection');
      return getIssueDetail(input.connection.installationId, input.sourceId ?? '', input.issueId);
    },
    listIssues: async (input: ListIntakeIssuesInput) => {
      if (input.connection.type !== 'app-installation') throw new Error('expected installation connection');
      const result = await listRepoOpenIssues(
        input.connection.installationId,
        input.sourceIds[0]!,
        Number(input.cursor ?? '1'),
        { label: input.labels?.join(',') },
      );
      return {
        issues: result.issues.map(issue => ({
          id: String(issue.number),
          identifier: `#${issue.number}`,
          title: issue.title,
          url: issue.url,
          author: issue.author,
          state: 'open',
          stateType: 'open',
          priority: null,
          assignee: issue.assignee,
          source: input.sourceIds[0]!,
          labels: issue.labels,
          commentCount: issue.comments,
          createdAt: issue.createdAt,
          updatedAt: issue.updatedAt,
        })),
        nextCursor: result.nextPage === null ? null : String(result.nextPage),
      };
    },
  },
  versionControl: {
    getRepositoryAccess: vi.fn(async ({ repositoryId }: { orgId: string; repositoryId: string }) => ({
      cloneUrl: `https://github.com/octo/hello.git`,
      authorization: { scheme: 'bearer' as const, token: `repo-token-${repositoryId}` },
    })),
    getPullRequest: async (input: {
      connection: { type: string; installationId: number };
      sourceId: string;
      pullRequestId: string;
    }) => {
      if (input.connection.type !== 'app-installation') throw new Error('expected installation connection');
      return getPullRequestDetail(input.connection.installationId, input.sourceId, input.pullRequestId);
    },
    listPullRequests: async (input: ListPullRequestsInput) => {
      if (input.connection.type !== 'app-installation') throw new Error('expected installation connection');
      const result = await listRepoOpenPullRequests(
        input.connection.installationId,
        input.sourceId,
        Number(input.cursor ?? '1'),
      );
      return {
        pullRequests: result.pullRequests.map(pr => ({ ...pr, id: String(pr.number) })),
        nextCursor: result.nextPage === null ? null : String(result.nextPage),
      };
    },
    createPullRequest: async (input: CreatePullRequestInput) => {
      const result = await createPullRequest(input);
      return {
        id: '1',
        title: input.title,
        url: result.url,
        author: 'octo',
        body: input.body ?? null,
        state: 'open' as const,
        draft: input.draft ?? false,
        merged: false,
        mergeable: null,
        baseBranch: input.baseBranch,
        headBranch: input.headBranch,
        headSha: 'abc123',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      };
    },
  },
};

// Deterministic state signer stub (replaces the old signState/verifyState mocks).
const stateSigner = {
  stable: true,
  sign: (orgId: string, userId: string) => `state.${orgId}.${userId}`,
  verify: (state: string | undefined) => {
    if (!state?.startsWith('state.')) return null;
    const [orgId, userId] = state.slice('state.'.length).split('.');
    if (!orgId || !userId) return null;
    return { orgId, userId };
  },
};

const materializeRepo = vi.fn(async (opts: { onProgress?: (e: any) => void }) => {
  opts.onProgress?.({ phase: 'cloning', message: 'Cloning octo/hello…' });
});
const runSetupCommand = vi.fn(async (_sb: any, _worktreePath: string, _command: string) => {});
const runTeardownCommand = vi.fn(async (_sb: any, _worktreePath: string, _command: string) => {});
const commitAll = vi.fn(async () => ({ committed: true }));
const pushBranch = vi.fn(async () => {});
const createPullRequest = vi.fn(async (_input: CreatePullRequestInput) => ({
  url: 'https://github.com/octo/hello/pull/1',
}));
let sandboxEnabled = true;
/**
 * DI-injected sandbox callback stub — presence signals "configured".
 * A `vi.fn` so tests can assert the factory never constructed a sandbox.
 */
const sandboxCallback = vi.fn((ctx: { sessionId: string }) => ({ id: `sbx-${ctx.sessionId}` })) as any;
vi.mock('./sandbox', () => {
  class MaterializeError extends Error {
    code: string;
    constructor(m: string, code: string) {
      super(m);
      this.code = code;
    }
  }
  class SetupCommandError extends Error {
    code: string;
    constructor(m: string, code: string) {
      super(m);
      this.code = code;
    }
  }
  return {
    DEFAULT_COMMAND_TIMEOUT_MS: 15 * 60_000,
    materializeRepo: (opts: any) => materializeRepo(opts),
    runSetupCommand: (sb: any, worktreePath: string, command: string) => runSetupCommand(sb, worktreePath, command),
    runTeardownCommand: (sb: any, worktreePath: string, command: string, options?: { timeoutMs?: number }) =>
      runTeardownCommand(sb, worktreePath, command, options),
    commitAll: (...args: any[]) => commitAll(...(args as [])),
    pushBranch: (...args: any[]) => pushBranch(...(args as [])),
    createPullRequest: (input: any) => createPullRequest(input),
    // Match the real ref validator closely enough for route tests.
    isValidGitRef: (v: unknown): v is string =>
      typeof v === 'string' && v.length > 0 && v.length <= 255 && /^[A-Za-z0-9_./-]+$/.test(v),
    MaterializeError,
    SetupCommandError,
  };
});

let featureEnabled = true;
vi.mock('./config', () => ({
  isGithubFeatureEnabled: () => featureEnabled,
  getGithubFeatureDiagnostics: () => ({}),
}));

// RouteAuth fake mirroring the web host: the harness middleware stashes a
// `factoryAuthUser` on the context, and `ensureUser` additionally simulates
// cookie-based session resolution (`cookieUser`) the same way production
// resolves a session cookie before scoping the tenant.
let cookieUser: { workosId: string; organizationId?: string } | null = null;
const testAuth: RouteAuth = {
  enabled: () => true,
  ensureUser: async (c: any) => {
    const existing = c.get('factoryAuthUser');
    if (existing) return existing;
    if (!cookieUser) return undefined;
    const withOrg: { workosId: string; organizationId?: string } = {
      workosId: cookieUser.workosId,
      organizationId: cookieUser.organizationId ?? 'org1',
    };
    c.set('factoryAuthUser', withOrg);
    return withOrg;
  },
  tenant: (c: any) => {
    const u = c.get('factoryAuthUser') as { workosId: string; organizationId?: string } | undefined;
    return u ? { orgId: u.organizationId, userId: u.workosId } : undefined;
  },
  isOrganizationAdmin: async () => true,
};

import { buildGithubRoutes } from './routes.js';

// ── Fake table helpers ──────────────────────────────────────────────────
function tableKind(table: any): keyof Tables {
  if (table === installationsRef) return 'installations';
  if (table === worktreesRef) return 'worktrees';
  if (table === sandboxesRef) return 'sandboxes';
  if (table === subscriptionsRef) return 'subscriptions';
  return 'projectRepositories';
}
// We can't import the actual schema objects easily into the closure used by the
// mock above, so resolve them lazily here for the helpers.
let installationsRef: any;
let worktreesRef: any;
let sandboxesRef: any;
let subscriptionsRef: any;

// Drizzle columns carry their snake_case DB `.name`, but our fake rows use the
// camelCase JS keys. Build a DB-name → JS-key map per table so predicates match.
function dbNameToJsKey(table: any, dbName: string): string {
  for (const [jsKey, col] of Object.entries(table)) {
    if ((col as any)?.name === dbName) return jsKey;
  }
  return dbName;
}

// Apply a mocked `eq`/`and` predicate to a row.
function matches(table: any, row: any, cond: any): boolean {
  if (!cond) return true;
  if (cond.kind === 'and') return cond.conds.every((c: any) => matches(table, row, c));
  if (cond.kind === 'eq') return row[dbNameToJsKey(table, cond.column)] === cond.value;
  return true;
}

function filterRows(table: any, cond?: any): any[] {
  return tables[tableKind(table)].filter(row => matches(table, row, cond));
}
function insertRow(table: any, vals: any): any {
  const kind = tableKind(table);
  const row = { id: `id-${tables[kind].length + 1}`, ...vals };
  tables[kind].push(row as any);
  return row;
}
function upsertRow(table: any, vals: any, opts: any): any {
  const kind = tableKind(table);
  // Conflict targets are columns; match an existing row on all of them (mapped
  // back to JS keys since vals/rows are camelCase).
  const targets: string[] = (opts?.target ?? [])
    .map((col: any) => (col?.name ? dbNameToJsKey(table, col.name) : undefined))
    .filter(Boolean);
  const existing = tables[kind].find(row => targets.every(t => row[t] === vals[t]));
  if (existing) {
    Object.assign(existing, opts?.set ?? {});
    return existing;
  }
  return insertRow(table, vals);
}
// onConflictDoNothing: insert only when no row matches the conflict target;
// returns the inserted row, or undefined when a conflicting row already exists.
function insertIfAbsent(table: any, vals: any, opts: any): any | undefined {
  const kind = tableKind(table);
  const targets: string[] = (opts?.target ?? [])
    .map((col: any) => (col?.name ? dbNameToJsKey(table, col.name) : undefined))
    .filter(Boolean);
  if (targets.length) {
    const existing = tables[kind].find(row => targets.every(t => row[t] === vals[t]));
    if (existing) return undefined;
  }
  return insertRow(table, vals);
}
function updateRows(table: any, vals: any): void {
  for (const row of tables[tableKind(table)]) Object.assign(row, vals);
}
function deleteRows(table: any, cond?: any): void {
  const kind = tableKind(table);
  tables[kind] = tables[kind].filter(row => !matches(table, row, cond)) as any;
}

const githubInstallations = {};
const githubProjectSandboxes = {};
const githubSignalSubscriptions = {};
const githubWorktrees = {};

const { listInstallationRepos, listUserInstallations } = githubStub;
installationsRef = githubInstallations;
worktreesRef = githubWorktrees;
sandboxesRef = githubProjectSandboxes;
subscriptionsRef = githubSignalSubscriptions;

// ── Test harness ─────────────────────────────────────────────────────────
function buildApp(
  user: { workosId: string; organizationId?: string } | null,
  options: {
    controller?: NonNullable<Parameters<typeof buildGithubRoutes>[0]>['controller'];
    memorySettings?: Parameters<typeof buildGithubRoutes>[0]['memorySettings'];
    users?: NonNullable<Parameters<typeof buildGithubRoutes>[0]>['users'];
    stateSigner?: typeof stateSigner | null;
    sessionRetirement?: SessionRetirementCoordinator;
  } = {},
) {
  const app = new Hono();
  app.use('*', async (c, next) => {
    if (user) {
      // Default to an organization so org-scoped GitHub features are enabled;
      // tests that need a personal (no-org) account pass `organizationId` null.
      const withOrg = 'organizationId' in user ? user : { ...user, organizationId: 'org1' };
      c.set('factoryAuthUser' as never, withOrg as never);
    }
    await next();
  });
  const { stateSigner: signerOverride, ...routeOptions } = options;
  mountApiRoutes(
    app as any,
    buildGithubRoutes({
      baseUrl: 'http://localhost:4111',
      github: githubStub as any,
      auth: testAuth,
      sandbox: sandboxEnabled ? sandboxCallback : undefined,
      stateSigner: signerOverride === null ? undefined : (signerOverride ?? stateSigner),
      memorySettings: { get: async () => null },
      emitAudit: async ({ context, input }) => {
        try {
          if (auditFailure) throw auditFailure;
          const tenant = (context as any).get('factoryAuthUser');
          if (!tenant?.organizationId) return;
          auditRecorded.push({
            orgId: tenant.organizationId,
            actorId: tenant.workosId,
            action: input.action,
            factoryProjectId: input.factoryProjectId,
            projectRepositoryId: input.projectRepositoryId,
            targets: input.targets,
            metadata: input.metadata,
          });
        } catch (error) {
          console.warn('[Audit] Failed to emit audit event', {
            action: input.action,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      },
      ...routeOptions,
    }),
  );
  return app;
}

beforeEach(() => {
  tables.installations = [];
  tables.repositories = [];
  tables.connections = [];
  tables.projectRepositories = [];
  tables.sandboxes = [];
  tables.worktrees = [];
  tables.sessions = [];
  tables.subscriptions = [];
  sourceControlStorage.installationsRows = tables.installations as any;
  sourceControlStorage.repositoriesRows = tables.repositories as any;
  sourceControlStorage.connectionsRows = tables.connections as any;
  sourceControlStorage.projectRepositoriesRows = tables.projectRepositories as any;
  sourceControlStorage.sandboxesRows = tables.sandboxes as any;
  sourceControlStorage.worktreesRows = tables.worktrees as any;
  sourceControlStorage.sessionsRows = tables.sessions as any;
  sourceControlStorage.sandboxPoolRows = [];
  featureEnabled = true;
  sandboxEnabled = true;
  cookieUser = null;
  settingsRows.clear();
  auditRecorded = [];
  auditFailure = undefined;
  process.env.GITHUB_APP_WEBHOOK_SECRET = 'test-webhook-secret';
  // The webhook route verifies deliveries against the injected instance's secret.
  githubStub.webhookSecret = 'test-webhook-secret';
  materializeRepo.mockClear();
  sandboxCallback.mockClear();
  runSetupCommand.mockClear();
  runTeardownCommand.mockClear();
  commitAll.mockClear();
  pushBranch.mockClear();
  createPullRequest.mockClear();
  addIssueLabels.mockClear();
  removeIssueLabel.mockClear();
  githubStub.versionControl.getRepositoryAccess.mockClear();
  listRepoOpenIssues.mockClear();
  listRepoOpenPullRequests.mockClear();
});

afterEach(() => {
  __clearSessionSandboxesForTests();
  delete process.env.GITHUB_APP_WEBHOOK_SECRET;
  vi.clearAllMocks();
});

function signedGithubWebhookRequest(event: string, payload: Record<string, unknown>, init?: RequestInit): Request {
  const body = JSON.stringify(payload);
  const secret = process.env.GITHUB_APP_WEBHOOK_SECRET ?? '';
  const signature = `sha256=${createHmac('sha256', secret).update(body).digest('hex')}`;
  const headers = new Headers({
    'content-type': 'application/json',
    'x-github-event': event,
    'x-github-delivery': 'delivery-1',
    'x-hub-signature-256': signature,
  });
  new Headers(init?.headers).forEach((value, key) => headers.set(key, value));
  return new Request('http://localhost/web/github/webhook', { ...init, method: 'POST', headers, body });
}

describe('webhook route', () => {
  it('accepts a valid signed issues event without guessing a Factory project repository', async () => {
    seedMaterializedProject();
    const logSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
    const res = await buildApp(null).request(
      signedGithubWebhookRequest('issues', {
        action: 'opened',
        repository: { full_name: 'octo/hello' },
        issue: {
          number: 12,
          title: 'Fix flaky test',
          html_url: 'https://github.com/octo/hello/issues/12',
          labels: [{ name: 'bug' }],
        },
        sender: { login: 'ada' },
        installation: { id: 7 },
      }),
    );

    expect(res.status).toBe(202);
    expect(await res.json()).toEqual({ ok: true });
    expect(logSpy).toHaveBeenCalledWith('[GitHub Webhook]', {
      event: 'issues',
      action: 'opened',
      deliveryId: 'delivery-1',
      repository: 'octo/hello',
      issueNumber: 12,
      pullRequestNumber: undefined,
      sender: 'ada',
      installationId: 7,
    });
    expect(addIssueLabels).not.toHaveBeenCalled();
  });

  it('accepts a valid signed PR review comment event and logs normalized PR metadata', async () => {
    const logSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
    const res = await buildApp(null).request(
      signedGithubWebhookRequest('pull_request_review_comment', {
        action: 'created',
        repository: { full_name: 'octo/hello' },
        pull_request: { number: 34 },
        sender: { login: 'grace' },
        installation: { id: 99 },
      }),
    );

    expect(res.status).toBe(202);
    expect(await res.json()).toEqual({ ok: true });
    expect(logSpy).toHaveBeenCalledWith('[GitHub Webhook]', {
      event: 'pull_request_review_comment',
      action: 'created',
      deliveryId: 'delivery-1',
      repository: 'octo/hello',
      issueNumber: undefined,
      pullRequestNumber: 34,
      sender: 'grace',
      installationId: 99,
    });
  });

  it('dispatches a verified PR webhook through the configured controller', async () => {
    const sendNotificationSignal = vi.fn(async () => ({
      record: { id: 'notification-1' },
      decision: { action: 'deliver' },
    }));
    const session = {
      thread: { getId: () => 'thread-1', switch: vi.fn() },
      sendNotificationSignal,
    };
    const controller = {
      // Delivery confirms this deployment holds the subscribed thread and reads
      // the resource that owns it; here that is the subscription's own resource.
      queryThreadById: vi.fn(async ({ threadId }: { threadId: string }) => ({
        id: threadId,
        resourceId: 'resource-1',
      })),
      getSessionByResource: vi.fn(async () => session),
      createSession: vi.fn(),
    } as unknown as NonNullable<Parameters<typeof buildGithubRoutes>[0]>['controller'];
    tables.subscriptions.push({
      id: 'subscription-1',
      orgId: 'org1',
      installationId: 7,
      projectRepositoryId: 'project-1',
      repoId: 99,
      repoFullName: 'octo/hello',
      pullRequestNumber: 34,
      sessionId: 'session-1',
      ownerId: 'owner-1',
      resourceId: 'resource-1',
      threadId: 'thread-1',
      sessionScope: '/worktrees/a',
      source: 'explicit-tool',
      status: 'open',
    });

    const res = await buildApp(null, { controller }).request(
      signedGithubWebhookRequest('issue_comment', {
        action: 'created',
        repository: { id: 99, full_name: 'octo/hello' },
        issue: { number: 34, pull_request: { url: 'https://api.github.test/repos/octo/hello/pulls/34' } },
        sender: { login: 'grace' },
        installation: { id: 7 },
      }),
    );

    expect(res.status).toBe(202);
    expect(await res.json()).toEqual({ ok: true });
    expect(controller!.getSessionByResource).toHaveBeenCalledWith('resource-1', '/worktrees/a');
    expect(sendNotificationSignal).toHaveBeenCalledWith(
      expect.objectContaining({
        priority: 'high',
        dedupeKey: 'delivery-1:session-1:thread-1',
      }),
    );
  });

  it('rejects invalid signatures without logging', async () => {
    const logSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
    const req = signedGithubWebhookRequest(
      'issues',
      { action: 'opened' },
      {
        headers: { 'x-hub-signature-256': 'sha256=0000000000000000000000000000000000000000000000000000000000000000' },
      },
    );

    const res = await buildApp(null).request(req);

    expect(res.status).toBe(401);
    expect(await res.json()).toMatchObject({ error: 'unauthorized' });
    expect(logSpy).not.toHaveBeenCalled();
  });

  it.each([
    ['x-github-event', 400, { error: 'bad_request', message: 'Missing x-github-event header' }],
    ['x-github-delivery', 400, { error: 'bad_request', message: 'Missing x-github-delivery header' }],
    ['x-hub-signature-256', 401, { error: 'unauthorized', message: 'Missing x-hub-signature-256 header' }],
  ] as const)('rejects missing %s header', async (missingHeader, expectedStatus, expectedBody) => {
    const req = signedGithubWebhookRequest('issues', { action: 'opened' });
    req.headers.delete(missingHeader);

    const res = await buildApp(null).request(req);

    expect(res.status).toBe(expectedStatus);
    expect(await res.json()).toEqual(expectedBody);
  });

  it('rejects malformed JSON after signature verification', async () => {
    const body = '{';
    const signature = `sha256=${createHmac('sha256', process.env.GITHUB_APP_WEBHOOK_SECRET ?? '')
      .update(body)
      .digest('hex')}`;
    const res = await buildApp(null).request('/web/github/webhook', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-github-event': 'issues',
        'x-github-delivery': 'delivery-1',
        'x-hub-signature-256': signature,
      },
      body,
    });

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'bad_request', message: 'Malformed JSON payload' });
  });

  it('accepts and ignores a valid unsupported event', async () => {
    const logSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
    const res = await buildApp(null).request(signedGithubWebhookRequest('installation', { action: 'created' }));

    expect(res.status).toBe(202);
    expect(await res.json()).toEqual({ ok: true, ignored: true });
    expect(logSpy).not.toHaveBeenCalled();
  });
});

describe('status route', () => {
  it('reports disabled without the feature', async () => {
    featureEnabled = false;
    const res = await buildApp({ workosId: 'u1' }).request('/web/github/status');
    expect(await res.json()).toMatchObject({ enabled: false, connected: false });
  });

  it('reports disabled without a state signer', async () => {
    const res = await buildApp({ workosId: 'u1' }, { stateSigner: null }).request('/web/github/status');
    expect(await res.json()).toMatchObject({ enabled: false, connected: false, reason: 'missing_config' });
  });

  it('reports connected installations for the user', async () => {
    tables.installations.push(
      installationRow({
        orgId: 'org1',
        userId: 'u1',
        installationId: 7,
        accountLogin: 'octo',
        accountType: 'User',
      }),
    );
    const res = await buildApp({ workosId: 'u1' }).request('/web/github/status');
    const json = await res.json();
    expect(json.enabled).toBe(true);
    expect(json.connected).toBe(true);
    expect(json.installations[0].installationId).toBe(7);
  });
});

describe('pat route', () => {
  const jsonPost = (token: unknown, kind?: unknown) =>
    new Request('http://localhost/web/github/pat', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(kind === undefined ? { token } : { token, kind }),
    });
  const del = (kind?: string) =>
    new Request(`http://localhost/web/github/pat${kind ? `?kind=${kind}` : ''}`, { method: 'DELETE' });

  it('requires an authenticated org tenant', async () => {
    const res = await buildApp(null).request('/web/github/pat');
    expect(res.status).toBe(401);
  });

  it('reports not configured by default', async () => {
    const res = await buildApp({ workosId: 'u1' }).request('/web/github/pat');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ configured: false, reviewerConfigured: false });
  });

  it('saves a pasted worker token and reports configured without ever returning it', async () => {
    const app = buildApp({ workosId: 'u1' });
    const saved = await app.request(jsonPost('ghp_secret123'));
    expect(saved.status).toBe(200);
    expect(await saved.json()).toEqual({ configured: true, reviewerConfigured: false });

    const status = await app.request('/web/github/pat');
    const body = await status.json();
    expect(body).toEqual({ configured: true, reviewerConfigured: false });
    expect(JSON.stringify(body)).not.toContain('ghp_secret123');
  });

  it('saves and removes a reviewer token independently of the worker token', async () => {
    const app = buildApp({ workosId: 'u1' });
    await app.request(jsonPost('ghp_worker', 'default'));
    const saved = await app.request(jsonPost('ghp_reviewer', 'reviewer'));
    expect(await saved.json()).toEqual({ configured: true, reviewerConfigured: true });

    const removed = await app.request(del('reviewer'));
    expect(await removed.json()).toEqual({ configured: true, reviewerConfigured: false });
  });

  it('rejects an unknown token kind', async () => {
    const app = buildApp({ workosId: 'u1' });
    expect((await app.request(jsonPost('ghp_x', 'author'))).status).toBe(400);
    expect((await app.request(del('author'))).status).toBe(400);
  });

  it('rejects an empty or whitespace token', async () => {
    const app = buildApp({ workosId: 'u1' });
    expect((await app.request(jsonPost('   '))).status).toBe(400);
    expect((await app.request(jsonPost('bad token'))).status).toBe(400);
    expect((await app.request(jsonPost(42))).status).toBe(400);
    const status = await app.request('/web/github/pat');
    expect(await status.json()).toEqual({ configured: false, reviewerConfigured: false });
  });

  it('removes the configured worker token', async () => {
    const app = buildApp({ workosId: 'u1' });
    await app.request(jsonPost('ghp_secret123'));
    const removed = await app.request(del());
    expect(removed.status).toBe(200);
    expect(await removed.json()).toEqual({ configured: false, reviewerConfigured: false });
    const status = await app.request('/web/github/pat');
    expect(await status.json()).toEqual({ configured: false, reviewerConfigured: false });
  });

  it('scopes the tokens per org', async () => {
    await buildApp({ workosId: 'u1' }).request(jsonPost('ghp_org1'));
    const other = await buildApp({ workosId: 'u2', organizationId: 'org2' }).request('/web/github/pat');
    expect(await other.json()).toEqual({ configured: false, reviewerConfigured: false });
  });
});

describe('subscriptions route', () => {
  it('returns pull request links for the exact scoped thread', async () => {
    tables.subscriptions.push({
      id: 'subscription-1',
      orgId: 'org1',
      resourceId: 'resource-1',
      threadId: 'thread-1',
      sessionScope: '/tmp/worktree',
      repoFullName: 'octo/hello',
      pullRequestNumber: 42,
      status: 'open',
    });

    const res = await buildApp({ workosId: 'u1' }).request(
      '/web/github/subscriptions?resourceId=resource-1&threadId=thread-1&scope=%2Ftmp%2Fworktree',
    );

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      subscriptions: [
        {
          id: 'subscription-1',
          repoFullName: 'octo/hello',
          pullRequestNumber: 42,
          status: 'open',
          url: 'https://github.com/octo/hello/pull/42',
        },
      ],
    });
  });
});

describe('repos route', () => {
  const install = (installationId: number, accountLogin: string) => {
    tables.installations.push(
      installationRow({ orgId: 'org1', userId: 'u1', installationId, accountLogin, accountType: 'User' }),
    );
  };

  // The `./client` mock's default implementation must survive these tests
  // (clearAllMocks does not restore implementations).
  const defaultImpl = async (installationId: number) => [
    {
      id: 99,
      fullName: 'octo/hello',
      name: 'hello',
      owner: 'octo',
      defaultBranch: 'main',
      private: false,
      installationId,
    },
  ];
  afterEach(() => {
    vi.mocked(listInstallationRepos).mockImplementation(defaultImpl);
  });

  it('lists a repository once when multiple installations return it', async () => {
    install(7, 'octo');
    install(8, 'octo-duplicate');

    const res = await buildApp({ workosId: 'u1' }).request('/web/github/repos');

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.repos).toHaveLength(1);
    expect(json.repos[0]).toMatchObject({
      fullName: 'octo/hello',
      installationStorageId: tables.installations[0]!.id,
      sandboxWorkdir: '~/hello',
    });
    expect(json.repos[0]).not.toHaveProperty('repositoryStorageId');
    expect(tables.repositories).toHaveLength(0);
  });

  it('prunes installations GitHub no longer knows (404) and keeps listing the rest', async () => {
    install(7, 'octo');
    install(8, 'stale');
    vi.mocked(listInstallationRepos).mockImplementation(async (installationId: number) => {
      if (installationId === 8) {
        throw Object.assign(new Error('Not Found'), { status: 404 });
      }
      return defaultImpl(installationId);
    });
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const res = await buildApp({ workosId: 'u1' }).request('/web/github/repos');
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.repos).toHaveLength(1);
    expect(json.repos[0].fullName).toBe('octo/hello');
    // The stale row is gone; the live one remains.
    expect(tables.installations.map(i => i.externalId)).toEqual(['7']);
    expect(String(errorSpy.mock.calls[0]![0])).toContain('stale GitHub installation 8');
    errorSpy.mockRestore();
  });

  it('does not prune on non-404 errors', async () => {
    install(7, 'octo');
    vi.mocked(listInstallationRepos).mockRejectedValue(Object.assign(new Error('boom'), { status: 500 }));

    // Hono's default onError turns the rethrown error into a 500.
    const res = await buildApp({ workosId: 'u1' }).request('/web/github/repos');
    expect(res.status).toBe(500);
    expect(tables.installations).toHaveLength(1);
  });

  it('lists multiple installations concurrently', async () => {
    install(7, 'octo');
    install(8, 'other');
    let inFlight = 0;
    let maxInFlight = 0;
    vi.mocked(listInstallationRepos).mockImplementation(async (installationId: number) => {
      inFlight += 1;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await new Promise(resolve => setTimeout(resolve, 5));
      inFlight -= 1;
      return defaultImpl(installationId);
    });

    const res = await buildApp({ workosId: 'u1' }).request('/web/github/repos');

    expect(res.status).toBe(200);
    // Serial listing would never overlap; the route must fan out.
    expect(maxInFlight).toBe(2);
  });
});

describe('auth scoping', () => {
  it('401s when no user is present', async () => {
    const res = await buildApp(null).request('/web/github/repos');
    expect(res.status).toBe(401);
  });

  // Platform-adapter topology: custom apiRoutes run on an isolated sub-app
  // context where the outer gate's stashed user is invisible. The routes must
  // resolve the session cookie themselves (ensureFactoryAuthUser), not rely on the
  // gate's c.set(...).
  describe('without the gate (isolated custom-route context)', () => {
    it('status resolves the session from the cookie', async () => {
      cookieUser = { workosId: 'u1' };
      tables.installations.push(
        installationRow({
          orgId: 'org1',
          userId: 'u1',
          installationId: 7,
          accountLogin: 'octo',
          accountType: 'User',
        }),
      );
      const res = await buildApp(null).request('/web/github/status');
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.enabled).toBe(true);
      expect(json.connected).toBe(true);
    });

    it('org-tenant routes resolve the session from the cookie', async () => {
      cookieUser = { workosId: 'u1' };
      const res = await buildApp(null).request('/web/github/repos');
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ repos: [] });
    });

    it('status still 401s with auth_required when there is no session', async () => {
      cookieUser = null;
      const res = await buildApp(null).request('/web/github/status');
      expect(res.status).toBe(401);
      expect(await res.json()).toEqual({ error: 'unauthorized', reason: 'auth_required' });
    });
  });
});

describe('connect + callback', () => {
  it('redirects connect to the OAuth identify URL with a signed state', async () => {
    // Identify-first: the install page dead-ends for already-installed apps,
    // so connect verifies the user via OAuth and lets the callback decide
    // whether an install is actually needed.
    const res = await buildApp({ workosId: 'u1' }).request('/auth/github/connect');
    expect(res.status).toBe(302);
    expect(res.headers.get('location')).toContain('/login/oauth/authorize');
    expect(res.headers.get('location')).toContain('state=state.org1.u1');
  });

  it('redirects connect?manage=1 straight to the install URL', async () => {
    // "Manage GitHub connection" must land on GitHub's installation page —
    // the identify bounce completes invisibly for already-authorized users.
    const res = await buildApp({ workosId: 'u1' }).request('/auth/github/connect?manage=1');
    expect(res.status).toBe(302);
    expect(res.headers.get('location')).toContain('/installations/new');
    expect(res.headers.get('location')).toContain('state=state.org1.u1');
  });

  it('resolves the session cookie on a cookie-only connect navigation (gate skips /auth/*)', async () => {
    // A top-level browser navigation to /auth/github/connect carries only the
    // session cookie — no Authorization header — and the auth gate skips
    // `/auth/*`, so no user is stashed up front. The route must still resolve
    // the session (via ensureFactoryAuthUser) and redirect to install, not 401.
    cookieUser = { workosId: 'u1' };
    const res = await buildApp(null).request('/auth/github/connect');
    expect(res.status).toBe(302);
    expect(res.headers.get('location')).toContain('state=state.org1.u1');
  });

  it('401s on a cookie-only connect navigation when there is no session', async () => {
    cookieUser = null;
    const res = await buildApp(null).request('/auth/github/connect');
    expect(res.status).toBe(401);
  });

  it('persists installations on a cookie-only callback navigation', async () => {
    cookieUser = { workosId: 'u1' };
    const res = await buildApp(null).request('/auth/github/callback?state=state.org1.u1&code=abc');
    expect(res.headers.get('location')).toBe('/?github=connected');
    expect(tables.installations).toHaveLength(1);
  });

  it('rejects a callback whose state belongs to another user', async () => {
    const res = await buildApp({ workosId: 'u1' }).request(
      '/auth/github/callback?state=state.org1.someone-else&code=x',
    );
    expect(res.headers.get('location')).toBe('/?github=error');
    expect(tables.installations).toHaveLength(0);
  });

  it('rejects a callback whose state belongs to another org', async () => {
    const res = await buildApp({ workosId: 'u1' }).request('/auth/github/callback?state=state.org2.u1&code=x');
    expect(res.headers.get('location')).toBe('/?github=error');
    expect(tables.installations).toHaveLength(0);
  });

  it('persists installations on a valid callback', async () => {
    const res = await buildApp({ workosId: 'u1' }).request('/auth/github/callback?state=state.org1.u1&code=abc');
    expect(res.headers.get('location')).toBe('/?github=connected');
    expect(tables.installations).toHaveLength(1);
  });

  it('does not trust an unverified installation_id without a code', async () => {
    const res = await buildApp({ workosId: 'u1' }).request(
      '/auth/github/callback?state=state.org1.u1&installation_id=999',
    );
    // No code → bounce through OAuth identify, persist nothing.
    expect(res.status).toBe(302);
    expect(res.headers.get('location')).toContain('/login/oauth/authorize');
    expect(tables.installations).toHaveLength(0);
  });

  it("bounces a GitHub settings 'Save' redirect (no state) through OAuth identify", async () => {
    // Updating an existing installation redirects here with installation_id +
    // setup_action but no signed state. Re-sync via a fresh identify bounce
    // instead of erroring out.
    const res = await buildApp({ workosId: 'u1' }).request(
      '/auth/github/callback?installation_id=7&setup_action=update',
    );
    expect(res.status).toBe(302);
    expect(res.headers.get('location')).toContain('/login/oauth/authorize');
    expect(res.headers.get('location')).toContain('state=state.org1.u1');
    expect(tables.installations).toHaveLength(0);
  });

  it('redirects a verified user with no installations to the install URL', async () => {
    vi.mocked(listUserInstallations).mockResolvedValueOnce([]);
    const res = await buildApp({ workosId: 'u1' }).request('/auth/github/callback?state=state.org1.u1&code=abc');
    expect(res.status).toBe(302);
    expect(res.headers.get('location')).toContain('/installations/new');
    expect(tables.installations).toHaveLength(0);
  });
});

it('does not expose the removed GitHub project-creation route', async () => {
  const res = await buildApp({ workosId: 'u1' }).request('/web/github/projects', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ repoFullName: 'octo/hello', repoId: 99, installationId: 7 }),
  });
  expect(res.status).toBe(404);
});

// ── Phase 4: worktree / commit / push / pr git routes ─────────────────────
function seedMaterializedProject(
  opts: { orgId?: string; userId?: string; setupCommand?: string | null; teardownCommand?: string | null } = {},
) {
  const orgId = opts.orgId ?? 'org1';
  const userId = opts.userId ?? 'u1';
  tables.projectRepositories.push(
    projectRepositoryRow({
      id: 'p1',
      orgId,
      userId,
      installationId: 7,
      repoFullName: 'octo/hello',
      repoId: 99,
      defaultBranch: 'main',
      sandboxWorkdir: '/workspace/hello',
      setupCommand: opts.setupCommand ?? null,
      teardownCommand: opts.teardownCommand ?? null,
    }),
  );
  tables.sandboxes.push(
    sandboxRow({
      id: 'sbrow-1',
      projectRepositoryId: 'p1',
      userId,
      sandboxId: 'sb-1',
      sandboxWorkdir: '/workspace/hello',
      materializedAt: new Date(),
    }),
  );
}

function seedMaterializedSession() {
  seedMaterializedProject();
  const now = new Date();
  tables.sessions.push({
    id: 'stored-session-1',
    sessionId: 'session-1',
    projectRepositoryId: 'p1',
    orgId: 'org1',
    userId: 'u1',
    branch: 'feat/x',
    title: null,
    baseBranch: 'main',
    sandboxId: 'sb-1',
    sandboxWorkdir: '/workspace/worktrees/feat-x',
    materializedAt: now,
    createdAt: now,
    updatedAt: now,
  });
  // The session's live sandbox in the per-process memo — git write routes
  // resolve through it (they never provision).
  seedLiveSandbox('stored-session-1', '/workspace/worktrees/feat-x', {
    id: 'sb-1',
    executeCommand: async () => ({ exitCode: 0, stdout: '', stderr: '' }),
  });
}

/**
 * Seed the per-process session-sandbox memo with a live instance whose
 * derived workdir equals `workdir` exactly: a local-provider instance checks
 * out under `<workingDirectory>/<repo name>`.
 */
function seedLiveSandbox(sessionRowId: string, workdir: string, sandbox: Record<string, unknown>) {
  const cut = workdir.lastIndexOf('/');
  // Mutate in place so callers can assert on the exact seeded instance.
  Object.assign(sandbox, { provider: 'local', workingDirectory: workdir.slice(0, cut) });
  getSessionSandbox(sessionRowId, `seed/${workdir.slice(cut + 1)}`, () => sandbox as never);
}

function postJson(app: ReturnType<typeof buildApp>, path: string, body: unknown) {
  return app.request(path, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('issues route', () => {
  it('401s without an authenticated user', async () => {
    seedMaterializedProject();
    const res = await buildApp(null).request('/web/github/projects/p1/issues');
    expect(res.status).toBe(401);
    expect(listRepoOpenIssues).not.toHaveBeenCalled();
  });

  it('403s for a personal (no-org) account', async () => {
    seedMaterializedProject();
    const res = await buildApp({ workosId: 'u1', organizationId: undefined }).request('/web/github/projects/p1/issues');
    expect(res.status).toBe(403);
    expect(listRepoOpenIssues).not.toHaveBeenCalled();
  });

  it('404s for a project owned by another org', async () => {
    seedMaterializedProject({ orgId: 'other-org' });
    const res = await buildApp({ workosId: 'u1' }).request('/web/github/projects/p1/issues');
    expect(res.status).toBe(404);
    expect(listRepoOpenIssues).not.toHaveBeenCalled();
  });

  it('lists open issues for the project repo', async () => {
    seedMaterializedProject();
    const res = await buildApp({ workosId: 'u1' }).request('/web/github/projects/p1/issues');
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.issues).toHaveLength(1);
    expect(json.issues[0]).toMatchObject({
      number: 12,
      title: 'Fix flaky test',
      assignee: 'grace',
      labels: ['bug'],
    });
    expect(json.nextPage).toBeNull();
    expect(listRepoOpenIssues).toHaveBeenCalledWith(7, 'octo/hello', 1, { label: undefined });
  });

  it('forwards the requested page and echoes the next page', async () => {
    seedMaterializedProject();
    listRepoOpenIssues.mockResolvedValueOnce({ issues: [], nextPage: 3 });
    const res = await buildApp({ workosId: 'u1' }).request('/web/github/projects/p1/issues?page=2');
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ issues: [], nextPage: 3 });
    expect(listRepoOpenIssues).toHaveBeenCalledWith(7, 'octo/hello', 2, { label: undefined });
  });

  it('forwards the status: auto-triaged label filter', async () => {
    seedMaterializedProject();
    const res = await buildApp({ workosId: 'u1' }).request(
      '/web/github/projects/p1/issues?label=status%3A%20auto-triaged',
    );
    expect(res.status).toBe(200);
    expect(listRepoOpenIssues).toHaveBeenCalledWith(7, 'octo/hello', 1, { label: 'status: auto-triaged' });
  });

  it('forwards the status: needs approval label filter', async () => {
    seedMaterializedProject();
    const res = await buildApp({ workosId: 'u1' }).request(
      '/web/github/projects/p1/issues?label=status%3A%20needs%20approval',
    );
    expect(res.status).toBe(200);
    expect(listRepoOpenIssues).toHaveBeenCalledWith(7, 'octo/hello', 1, { label: 'status: needs approval' });
  });

  it('400s on an unsupported label filter', async () => {
    seedMaterializedProject();
    const res = await buildApp({ workosId: 'u1' }).request('/web/github/projects/p1/issues?label=status%3Ablocked');
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'invalid_label' });
    expect(listRepoOpenIssues).not.toHaveBeenCalled();
  });

  it('400s on a malformed page param', async () => {
    seedMaterializedProject();
    const res = await buildApp({ workosId: 'u1' }).request('/web/github/projects/p1/issues?page=zero');
    expect(res.status).toBe(400);
    expect(listRepoOpenIssues).not.toHaveBeenCalled();
  });

  it('502s when GitHub is unavailable', async () => {
    seedMaterializedProject();
    listRepoOpenIssues.mockRejectedValueOnce(new Error('GitHub unavailable'));
    const res = await buildApp({ workosId: 'u1' }).request('/web/github/projects/p1/issues');
    expect(res.status).toBe(502);
    expect(await res.json()).toMatchObject({ error: 'github_fetch_failed', message: 'GitHub unavailable' });
  });
});

describe('issue detail route', () => {
  it("returns one issue's description for the project repo", async () => {
    seedMaterializedProject();
    const res = await buildApp({ workosId: 'u1' }).request('/web/github/projects/p1/issues/12');
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({
      number: 12,
      title: 'Fix flaky test',
      description: 'The test flakes on CI.',
      comments: 3,
    });
  });

  it('404s when the issue does not exist', async () => {
    seedMaterializedProject();
    const res = await buildApp({ workosId: 'u1' }).request('/web/github/projects/p1/issues/99');
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'issue_not_found' });
  });

  it('400s on a malformed issue number', async () => {
    seedMaterializedProject();
    const res = await buildApp({ workosId: 'u1' }).request('/web/github/projects/p1/issues/abc');
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'invalid_number' });
    expect(getIssueDetail).not.toHaveBeenCalled();
  });

  it('404s for a project owned by another org', async () => {
    seedMaterializedProject({ orgId: 'other-org' });
    const res = await buildApp({ workosId: 'u1' }).request('/web/github/projects/p1/issues/12');
    expect(res.status).toBe(404);
    expect(getIssueDetail).not.toHaveBeenCalled();
  });

  it('502s when GitHub is unavailable', async () => {
    seedMaterializedProject();
    getIssueDetail.mockRejectedValueOnce(new Error('GitHub unavailable'));
    const res = await buildApp({ workosId: 'u1' }).request('/web/github/projects/p1/issues/12');
    expect(res.status).toBe(502);
    expect(await res.json()).toMatchObject({ error: 'github_fetch_failed', message: 'GitHub unavailable' });
  });
});

describe('prs route', () => {
  it('401s without an authenticated user', async () => {
    seedMaterializedProject();
    const res = await buildApp(null).request('/web/github/projects/p1/prs');
    expect(res.status).toBe(401);
    expect(listRepoOpenPullRequests).not.toHaveBeenCalled();
  });

  it('404s for a project owned by another org', async () => {
    seedMaterializedProject({ orgId: 'other-org' });
    const res = await buildApp({ workosId: 'u1' }).request('/web/github/projects/p1/prs');
    expect(res.status).toBe(404);
    expect(listRepoOpenPullRequests).not.toHaveBeenCalled();
  });

  it('lists open pull requests for the project repo', async () => {
    seedMaterializedProject();
    const res = await buildApp({ workosId: 'u1' }).request('/web/github/projects/p1/prs');
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.pullRequests).toHaveLength(1);
    expect(json.pullRequests[0]).toMatchObject({
      number: 34,
      title: 'Add factory pages',
      assignees: ['ada'],
      requestedReviewers: ['octocat'],
      headBranch: 'feat/factory',
    });
    expect(json.nextPage).toBeNull();
    expect(listRepoOpenPullRequests).toHaveBeenCalledWith(7, 'octo/hello', 1);
  });

  it('forwards the requested page and echoes the next page', async () => {
    seedMaterializedProject();
    listRepoOpenPullRequests.mockResolvedValueOnce({ pullRequests: [], nextPage: 4 });
    const res = await buildApp({ workosId: 'u1' }).request('/web/github/projects/p1/prs?page=3');
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ pullRequests: [], nextPage: 4 });
    expect(listRepoOpenPullRequests).toHaveBeenCalledWith(7, 'octo/hello', 3);
  });

  it('502s when GitHub is unavailable', async () => {
    seedMaterializedProject();
    listRepoOpenPullRequests.mockRejectedValueOnce(new Error('GitHub unavailable'));
    const res = await buildApp({ workosId: 'u1' }).request('/web/github/projects/p1/prs');
    expect(res.status).toBe(502);
    expect(await res.json()).toMatchObject({ error: 'github_fetch_failed' });
  });
});

describe('pr detail route', () => {
  it("returns one pull request's description for the project repo", async () => {
    seedMaterializedProject();
    const res = await buildApp({ workosId: 'u1' }).request('/web/github/projects/p1/prs/34');
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({
      number: 34,
      title: 'Add factory pages',
      description: 'Implements the factory pages.',
      headBranch: 'feat/factory',
    });
  });

  it('404s when the pull request does not exist', async () => {
    seedMaterializedProject();
    const res = await buildApp({ workosId: 'u1' }).request('/web/github/projects/p1/prs/99');
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'pull_request_not_found' });
  });

  it('400s on a malformed pull request number', async () => {
    seedMaterializedProject();
    const res = await buildApp({ workosId: 'u1' }).request('/web/github/projects/p1/prs/abc');
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'invalid_number' });
    expect(getPullRequestDetail).not.toHaveBeenCalled();
  });
});

describe('commits route', () => {
  function stubCommitFetch() {
    const fetchMock = vi.fn(async () => ({ ok: true, status: 200, json: async () => [] }) as unknown as Response);
    vi.stubGlobal('fetch', fetchMock);
    return fetchMock;
  }

  afterEach(() => vi.unstubAllGlobals());

  it('reads history on a host with no sandbox provider configured', async () => {
    seedMaterializedProject();
    sandboxEnabled = false;
    const fetchMock = stubCommitFetch();

    const res = await buildApp({ workosId: 'u1' }).request('/web/github/projects/p1/commits');

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ commits: [], branch: 'main' });
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it('asks GitHub for a whole number of commits', async () => {
    seedMaterializedProject();
    const fetchMock = stubCommitFetch();

    await buildApp({ workosId: 'u1' }).request('/web/github/projects/p1/commits?limit=1.5');

    const asked = new URL(String(fetchMock.mock.calls[0]?.[0])).searchParams;

    expect(asked.get('per_page')).toBe('1');
  });

  it('defaults to the branch the project selected, not the repository default', async () => {
    seedMaterializedProject();
    tables.projectRepositories[0].branch = 'release/v2';
    const fetchMock = stubCommitFetch();

    const res = await buildApp({ workosId: 'u1' }).request('/web/github/projects/p1/commits');

    expect(await res.json()).toMatchObject({ branch: 'release/v2' });
    expect(new URL(String(fetchMock.mock.calls[0]?.[0])).searchParams.get('sha')).toBe('release/v2');
  });
});

describe('project settings routes', () => {
  it('401s without an authenticated user', async () => {
    seedMaterializedProject();
    const res = await buildApp(null).request('/web/github/projects/p1/settings');
    expect(res.status).toBe(401);
  });

  it('404s for a project owned by another org', async () => {
    seedMaterializedProject({ orgId: 'other-org' });
    const res = await buildApp({ workosId: 'u1' }).request('/web/github/projects/p1/settings');
    expect(res.status).toBe(404);
  });

  it('returns the stored lifecycle commands', async () => {
    seedMaterializedProject({
      setupCommand: 'pnpm i && pnpm build',
      teardownCommand: 'docker compose down --remove-orphans',
    });
    const res = await buildApp({ workosId: 'u1' }).request('/web/github/projects/p1/settings');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      setupCommand: 'pnpm i && pnpm build',
      teardownCommand: 'docker compose down --remove-orphans',
    });
  });

  it('persists trimmed lifecycle commands', async () => {
    seedMaterializedProject();
    const res = await postJson(buildApp({ workosId: 'u1' }), '/web/github/projects/p1/settings', {
      setupCommand: '  pnpm i && pnpm build  ',
      teardownCommand: '  docker compose down --remove-orphans  ',
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      setupCommand: 'pnpm i && pnpm build',
      teardownCommand: 'docker compose down --remove-orphans',
    });
    expect(tables.projectRepositories[0].setupCommand).toBe('pnpm i && pnpm build');
    expect(tables.projectRepositories[0].teardownCommand).toBe('docker compose down --remove-orphans');
  });

  it('clears lifecycle commands with an empty string or null', async () => {
    seedMaterializedProject({ setupCommand: 'pnpm i', teardownCommand: 'pnpm teardown' });
    const app = buildApp({ workosId: 'u1' });
    const res = await postJson(app, '/web/github/projects/p1/settings', {
      setupCommand: '   ',
      teardownCommand: '   ',
    });
    expect(await res.json()).toEqual({ setupCommand: null, teardownCommand: null });
    expect(tables.projectRepositories[0].setupCommand).toBeNull();
    expect(tables.projectRepositories[0].teardownCommand).toBeNull();

    tables.projectRepositories[0].setupCommand = 'pnpm i';
    tables.projectRepositories[0].teardownCommand = 'pnpm teardown';
    const res2 = await postJson(app, '/web/github/projects/p1/settings', {
      setupCommand: null,
      teardownCommand: null,
    });
    expect(await res2.json()).toEqual({ setupCommand: null, teardownCommand: null });
    expect(tables.projectRepositories[0].setupCommand).toBeNull();
    expect(tables.projectRepositories[0].teardownCommand).toBeNull();
  });

  it('400s on a non-string setup command', async () => {
    seedMaterializedProject();
    const res = await postJson(buildApp({ workosId: 'u1' }), '/web/github/projects/p1/settings', {
      setupCommand: 42,
    });
    expect(res.status).toBe(400);
  });

  it('400s on an oversized setup command', async () => {
    seedMaterializedProject();
    const res = await postJson(buildApp({ workosId: 'u1' }), '/web/github/projects/p1/settings', {
      setupCommand: 'x'.repeat(2001),
    });
    expect(res.status).toBe(400);
  });

  it('400s on a setup command containing control characters', async () => {
    seedMaterializedProject();
    const app = buildApp({ workosId: 'u1' });
    const res = await postJson(app, '/web/github/projects/p1/settings', {
      setupCommand: 'pnpm i \x1b[31m&& rm -rf /',
    });
    expect(res.status).toBe(400);
    expect(tables.projectRepositories[0].setupCommand).toBeNull();

    // Newlines and tabs are legitimate in multi-line setup scripts.
    const res2 = await postJson(app, '/web/github/projects/p1/settings', {
      setupCommand: 'pnpm i\npnpm build\t--force',
    });
    expect(res2.status).toBe(200);
  });
});

describe('Factory session routes', () => {
  it('creates metadata without provisioning a sandbox or worktree', async () => {
    seedMaterializedProject();
    const res = await postJson(buildApp({ workosId: 'u1' }), '/web/github/projects/p1/sessions', {
      branch: 'feat/x',
    });
    expect(res.status).toBe(200);
    const { session } = await res.json();
    expect(session).toMatchObject({
      projectRepositoryId: 'p1',
      orgId: 'org1',
      userId: 'u1',
      branch: 'feat/x',
      baseBranch: 'main',
      title: null,
      visibility: 'org',
      sandboxId: null,
      sandboxWorkdir: null,
    });
    expect(session.sessionId).toEqual(expect.any(String));
    expect(tables.sessions).toHaveLength(1);
    // Creating a session provisions nothing: no repo is materialized and the
    // configured sandbox callback is never even constructed. A sandbox boots
    // lazily, at the session's first command.
    expect(materializeRepo).not.toHaveBeenCalled();
    expect(sandboxCallback).not.toHaveBeenCalled();
  });

  it('enriches listed sessions with owner names and avatars', async () => {
    seedMaterializedProject();
    const profiles = {
      u1: { id: 'u1', name: 'Ada Lovelace', email: 'ada@example.com', avatarUrl: 'https://example.com/ada.png' },
      u2: { id: 'u2', name: 'Grace Hopper', email: 'grace@example.com', avatarUrl: 'https://example.com/grace.png' },
    };
    const users = {
      getUser: vi.fn(async (id: string) => profiles[id as keyof typeof profiles] ?? null),
      getUsers: vi.fn(async (ids: string[]) => ids.map(id => profiles[id as keyof typeof profiles]).filter(Boolean)),
    };
    await postJson(buildApp({ workosId: 'u1' }, { users }), '/web/github/projects/p1/sessions', {
      branch: 'feat/mine',
    });
    await postJson(buildApp({ workosId: 'u2' }, { users }), '/web/github/projects/p1/sessions', {
      branch: 'feat/theirs',
    });

    const response = await buildApp({ workosId: 'u1' }, { users }).request('/web/github/projects/p1/sessions');

    expect(response.status).toBe(200);
    expect(users.getUsers).toHaveBeenCalledWith(expect.arrayContaining(['u1', 'u2']));
    expect((await response.json()).sessions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          userId: 'u1',
          owner: { id: 'u1', name: 'Ada Lovelace', avatarUrl: 'https://example.com/ada.png' },
        }),
        expect.objectContaining({
          userId: 'u2',
          owner: { id: 'u2', name: 'Grace Hopper', avatarUrl: 'https://example.com/grace.png' },
        }),
      ]),
    );
  });

  it('falls back to individual profile lookups without dropping successful owners', async () => {
    seedMaterializedProject();
    await postJson(buildApp({ workosId: 'u1' }), '/web/github/projects/p1/sessions', { branch: 'feat/mine' });
    await postJson(buildApp({ workosId: 'u2' }), '/web/github/projects/p1/sessions', { branch: 'feat/theirs' });
    const users = {
      getUser: vi.fn(async (id: string) => {
        if (id === 'u1') return { id, email: 'ada@example.com' };
        throw new Error('Profile unavailable');
      }),
    };

    const response = await buildApp({ workosId: 'u1' }, { users }).request('/web/github/projects/p1/sessions');

    expect(response.status).toBe(200);
    expect(users.getUser).toHaveBeenCalledTimes(2);
    const { sessions } = await response.json();
    expect(sessions.find((session: { userId: string }) => session.userId === 'u1')).toEqual(
      expect.objectContaining({ owner: { id: 'u1', name: 'ada@example.com' } }),
    );
    expect(sessions.find((session: { userId: string }) => session.userId === 'u2')).not.toHaveProperty('owner');
  });

  it('falls back to individual lookups when the bulk owner lookup fails', async () => {
    seedMaterializedProject();
    await postJson(buildApp({ workosId: 'u1' }), '/web/github/projects/p1/sessions', { branch: 'feat/mine' });
    await postJson(buildApp({ workosId: 'u2' }), '/web/github/projects/p1/sessions', { branch: 'feat/theirs' });
    const users = {
      getUsers: vi.fn(async () => {
        throw new Error('Directory unavailable');
      }),
      getUser: vi.fn(async (id: string) => (id === 'u1' ? { id, name: 'Ada Lovelace' } : { id, name: '', email: '' })),
    };

    const response = await buildApp({ workosId: 'u1' }, { users }).request('/web/github/projects/p1/sessions');

    expect(response.status).toBe(200);
    expect(users.getUsers).toHaveBeenCalledOnce();
    expect(users.getUser).toHaveBeenCalledTimes(2);
    const { sessions } = await response.json();
    expect(sessions.find((session: { userId: string }) => session.userId === 'u1')).toEqual(
      expect.objectContaining({ owner: { id: 'u1', name: 'Ada Lovelace' } }),
    );
    expect(sessions.find((session: { userId: string }) => session.userId === 'u2')).not.toHaveProperty('owner');
  });

  it('caches session owner profiles between list requests', async () => {
    seedMaterializedProject();
    const users = {
      getUser: vi.fn(async (id: string) => ({ id, name: 'Ada Lovelace' })),
      getUsers: vi.fn(async (ids: string[]) => ids.map(id => ({ id, name: 'Ada Lovelace' }))),
    };
    const app = buildApp({ workosId: 'u1' }, { users });
    await postJson(app, '/web/github/projects/p1/sessions', { branch: 'feat/mine' });

    const first = await app.request('/web/github/projects/p1/sessions');
    const second = await app.request('/web/github/projects/p1/sessions');

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(users.getUsers).toHaveBeenCalledOnce();
    expect((await second.json()).sessions).toEqual([
      expect.objectContaining({ owner: { id: 'u1', name: 'Ada Lovelace' } }),
    ]);
  });

  it('uses a supplied UUID for branch identity and persists a normalized title', async () => {
    seedMaterializedProject();
    const app = buildApp({ workosId: 'u1' });
    const sessionId = '00000000-0000-4000-8000-000000000001';
    const first = await postJson(app, '/web/github/projects/p1/sessions', {
      sessionId,
      title: '  Fix\n  the\tlogin flow  ',
    });

    expect(first.status).toBe(200);
    const firstSession = (await first.json()).session;
    expect(firstSession).toMatchObject({
      sessionId,
      branch: `user/session-${sessionId}`,
      title: 'Fix the login flow',
    });

    const loaded = await app.request(`/web/user-sessions/${sessionId}`);
    expect((await loaded.json()).session.title).toBe('Fix the login flow');
    const listed = await app.request('/web/github/projects/p1/sessions');
    expect((await listed.json()).sessions).toEqual([
      expect.objectContaining({ sessionId, title: 'Fix the login flow' }),
    ]);
  });

  it('returns the same session when a supplied UUID is retried', async () => {
    seedMaterializedProject();
    const app = buildApp({ workosId: 'u1' });
    const request = {
      sessionId: '00000000-0000-4000-8000-000000000001',
      title: 'Fix login flow',
    };

    const first = await postJson(app, '/web/github/projects/p1/sessions', request);
    const second = await postJson(app, '/web/github/projects/p1/sessions', request);

    expect((await second.json()).session).toEqual((await first.json()).session);
    expect(tables.sessions).toHaveLength(1);
  });

  it('returns an org-visible session to a same-org non-owner', async () => {
    seedMaterializedProject();
    const owner = buildApp({ workosId: 'u1' });
    const created = await postJson(owner, '/web/github/projects/p1/sessions', {
      sessionId: '00000000-0000-4000-8000-000000000010',
    });
    expect(created.status).toBe(200);

    const viewer = buildApp({ workosId: 'u2' });
    const res = await viewer.request('/web/user-sessions/00000000-0000-4000-8000-000000000010');
    expect(res.status).toBe(200);
    expect((await res.json()).session).toMatchObject({ userId: 'u1', visibility: 'org' });
  });

  it('404s a private session for a same-org non-owner with the exact not-found body', async () => {
    seedMaterializedProject();
    const now = new Date();
    tables.sessions.push({
      id: 'row-private',
      sessionId: '00000000-0000-4000-8000-000000000011',
      projectRepositoryId: 'p1',
      orgId: 'org1',
      userId: 'u1',
      branch: 'user/session-private',
      title: null,
      baseBranch: 'main',
      visibility: 'private',
      sandboxId: null,
      sandboxWorkdir: null,
      materializedAt: null,
      createdAt: now,
      updatedAt: now,
    });

    const viewer = buildApp({ workosId: 'u2' });
    const denied = await viewer.request('/web/user-sessions/00000000-0000-4000-8000-000000000011');
    const missing = await viewer.request('/web/user-sessions/00000000-0000-4000-8000-00000000dead');
    expect(denied.status).toBe(404);
    expect(missing.status).toBe(404);
    // Byte-identical bodies so private session IDs never leak existence.
    expect(await denied.text()).toBe(await missing.text());

    const owner = buildApp({ workosId: 'u1' });
    const allowed = await owner.request('/web/user-sessions/00000000-0000-4000-8000-000000000011');
    expect(allowed.status).toBe(200);
  });

  it("lists org-visible sessions from other users plus the caller's own private ones", async () => {
    seedMaterializedProject();
    const now = new Date();
    const row = (overrides: Record<string, unknown>) => ({
      projectRepositoryId: 'p1',
      orgId: 'org1',
      branch: `user/session-${overrides.sessionId}`,
      title: null,
      baseBranch: 'main',
      sandboxId: null,
      sandboxWorkdir: null,
      materializedAt: null,
      createdAt: now,
      updatedAt: now,
      ...overrides,
    });
    tables.sessions.push(
      row({ id: 'r1', sessionId: 's-org-other', userId: 'u1', visibility: 'org' }),
      row({ id: 'r2', sessionId: 's-private-other', userId: 'u1', visibility: 'private' }),
      row({ id: 'r3', sessionId: 's-private-mine', userId: 'u2', visibility: 'private' }),
      row({ id: 'r4', sessionId: 's-legacy-null', userId: 'u1', visibility: null }),
    );

    const res = await buildApp({ workosId: 'u2' }).request('/web/github/projects/p1/sessions');
    expect(res.status).toBe(200);
    const listed = (await res.json()).sessions.map((s: { sessionId: string }) => s.sessionId).sort();
    expect(listed).toEqual(['s-legacy-null', 's-org-other', 's-private-mine']);
  });

  it('derives a branch from a server-generated UUID when no session ID is supplied', async () => {
    seedMaterializedProject();
    const res = await postJson(buildApp({ workosId: 'u1' }), '/web/github/projects/p1/sessions', {});
    const session = (await res.json()).session;

    expect(session.branch).toBe(`user/session-${session.sessionId}`);
    expect(session.title).toBeNull();
  });

  it('truncates titles to 80 code points and stores blank titles as null', async () => {
    seedMaterializedProject();
    const app = buildApp({ workosId: 'u1' });
    const long = await postJson(app, '/web/github/projects/p1/sessions', {
      sessionId: '00000000-0000-4000-8000-000000000001',
      title: `${'x'.repeat(79)} word`,
    });
    const blank = await postJson(app, '/web/github/projects/p1/sessions', {
      sessionId: '00000000-0000-4000-8000-000000000002',
      title: ' \n\t ',
    });
    const atCap = await postJson(app, '/web/github/projects/p1/sessions', {
      sessionId: '00000000-0000-4000-8000-000000000003',
      title: `${'x'.repeat(79)}🙂`,
    });
    const pastCap = await postJson(app, '/web/github/projects/p1/sessions', {
      sessionId: '00000000-0000-4000-8000-000000000004',
      title: `${'x'.repeat(80)}🙂`,
    });

    expect((await long.json()).session.title).toBe('x'.repeat(79));
    expect((await blank.json()).session.title).toBeNull();
    expect((await atCap.json()).session.title).toBe(`${'x'.repeat(79)}🙂`);
    expect((await pastCap.json()).session.title).toBe('x'.repeat(80));
  });

  it.each([
    [{ sessionId: 'not-a-uuid' }, 'Invalid sessionId'],
    [{ sessionId: '00000000-0000-4000-8000-00000000000A' }, 'Invalid sessionId'],
    [{ sessionId: 42 }, 'Invalid sessionId'],
    [{ title: 42 }, 'Invalid title'],
    [{ baseBranch: 42 }, 'Invalid baseBranch'],
  ])('rejects invalid optional session fields', async (body, error) => {
    seedMaterializedProject();
    const res = await postJson(buildApp({ workosId: 'u1' }), '/web/github/projects/p1/sessions', body);

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error });
    expect(tables.sessions).toHaveLength(0);
  });

  it('rejects a supplied UUID already bound to another session identity', async () => {
    seedMaterializedProject();
    const app = buildApp({ workosId: 'u1' });
    const sessionId = '00000000-0000-4000-8000-000000000001';
    await postJson(app, '/web/github/projects/p1/sessions', { branch: 'feat/x', sessionId });

    const conflict = await postJson(app, '/web/github/projects/p1/sessions', { sessionId });

    expect(conflict.status).toBe(409);
    expect(await conflict.json()).toEqual({ error: 'Session ID conflict' });
    expect(tables.sessions).toHaveLength(1);
  });

  it('returns a conflict when two identities concurrently claim the same supplied UUID', async () => {
    seedMaterializedProject();
    const sessionId = '00000000-0000-4000-8000-000000000001';

    const responses = await Promise.all([
      postJson(buildApp({ workosId: 'u1' }), '/web/github/projects/p1/sessions', { sessionId }),
      postJson(buildApp({ workosId: 'u2' }), '/web/github/projects/p1/sessions', { sessionId }),
    ]);

    expect(responses.map(response => response.status).sort()).toEqual([200, 409]);
    expect(tables.sessions).toHaveLength(1);
  });

  it('rejects a non-object body instead of treating it as an unnamed session', async () => {
    seedMaterializedProject();
    const res = await postJson(buildApp({ workosId: 'u1' }), '/web/github/projects/p1/sessions', 42);
    expect(res.status).toBe(400);
    expect(tables.sessions).toHaveLength(0);
  });

  it('reuses the session for the same repository, user, and branch', async () => {
    seedMaterializedProject();
    const app = buildApp({ workosId: 'u1' });
    const first = await postJson(app, '/web/github/projects/p1/sessions', { branch: 'feat/x' });
    const second = await postJson(app, '/web/github/projects/p1/sessions', { branch: 'feat/x' });
    expect((await second.json()).session.sessionId).toBe((await first.json()).session.sessionId);
    expect(tables.sessions).toHaveLength(1);
  });

  it('loads and deletes a session by its public session id', async () => {
    seedMaterializedProject();
    const app = buildApp({ workosId: 'u1' });
    const created = await postJson(app, '/web/github/projects/p1/sessions', { branch: 'feat/x' });
    const sessionId = (await created.json()).session.sessionId;

    const loaded = await app.request(`/web/user-sessions/${sessionId}`);
    expect(loaded.status).toBe(200);
    expect((await loaded.json()).session.sessionId).toBe(sessionId);

    const deleted = await app.request(`/web/user-sessions/${sessionId}`, { method: 'DELETE' });
    expect(deleted.status).toBe(200);
    expect(tables.sessions).toHaveLength(0);
  });

  it('runs repository teardown before releasing and invalidates an explicitly deleted session', async () => {
    seedMaterializedProject({ teardownCommand: 'docker compose down --remove-orphans' });
    const order: string[] = [];
    const controller = {
      deleteSession: vi.fn(async () => {
        order.push('controller');
        expect(tables.sessions).toHaveLength(1);
      }),
    } as any;
    const invalidateSession = vi.fn(async () => {
      order.push('invalidate');
    });
    const sessionRetirement = new SessionRetirementCoordinator({ invalidateSession });
    const app = buildApp({ workosId: 'u1' }, { controller, sessionRetirement });
    const created = await postJson(app, '/web/github/projects/p1/sessions', { branch: 'feat/x' });
    const sessionId = (await created.json()).session.sessionId;
    const row = tables.sessions.find(r => r.sessionId === sessionId)!;
    // Seed the per-process memo: the session's sandbox is live in this replica.
    const live = {
      id: 'sb-live',
      destroy: vi.fn(async () => order.push('destroy')),
      executeCommand: vi.fn(async () => ({ exitCode: 0, stdout: '', stderr: '' })),
    };
    seedLiveSandbox(row.id, '/workspace/hello', live);
    runTeardownCommand.mockImplementationOnce(async () => {
      order.push('teardown');
    });

    const deleted = await app.request(`/web/user-sessions/${sessionId}`, { method: 'DELETE' });

    expect(deleted.status).toBe(200);
    expect(controller.deleteSession).toHaveBeenCalledWith({ resourceId: sessionId });
    expect(runTeardownCommand).toHaveBeenCalledWith(live, '/workspace/hello', 'docker compose down --remove-orphans', {
      timeoutMs: 15 * 60_000,
    });
    expect(invalidateSession).toHaveBeenCalledWith(sessionId);
    expect(tables.sessions).toHaveLength(0);
    // Deleted sessions destroy their VM — nothing resolves this id again.
    expect(order).toEqual(['controller', 'teardown', 'destroy', 'invalidate']);
  });

  it('does not tear down a controller session for an unauthorized deletion', async () => {
    seedMaterializedProject();
    const controller = { deleteSession: vi.fn() } as any;
    const ownerApp = buildApp({ workosId: 'u1' }, { controller });
    const created = await postJson(ownerApp, '/web/github/projects/p1/sessions', { branch: 'feat/x' });
    const sessionId = (await created.json()).session.sessionId;

    const response = await buildApp({ workosId: 'u2' }, { controller }).request(`/web/user-sessions/${sessionId}`, {
      method: 'DELETE',
    });

    expect(response.status).toBe(404);
    expect(controller.deleteSession).not.toHaveBeenCalled();
  });

  it('names a session from its conversation and mirrors the title onto the row', async () => {
    seedMaterializedProject();
    const controller = {
      queryThreads: vi.fn(async () => [{ id: 'thread-1', updatedAt: new Date() }]),
      generateThreadTitle: vi.fn(async () => 'Log parser rewrite'),
    } as any;
    const memorySettings = { get: vi.fn(async () => ({ observerModelId: 'anthropic/claude-haiku-4-5' })) } as any;
    const app = buildApp({ workosId: 'u1' }, { controller, memorySettings });
    const created = await postJson(app, '/web/github/projects/p1/sessions', { title: 'rewrite the log parser' });
    const sessionId = (await created.json()).session.sessionId;

    const response = await app.request(`/web/user-sessions/${sessionId}/title`, { method: 'POST' });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ title: 'Log parser rewrite' });
    const named = controller.generateThreadTitle.mock.calls[0][0];
    expect(named.threadId).toBe('thread-1');
    expect(named.resourceId).toBe(sessionId);
    // Naming runs as the session's owner, so it bills their model credentials.
    expect(named.requestContext.get('user')).toEqual({ workosId: 'u1', organizationId: 'org1' });
    // A closed session has no live state, so the owner's stored observer model
    // is what keeps a manual rename on the model that names threads on its own.
    expect(named.model({ requestContext: named.requestContext }).modelId).toContain('claude-haiku-4-5');
    expect(tables.sessions.find(row => row.sessionId === sessionId)?.title).toBe('Log parser rewrite');
  });

  it('names a session whose owner never configured a memory model', async () => {
    seedMaterializedProject();
    const controller = {
      queryThreads: vi.fn(async () => [{ id: 'thread-1', updatedAt: new Date() }]),
      generateThreadTitle: vi.fn(async () => 'Log parser rewrite'),
    } as any;
    const app = buildApp({ workosId: 'u1' }, { controller });
    const created = await postJson(app, '/web/github/projects/p1/sessions', { title: 'rewrite the log parser' });
    const sessionId = (await created.json()).session.sessionId;

    const response = await app.request(`/web/user-sessions/${sessionId}/title`, { method: 'POST' });

    expect(response.status).toBe(200);
    // No stored model to override with, so naming runs on the memory's own title model.
    expect(controller.generateThreadTitle.mock.calls[0][0].model).toBeUndefined();
    expect(tables.sessions.find(row => row.sessionId === sessionId)?.title).toBe('Log parser rewrite');
  });

  it('joins a second naming request to the one already in flight', async () => {
    seedMaterializedProject();
    let release = () => {};
    const naming = new Promise<void>(resolve => {
      release = resolve;
    });
    const controller = {
      queryThreads: vi.fn(async () => [{ id: 'thread-1', updatedAt: new Date() }]),
      generateThreadTitle: vi.fn(async () => {
        await naming;
        return 'Log parser rewrite';
      }),
    } as any;
    const app = buildApp({ workosId: 'u1' }, { controller });
    const created = await postJson(app, '/web/github/projects/p1/sessions', { title: 'rewrite the log parser' });
    const sessionId = (await created.json()).session.sessionId;

    const first = app.request(`/web/user-sessions/${sessionId}/title`, { method: 'POST' });
    await vi.waitFor(() => expect(controller.generateThreadTitle).toHaveBeenCalledOnce());
    const second = app.request(`/web/user-sessions/${sessionId}/title`, { method: 'POST' });
    await vi.waitFor(() => expect(controller.queryThreads).toHaveBeenCalledTimes(2));
    release();
    const [a, b] = await Promise.all([first, second]);

    // A second tab or API client cannot pay for a second naming, nor race its rename.
    expect(controller.generateThreadTitle).toHaveBeenCalledOnce();
    expect(await a.json()).toEqual({ title: 'Log parser rewrite' });
    expect(await b.json()).toEqual({ title: 'Log parser rewrite' });
    expect(tables.sessions.find(row => row.sessionId === sessionId)?.title).toBe('Log parser rewrite');
  });

  it('caps and tidies the title the model returned', async () => {
    seedMaterializedProject();
    const controller = {
      queryThreads: vi.fn(async () => [{ id: 'thread-1', updatedAt: new Date() }]),
      generateThreadTitle: vi.fn(async () => `  Rewrite   the log parser ${'and more '.repeat(20)}`),
    } as any;
    const app = buildApp({ workosId: 'u1' }, { controller });
    const created = await postJson(app, '/web/github/projects/p1/sessions', { title: 'rewrite the log parser' });
    const sessionId = (await created.json()).session.sessionId;

    const response = await app.request(`/web/user-sessions/${sessionId}/title`, { method: 'POST' });

    const { title } = await response.json();
    expect(title.length).toBeLessThanOrEqual(80);
    expect(title.startsWith('Rewrite the log parser and more')).toBe(true);
    expect(tables.sessions.find(row => row.sessionId === sessionId)?.title).toBe(title);
  });

  it('rejects a title the model returned as whitespace', async () => {
    seedMaterializedProject();
    const controller = {
      queryThreads: vi.fn(async () => [{ id: 'thread-1', updatedAt: new Date() }]),
      generateThreadTitle: vi.fn(async () => '   '),
    } as any;
    const app = buildApp({ workosId: 'u1' }, { controller });
    const created = await postJson(app, '/web/github/projects/p1/sessions', { title: 'rewrite the log parser' });
    const sessionId = (await created.json()).session.sessionId;

    const response = await app.request(`/web/user-sessions/${sessionId}/title`, { method: 'POST' });

    expect(response.status).toBe(502);
    expect(tables.sessions.find(row => row.sessionId === sessionId)?.title).toBe('rewrite the log parser');
  });

  it('explains that a session with no conversation cannot be named', async () => {
    seedMaterializedProject();
    const controller = { queryThreads: vi.fn(async () => []), generateThreadTitle: vi.fn() } as any;
    const app = buildApp({ workosId: 'u1' }, { controller });
    const created = await postJson(app, '/web/github/projects/p1/sessions', { branch: 'feat/x' });
    const sessionId = (await created.json()).session.sessionId;

    const response = await app.request(`/web/user-sessions/${sessionId}/title`, { method: 'POST' });

    expect(response.status).toBe(409);
    expect((await response.json()).error).toBe('This session has no conversation to name yet.');
    expect(controller.generateThreadTitle).not.toHaveBeenCalled();
  });

  it('does not name a session belonging to another user', async () => {
    seedMaterializedProject();
    const controller = { queryThreads: vi.fn(), generateThreadTitle: vi.fn() } as any;
    const ownerApp = buildApp({ workosId: 'u1' }, { controller });
    const created = await postJson(ownerApp, '/web/github/projects/p1/sessions', { branch: 'feat/x' });
    const sessionId = (await created.json()).session.sessionId;

    const response = await buildApp({ workosId: 'u2' }, { controller }).request(
      `/web/user-sessions/${sessionId}/title`,
      { method: 'POST' },
    );

    expect(response.status).toBe(404);
    expect(controller.generateThreadTitle).not.toHaveBeenCalled();
  });

  it('continues sandbox reclamation and returns success when controller teardown fails', async () => {
    seedMaterializedProject();
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const controller = { deleteSession: vi.fn(async () => Promise.reject(new Error('teardown failed'))) } as any;
    const app = buildApp({ workosId: 'u1' }, { controller });
    const created = await postJson(app, '/web/github/projects/p1/sessions', { branch: 'feat/x' });
    const sessionId = (await created.json()).session.sessionId;
    const row = tables.sessions.find(r => r.sessionId === sessionId)!;
    const live = {
      id: 'sb-live',
      destroy: vi.fn(async () => {}),
      executeCommand: vi.fn(async () => ({ exitCode: 0, stdout: '', stderr: '' })),
    };
    seedLiveSandbox(row.id, '/workspace/hello', live);

    const deleted = await app.request(`/web/user-sessions/${sessionId}`, { method: 'DELETE' });

    expect(deleted.status).toBe(200);
    expect(tables.sessions).toHaveLength(0);
    await vi.waitFor(() => expect(live.destroy).toHaveBeenCalledTimes(1));
    error.mockRestore();
  });

  it('destroys the deleted session sandbox held by this process instead of pooling it', async () => {
    // The cross-session reuse pool died with the fleet: sandbox identity is
    // the session id, so a deleted session's VM is destroyed, not shelved.
    seedMaterializedProject();
    const app = buildApp({ workosId: 'u1' });
    const created = await postJson(app, '/web/github/projects/p1/sessions', { branch: 'feat/x' });
    const sessionId = (await created.json()).session.sessionId;
    const row = tables.sessions.find(r => r.sessionId === sessionId)!;
    const live = {
      id: 'sb-live',
      destroy: vi.fn(async () => {}),
      executeCommand: vi.fn(async () => ({ exitCode: 0, stdout: '', stderr: '' })),
    };
    seedLiveSandbox(row.id, '/workspace/hello', live);

    const deleted = await app.request(`/web/user-sessions/${sessionId}`, { method: 'DELETE' });

    expect(deleted.status).toBe(200);
    expect(tables.sessions).toHaveLength(0);
    await vi.waitFor(() => expect(live.destroy).toHaveBeenCalledTimes(1));
    expect(sourceControlStorage.sandboxPoolRows).toEqual([]);
  });

  it("does not expose another organization's session regardless of visibility", async () => {
    seedMaterializedProject();
    const created = await postJson(buildApp({ workosId: 'u1' }), '/web/github/projects/p1/sessions', {
      branch: 'feat/x',
    });
    const sessionId = (await created.json()).session.sessionId;
    const crossOrg = buildApp({ workosId: 'u2', organizationId: 'org2' });
    expect((await crossOrg.request(`/web/user-sessions/${sessionId}`)).status).toBe(404);
  });

  it('rejects invalid branch names', async () => {
    seedMaterializedProject();
    const res = await postJson(buildApp({ workosId: 'u1' }), '/web/github/projects/p1/sessions', {
      branch: 'bad branch!',
    });
    expect(res.status).toBe(400);
    expect(tables.sessions).toHaveLength(0);
  });
});

describe('commit route', () => {
  it('400s on an empty message', async () => {
    seedMaterializedProject();
    const res = await postJson(buildApp({ workosId: 'u1' }), '/web/github/projects/p1/commit', {
      message: '   ',
    });
    expect(res.status).toBe(400);
    expect(commitAll).not.toHaveBeenCalled();
  });

  it('400s on an unknown sessionId', async () => {
    seedMaterializedProject();
    const res = await postJson(buildApp({ workosId: 'u1' }), '/web/github/projects/p1/commit', {
      message: 'wip',
      sessionId: 'missing-session',
    });
    expect(res.status).toBe(400);
    expect(commitAll).not.toHaveBeenCalled();
  });

  it('commits in a materialized session workspace', async () => {
    seedMaterializedSession();
    const res = await postJson(buildApp({ workosId: 'u1' }), '/web/github/projects/p1/commit', {
      message: 'wip',
      sessionId: 'session-1',
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ committed: true });
    expect((commitAll.mock.calls[0] as unknown as any[])[1]).toBe('/workspace/worktrees/feat-x');
  });
});

describe('sandbox teardown route', () => {
  it('is gone: the project-level sandbox concept no longer exists', async () => {
    seedMaterializedProject();
    const res = await buildApp({ workosId: 'u1' }).request('/web/github/projects/p1/sandbox', { method: 'DELETE' });
    expect(res.status).toBe(404);
  });
});

describe('push route', () => {
  it('400s on an invalid branch', async () => {
    seedMaterializedProject();
    const res = await postJson(buildApp({ workosId: 'u1' }), '/web/github/projects/p1/push', {
      branch: 'bad branch',
    });
    expect(res.status).toBe(400);
    expect(pushBranch).not.toHaveBeenCalled();
  });

  it('uses repository-scoped access to push the branch', async () => {
    seedMaterializedSession();
    const res = await postJson(buildApp({ workosId: 'u1' }), '/web/github/projects/p1/push', {
      branch: 'feat/x',
      sessionId: 'session-1',
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ pushed: true, branch: 'feat/x' });
    expect(githubStub.versionControl.getRepositoryAccess).toHaveBeenCalledWith({
      orgId: 'org1',
      repositoryId: 'repository-99',
    });
    expect(githubStub.mintInstallationToken).not.toHaveBeenCalled();
    expect(pushBranch).toHaveBeenCalledOnce();
    // pushBranch(sandbox, workdir, branch, token, repoFullName)
    const call = pushBranch.mock.calls[0] as unknown as any[];
    expect(call[2]).toBe('feat/x');
    expect(call[3]).toBe('repo-token-repository-99');
    expect(call[4]).toBe('octo/hello');
  });
});

describe('pr route', () => {
  it('400s on a missing title', async () => {
    seedMaterializedProject();
    const res = await postJson(buildApp({ workosId: 'u1' }), '/web/github/projects/p1/pr', {
      branch: 'feat/x',
    });
    expect(res.status).toBe(400);
    expect(createPullRequest).not.toHaveBeenCalled();
  });

  it('400s on an invalid base branch', async () => {
    seedMaterializedProject();
    const res = await postJson(buildApp({ workosId: 'u1' }), '/web/github/projects/p1/pr', {
      branch: 'feat/x',
      base: 'bad base',
      title: 'My PR',
    });
    expect(res.status).toBe(400);
    expect(createPullRequest).not.toHaveBeenCalled();
  });

  it('opens a PR and returns its URL', async () => {
    seedMaterializedSession();
    const res = await postJson(buildApp({ workosId: 'u1' }), '/web/github/projects/p1/pr', {
      branch: 'feat/x',
      title: 'My PR',
      body: 'Adds a thing',
      sessionId: 'session-1',
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ url: 'https://github.com/octo/hello/pull/1' });
    expect(createPullRequest).toHaveBeenCalledOnce();
    expect(createPullRequest).toHaveBeenCalledWith({
      connection: { type: 'app-installation', installationId: 7 },
      sourceId: 'octo/hello',
      baseBranch: 'main',
      headBranch: 'feat/x',
      title: 'My PR',
      body: 'Adds a thing',
      actingUserId: 'u1',
    });
  });

  it('returns 502 when the version-control provider rejects PR creation', async () => {
    seedMaterializedSession();
    createPullRequest.mockRejectedValueOnce(new Error('GitHub unavailable'));
    const res = await postJson(buildApp({ workosId: 'u1' }), '/web/github/projects/p1/pr', {
      branch: 'feat/x',
      title: 'My PR',
      sessionId: 'session-1',
    });
    expect(res.status).toBe(502);
    expect(await res.json()).toEqual({ error: 'github_pr_create_failed', message: 'GitHub unavailable' });
  });
});

// ── Audit events ─────────────────────────────────────────────────────────
describe('audit events', () => {
  it('records git.commit only when a commit was actually created', async () => {
    seedMaterializedSession();
    const app = buildApp({ workosId: 'u1' });
    await postJson(app, '/web/github/projects/p1/commit', { message: 'wip', sessionId: 'session-1' });
    expect(auditRecorded.map(e => e.action)).toEqual(['factory.git.commit']);

    auditRecorded = [];
    commitAll.mockResolvedValueOnce({ committed: false } as any);
    await postJson(app, '/web/github/projects/p1/commit', { message: 'nothing to do', sessionId: 'session-1' });
    expect(auditRecorded).toHaveLength(0);
  });

  it('records git.push with the branch target', async () => {
    seedMaterializedSession();
    await postJson(buildApp({ workosId: 'u1' }), '/web/github/projects/p1/push', {
      branch: 'feat/x',
      sessionId: 'session-1',
    });
    expect(auditRecorded).toHaveLength(1);
    expect(auditRecorded[0]).toMatchObject({
      action: 'factory.git.push',
      projectRepositoryId: 'p1',
      targets: [{ type: 'branch', id: 'feat/x' }],
      metadata: { branch: 'feat/x' },
    });
  });

  it('records git.pr_opened with the PR url and title', async () => {
    seedMaterializedSession();
    await postJson(buildApp({ workosId: 'u1' }), '/web/github/projects/p1/pr', {
      branch: 'feat/x',
      title: 'My PR',
      sessionId: 'session-1',
    });
    expect(auditRecorded).toHaveLength(1);
    expect(auditRecorded[0]).toMatchObject({
      action: 'factory.git.pr_opened',
      projectRepositoryId: 'p1',
      targets: [{ type: 'pull_request', id: 'https://github.com/octo/hello/pull/1', name: 'My PR' }],
      metadata: { branch: 'feat/x', base: 'main', url: 'https://github.com/octo/hello/pull/1' },
    });
  });

  it('does not record audit events for rejected mutations', async () => {
    seedMaterializedProject();
    await postJson(buildApp({ workosId: 'u1' }), '/web/github/projects/p1/push', { branch: 'bad branch' });
    expect(auditRecorded).toHaveLength(0);
  });

  it('still succeeds the mutation when the audit insert throws', async () => {
    seedMaterializedSession();
    auditFailure = new Error('audit db down');
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const res = await postJson(buildApp({ workosId: 'u1' }), '/web/github/projects/p1/push', {
      branch: 'feat/x',
      sessionId: 'session-1',
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ pushed: true, branch: 'feat/x' });
    expect(warnSpy).toHaveBeenCalledWith('[Audit] Failed to emit audit event', expect.anything());
    warnSpy.mockRestore();
  });
});

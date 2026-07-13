import { RequestContext } from '@mastra/core/request-context';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ── Mocks ────────────────────────────────────────────────────────────────
vi.mock('drizzle-orm', () => ({
  eq: (column: any, value: any) => ({ kind: 'eq', column: column?.name, value }),
}));

// In-memory tables, keyed by the drizzle table object passed to `.from()`.
let projects: Array<Record<string, any>> = [];
let connections: Array<Record<string, any>> = [];

function rowsFor(table: any): Array<Record<string, any>> {
  // The github_projects table has a `repoFullName` column; linear_connections doesn't.
  return 'repoFullName' in table ? projects : connections;
}

function matches(table: any, row: any, cond: any): boolean {
  if (!cond) return true;
  if (cond.kind === 'eq') {
    for (const [jsKey, col] of Object.entries(table)) {
      if ((col as any)?.name === cond.column) return row[jsKey] === cond.value;
    }
    return false;
  }
  return true;
}

vi.mock('../github/db', () => ({
  getAppDb: () => ({
    select: (_projection?: any) => ({
      from: (table: any) => ({
        where: async (cond: any) => rowsFor(table).filter(row => matches(table, row, cond)),
      }),
    }),
    update: (table: any) => ({
      set: (vals: any) => ({
        where: async (cond: any) => {
          for (const row of rowsFor(table)) {
            if (matches(table, row, cond)) Object.assign(row, vals);
          }
        },
      }),
    }),
  }),
}));

let featureEnabled = true;
vi.mock('./config', () => ({
  isLinearFeatureEnabled: () => featureEnabled,
}));

const fetchLinearIssueDetail = vi.fn();
const refreshLinearAccessToken = vi.fn();
vi.mock('./client', () => ({
  fetchLinearIssueDetail: (...args: any[]) => fetchLinearIssueDetail(...(args as [])),
  refreshLinearAccessToken: (...args: any[]) => refreshLinearAccessToken(...(args as [])),
}));

import { buildLinearAgentTools, clearLinearAgentToolCaches, invalidateLinearConnectionCache } from './agent-tools';

const PROJECT_ID = 'project-1';
const ORG_ID = 'org-1';

function requestContextFor(resourceId: string | undefined): RequestContext {
  const ctx = new RequestContext();
  if (resourceId !== undefined) {
    ctx.set('controller', { resourceId });
  }
  return ctx;
}

function seedProject(): void {
  projects.push({ id: PROJECT_ID, orgId: ORG_ID, repoFullName: 'acme/app' });
}

function seedConnection(overrides: Record<string, any> = {}): void {
  connections.push({
    orgId: ORG_ID,
    accessToken: 'linear-token',
    refreshToken: 'linear-refresh',
    expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    ...overrides,
  });
}

const issueDetail = {
  id: 'uuid-1',
  identifier: 'ENG-42',
  title: 'Fix intake sync',
  description: 'It syncs the wrong way.',
  url: 'https://linear.app/acme/issue/ENG-42',
  state: 'Todo',
  stateType: 'unstarted',
  priorityLabel: 'High',
  assignee: 'ada',
  team: 'ENG',
  labels: ['bug'],
  createdAt: '2026-07-01T00:00:00Z',
  updatedAt: '2026-07-02T00:00:00Z',
  comments: [{ author: 'grace', body: 'Repro attached.', createdAt: '2026-07-01T12:00:00Z' }],
};

beforeEach(() => {
  projects = [];
  connections = [];
  featureEnabled = true;
  clearLinearAgentToolCaches();
  fetchLinearIssueDetail.mockReset();
  refreshLinearAccessToken.mockReset();
});

describe('buildLinearAgentTools — exposure gating', () => {
  it('exposes linear_get_issue when the project org has a Linear connection', async () => {
    seedProject();
    seedConnection();
    const tools = await buildLinearAgentTools({ requestContext: requestContextFor(PROJECT_ID) });
    expect(tools).toHaveProperty('linear_get_issue');
  });

  it('exposes nothing when the org has not connected Linear', async () => {
    seedProject();
    const tools = await buildLinearAgentTools({ requestContext: requestContextFor(PROJECT_ID) });
    expect(tools).toEqual({});
  });

  it('exposes nothing when the feature is disabled', async () => {
    featureEnabled = false;
    seedProject();
    seedConnection();
    const tools = await buildLinearAgentTools({ requestContext: requestContextFor(PROJECT_ID) });
    expect(tools).toEqual({});
  });

  it('exposes nothing for resources that are not GitHub projects', async () => {
    seedConnection();
    const tools = await buildLinearAgentTools({ requestContext: requestContextFor('local-default') });
    expect(tools).toEqual({});
  });

  it('exposes nothing when there is no controller context', async () => {
    const tools = await buildLinearAgentTools({ requestContext: requestContextFor(undefined) });
    expect(tools).toEqual({});
  });

  it('sees a fresh connection immediately after cache invalidation', async () => {
    seedProject();
    expect(await buildLinearAgentTools({ requestContext: requestContextFor(PROJECT_ID) })).toEqual({});

    // Org connects Linear (OAuth callback invalidates the cached check).
    seedConnection();
    invalidateLinearConnectionCache(ORG_ID);
    const tools = await buildLinearAgentTools({ requestContext: requestContextFor(PROJECT_ID) });
    expect(tools).toHaveProperty('linear_get_issue');
  });
});

describe('linear_get_issue — execute', () => {
  async function getTool() {
    seedProject();
    seedConnection();
    const tools = await buildLinearAgentTools({ requestContext: requestContextFor(PROJECT_ID) });
    return tools.linear_get_issue!;
  }

  it('returns the full issue detail for an identifier', async () => {
    fetchLinearIssueDetail.mockResolvedValue(issueDetail);
    const tool = await getTool();
    const result = await (tool.execute as any)({ issue: ' ENG-42 ' });
    expect(fetchLinearIssueDetail).toHaveBeenCalledWith('linear-token', 'ENG-42');
    expect(result).toEqual(issueDetail);
  });

  it('returns a not-found error for unknown issues', async () => {
    fetchLinearIssueDetail.mockResolvedValue(null);
    const tool = await getTool();
    const result = await (tool.execute as any)({ issue: 'ENG-999' });
    expect(result).toEqual({ error: 'Linear issue "ENG-999" was not found in this workspace.' });
  });

  it('refreshes an expired token before fetching', async () => {
    connections.length = 0;
    seedProject();
    seedConnection({ expiresAt: new Date(Date.now() - 1000) });
    refreshLinearAccessToken.mockResolvedValue({
      accessToken: 'linear-token-2',
      refreshToken: 'linear-refresh-2',
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    });
    fetchLinearIssueDetail.mockResolvedValue(issueDetail);

    const tools = await buildLinearAgentTools({ requestContext: requestContextFor(PROJECT_ID) });
    const result = await (tools.linear_get_issue!.execute as any)({ issue: 'ENG-42' });

    expect(refreshLinearAccessToken).toHaveBeenCalledWith('linear-refresh');
    expect(fetchLinearIssueDetail).toHaveBeenCalledWith('linear-token-2', 'ENG-42');
    expect(result).toEqual(issueDetail);
  });

  it('surfaces reauth-required as a tool error instead of throwing', async () => {
    connections.length = 0;
    seedProject();
    seedConnection({ expiresAt: new Date(Date.now() - 1000), refreshToken: null });

    const tools = await buildLinearAgentTools({ requestContext: requestContextFor(PROJECT_ID) });
    const result = await (tools.linear_get_issue!.execute as any)({ issue: 'ENG-42' });

    expect(result).toEqual({
      error: 'Linear authorization expired. Reconnect Linear to keep syncing intake issues.',
    });
  });

  it('maps fetch failures to a tool error', async () => {
    fetchLinearIssueDetail.mockRejectedValue(new Error('Linear API request failed (502)'));
    const tool = await getTool();
    const result = await (tool.execute as any)({ issue: 'ENG-42' });
    expect(result).toEqual({ error: 'Failed to fetch Linear issue: Linear API request failed (502)' });
  });
});

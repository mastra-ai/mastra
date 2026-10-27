/**
 * One Jira project feeding several factories, split by label (FACT-440), end
 * to end on both Jira paths: real bindings storage, the real route and
 * integration code, and real card filing, with only Jira itself faked at the
 * HTTP edge (it evaluates the JQL each factory sends).
 */
import type { ApiRoute } from '@mastra/core/server';
import { Hono } from 'hono';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createBoardRegistry } from '../../boards/index.js';
import { fakeRouteAuth, mountApiRoutes } from '../../routes/test-utils.js';
import { createFactoryStorageForTests } from '../../storage/test-utils.js';
import type { FactoryStorageTestSeed } from '../../storage/test-utils.js';
import { encodeIssueReference, encodeSourceId, PlatformJiraIntegration } from '../platform/jira/integration.js';
import { buildPlatformJiraRoutes } from '../platform/jira/routes.js';
import { resolveJiraRules } from './default-rules.js';
import { JiraIntegration } from './integration.js';
import { buildJiraRoutes } from './routes.js';
import { JiraRules } from './rules.js';
import type { JiraRulesIngress } from './rules.js';
import { jiraIssuePayload, matchesJql } from './test-utils.js';
import type { FakeJiraIssue } from './test-utils.js';

const OPS = { projectId: '10000', projectKey: 'OPS' };
const issues: FakeJiraIssue[] = [
  { key: 'OPS-1', labels: [], ...OPS },
  { key: 'OPS-2', labels: ['bug'], ...OPS },
  { key: 'OPS-3', labels: ['payments'], ...OPS },
  { key: 'OPS-4', labels: ['ios', 'bug'], ...OPS },
  { key: 'OPS-5', labels: ['payments', 'mobile'], ...OPS },
];
/** Where each issue lands with Platform taking all issues, Payments `payments`, Mobile `mobile`+`ios`. */
const expectedFactory: Record<string, 'platform' | 'payments' | 'mobile'> = {
  'OPS-1': 'platform',
  'OPS-2': 'platform',
  'OPS-3': 'payments',
  'OPS-4': 'mobile',
  // Carries labels of two label bindings; the older binding (Payments) wins.
  'OPS-5': 'payments',
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

/** Jira's REST API as both integrations reach it, filtering `issues` by the JQL each search sends. */
function fakeJira(target: string, init?: RequestInit): Response | null {
  if ((init?.method ?? 'GET') === 'POST' && target.includes('/rest/api/3/search/jql')) {
    const { jql } = JSON.parse(String(init?.body)) as { jql: string };
    const page = issues.filter(issue => matchesJql(jql, issue));
    return json({ issues: page.map((issue, index) => jiraIssuePayload(issue, String(20_000 + index))) });
  }
  const comments = target.match(/\/rest\/api\/3\/issue\/([^/?]+)\/comment/);
  if (comments) return json({ comments: [], total: 0, startAt: 0, maxResults: 50 });
  const single = target.match(/\/rest\/api\/3\/issue\/([^/?]+)/);
  if (single) {
    const index = issues.findIndex(issue => issue.key === decodeURIComponent(single[1]!));
    return index >= 0 ? json(jiraIssuePayload(issues[index]!, String(20_000 + index))) : json({}, 404);
  }
  return null;
}

interface JiraPath {
  name: string;
  sourceId: string;
  /** The `issueRef` the board passes to the single-issue route. */
  issueRef(key: string): string;
  routes(seed: FactoryStorageTestSeed, ingest: (input: JiraRulesIngress) => Promise<unknown>): ApiRoute[];
}

const paths: JiraPath[] = [
  {
    name: 'direct Jira',
    sourceId: OPS.projectId,
    issueRef: key => key,
    routes(seed, ingest) {
      vi.stubGlobal(
        'fetch',
        vi.fn(async (input: URL | string, init?: RequestInit) => {
          const response = fakeJira(String(input), init);
          if (!response) throw new Error(`Unexpected request: ${String(input)}`);
          return response;
        }),
      );
      const jira = new JiraIntegration({
        baseUrl: 'https://acme.atlassian.net',
        email: 'ops@acme.test',
        apiToken: 't',
      });
      return buildJiraRoutes({ jira, auth: fakeRouteAuth(), intake: seed.intake, ingestFactoryIssues: ingest });
    },
  },
  {
    name: 'Platform Jira',
    sourceId: encodeSourceId('a1b_acme', OPS.projectId),
    issueRef: key => encodeIssueReference({ connectionId: 'a1b_acme', issueId: key, projectId: OPS.projectId }),
    routes(seed, ingest) {
      vi.stubGlobal(
        'fetch',
        vi.fn(async (input: URL | string, init?: RequestInit) => {
          const target = String(input);
          if (target.endsWith('/v2/connections?providerKey=jira')) {
            return json({
              connections: [
                { id: 'a1b_acme', integrationId: 'jira', status: 'active', accountLabel: 'acme.atlassian.net' },
              ],
            });
          }
          if (/\/v2\/connections\/a1b_acme\/context$/.test(target)) {
            return json({
              connection_config: { cloudId: 'a436116f-02ce-4520-8fbb-7301462a1674' },
              metadata: null,
            });
          }
          const response = fakeJira(target, init);
          if (!response) throw new Error(`Unexpected request: ${target}`);
          return response;
        }),
      );
      const jira = new PlatformJiraIntegration({
        clientConfig: { baseUrl: 'https://integrations.example.com', accessToken: 'platform-token' },
      });
      return buildPlatformJiraRoutes({
        jira,
        auth: fakeRouteAuth(),
        intake: seed.intake,
        appDbConfigured: true,
        ingestFactoryIssues: ingest,
      });
    },
  },
];

afterEach(() => {
  vi.unstubAllGlobals();
});

describe.each(paths)('Jira project shared by label — $name', path => {
  let seed: FactoryStorageTestSeed;
  let app: Hono;
  let factories: Record<'platform' | 'payments' | 'mobile', string>;

  beforeEach(async () => {
    seed = await createFactoryStorageForTests();
    const rules = new JiraRules({
      projects: seed.projects,
      storage: seed.workItems,
      configVersion: 'factory-config-v1',
      boards: createBoardRegistry(),
      jiraRules: resolveJiraRules(),
    });
    app = new Hono();
    app.use('*', async (c, next) => {
      c.set('factoryAuthUser' as never, { workosId: 'u1', organizationId: 'org1' } as never);
      await next();
    });
    mountApiRoutes(
      app,
      path.routes(seed, input => rules.ingest(input)),
    );

    const create = async (name: string) =>
      (await seed.projects.create({ orgId: 'org1', userId: 'u1', input: { name } })).id;
    factories = {
      platform: await create('platform'),
      payments: await create('payments'),
      mobile: await create('mobile'),
    };
    await seed.intake.saveConfig({ orgId: 'org1', config: { jira: { enabled: true, sourceIds: [path.sourceId] } } });
    const bind = (factoryProjectId: string, labels: string[] | null) =>
      seed.intake.setSharedBinding({
        orgId: 'org1',
        integrationId: 'jira',
        sourceId: path.sourceId,
        factoryProjectId,
        board: 'work',
        labels,
      });
    // Created in order, a millisecond apart, so the oldest-wins rule has an unambiguous order.
    await bind(factories.platform, null);
    await new Promise(resolve => setTimeout(resolve, 2));
    await bind(factories.payments, ['payments']);
    await new Promise(resolve => setTimeout(resolve, 2));
    await bind(factories.mobile, ['mobile', 'ios']);
  });

  const poll = async (factoryProjectId: string) => {
    const response = await app.request(`/web/jira/issues?factoryProjectId=${factoryProjectId}`);
    expect(response.status).toBe(200);
    return ((await response.json()) as { issues: Array<{ identifier: string }> }).issues.map(issue => issue.identifier);
  };
  const filed = async (factoryProjectId: string) =>
    (await seed.workItems.listDeferredDecisions('org1', factoryProjectId))
      .map(entry => (entry.decision as { metadata?: { identifier?: string } }).metadata?.identifier)
      .sort();

  it.each([
    { order: ['platform', 'payments', 'mobile'] as const },
    { order: ['mobile', 'payments', 'platform'] as const },
  ])('files every issue in exactly one factory when they poll in order $order', async ({ order }) => {
    const seen: Record<string, string[]> = {};
    for (const name of order) seen[name] = await poll(factories[name]);

    for (const name of ['platform', 'payments', 'mobile'] as const) {
      const expected = Object.keys(expectedFactory)
        .filter(key => expectedFactory[key] === name)
        .sort();
      expect([...seen[name]!].sort()).toEqual(expected);
      expect(await filed(factories[name])).toEqual(expected);
    }
  });

  it("does not open an issue from another factory's slice by its identifier", async () => {
    const open = (factory: 'platform' | 'payments' | 'mobile', key: string) =>
      app.request(
        `/web/jira/issues/${key}?factoryProjectId=${factories[factory]}&issueRef=${encodeURIComponent(path.issueRef(key))}`,
      );

    expect((await open('payments', 'OPS-3')).status).toBe(200);
    expect((await open('platform', 'OPS-3')).status).toBe(404);
    expect((await open('mobile', 'OPS-5')).status).toBe(404);
    expect((await open('platform', 'OPS-1')).status).toBe(200);
    expect((await open('payments', 'OPS-1')).status).toBe(404);
  });
});

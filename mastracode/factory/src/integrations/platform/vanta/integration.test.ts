import { describe, expect, it, vi } from 'vitest';

import { createBoardRegistry } from '../../../boards/index.js';
import { createTestBoard } from '../../../boards/test-utils.js';
import { createFactoryStorageForTests } from '../../../storage/test-utils.js';
import type { IntegrationContext } from '../../base.js';
import type { IssueReconcileSummary } from '../../issue-reconciler.js';
import { problem, startFakePlatform } from '../foundation/test-utils.js';
import type { FakePlatform } from '../foundation/test-utils.js';
import { PlatformVantaIntegration } from './integration.js';

const projects = [
  { id: 'project-1', orgId: 'org-1' },
  { id: 'project-2', orgId: 'org-2' },
];
const vulnerability = { id: 'vuln-1', name: 'CVE-2026-1' };

type Connection = { id: string; status: 'active' | 'needs_reauth'; resourceId: string | null; accountLabel: null };

function withIntegrationId(connections: Connection[]) {
  return connections.map(connection => ({ ...connection, integrationId: 'vanta' }));
}

function createIntegration(
  connections: Connection[],
  pageInfo = { hasNextPage: false, endCursor: null as string | null },
) {
  const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
    const path = new URL(String(input)).pathname;
    if (path === '/v2/projects/proj_factory/connections') {
      return Response.json({ connections: withIntegrationId(connections) });
    }
    if (path === '/v2/connections') {
      // The org listing shows global connections; every one here is linked to the project.
      return Response.json({
        connections: withIntegrationId(connections.filter(connection => !connection.resourceId)),
      });
    }
    if (path.includes('/proxy/v1/vulnerabilities')) {
      return Response.json({ results: { data: [vulnerability], pageInfo } });
    }
    throw new Error(`Unexpected request ${input}`);
  });
  const integration = new PlatformVantaIntegration({
    connect: {
      baseUrl: 'https://integrations.example',
      projectId: 'proj_factory',
      accessToken: 'test-token',
      fetch: fetchImpl as typeof fetch,
    },
  });
  return { integration, fetchImpl };
}

function vulnerabilityReads(fetchImpl: { mock: { calls: unknown[][] } }): number {
  return fetchImpl.mock.calls.filter(call => String(call[0]).includes('/proxy/v1/vulnerabilities')).length;
}

describe('PlatformVantaIntegration reconciliation', () => {
  it('keeps connections scoped to their owning organizations', async () => {
    const { integration, fetchImpl } = createIntegration([
      { id: 'connection-1', status: 'active', resourceId: 'project-1', accountLabel: null },
      { id: 'connection-2', status: 'active', resourceId: 'project-2', accountLabel: null },
    ]);
    expect(await integration.listVulnerabilitiesForOrg('org-1', projects)).toEqual([vulnerability]);
    const urls = fetchImpl.mock.calls.map(call => String(call[0]));
    expect(urls.some(url => url.includes('/connections/connection-1/proxy/'))).toBe(true);
    expect(urls.some(url => url.includes('/connections/connection-2/proxy/'))).toBe(false);
  });

  it('skips reconciliation when a connection needs reauthorization', async () => {
    const { integration, fetchImpl } = createIntegration([
      { id: 'connection-1', status: 'needs_reauth', resourceId: 'project-1', accountLabel: null },
    ]);
    expect(await integration.listVulnerabilitiesForOrg('org-1', projects)).toBeNull();
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('skips ambiguous global connections in multi-organization deployments', async () => {
    const { integration, fetchImpl } = createIntegration([
      { id: 'connection-1', status: 'active', resourceId: null, accountLabel: null },
    ]);
    expect(await integration.listVulnerabilitiesForOrg('org-1', projects)).toBeNull();
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('allows a global connection in a single-organization deployment', async () => {
    const { integration } = createIntegration([
      { id: 'connection-1', status: 'active', resourceId: null, accountLabel: null },
    ]);
    expect(await integration.listVulnerabilitiesForOrg('org-1', projects.slice(0, 1))).toEqual([vulnerability]);
  });

  it('skips unrecognized resource scopes rather than assigning them to another organization', async () => {
    const { integration, fetchImpl } = createIntegration([
      { id: 'connection-1', status: 'active', resourceId: 'another-tenant', accountLabel: null },
    ]);
    expect(await integration.listVulnerabilitiesForOrg('org-1', projects)).toBeNull();
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('rejects a truncated snapshot at the pagination cap', async () => {
    const { integration, fetchImpl } = createIntegration(
      [{ id: 'connection-1', status: 'active', resourceId: 'project-1', accountLabel: null }],
      { hasNextPage: true, endCursor: 'next-page' },
    );
    await expect(integration.listVulnerabilitiesForOrg('org-1', projects)).rejects.toThrow(
      'Incomplete Vanta vulnerability snapshot',
    );
    expect(vulnerabilityReads(fetchImpl)).toBe(50);
  });

  it('rejects a page that claims more results without a cursor', async () => {
    const { integration, fetchImpl } = createIntegration(
      [{ id: 'connection-1', status: 'active', resourceId: 'project-1', accountLabel: null }],
      { hasNextPage: true, endCursor: null },
    );
    await expect(integration.listVulnerabilitiesForOrg('org-1', projects)).rejects.toThrow(
      'Incomplete Vanta vulnerability snapshot',
    );
    expect(vulnerabilityReads(fetchImpl)).toBe(1);
  });
});

function json(data: unknown): Response {
  return new Response(JSON.stringify(data), { status: 200, headers: { 'content-type': 'application/json' } });
}

type Status = 'active' | 'needs_reauth';

function vantaWith(pages: number, statuses: Status[] = ['active']) {
  const fetchImpl = vi.fn<typeof fetch>().mockImplementation(async input => {
    const url = new URL(String(input));
    if (url.pathname === '/v2/projects/proj_factory/connections') {
      return json({
        connections: statuses.map((status, index) => ({
          id: `conn-${index + 1}`,
          integrationId: 'vanta',
          status,
          accountLabel: null,
        })),
      });
    }
    const page = Number(url.searchParams.get('pageCursor') ?? 0);
    return json({
      results: {
        data: [{ id: `vuln-${page}`, name: `CVE-${page}` }],
        pageInfo: { hasNextPage: page + 1 < pages, endCursor: String(page + 1) },
      },
    });
  });
  return new PlatformVantaIntegration({
    connect: {
      baseUrl: 'https://integrations.example.com',
      projectId: 'proj_factory',
      accessToken: 'platform-secret',
      fetch: fetchImpl,
    },
  });
}

describe('PlatformVantaIntegration.listVulnerabilities', () => {
  it('lists every page', async () => {
    await expect(vantaWith(3).listVulnerabilities()).resolves.toHaveLength(3);
  });

  // A cut-off list would read as the rest being resolved, and close their cards.
  it('fails instead of returning a list cut off by the page limit', async () => {
    await expect(vantaWith(51).listVulnerabilities()).rejects.toThrow(/Incomplete Vanta vulnerability snapshot/);
  });

  it('fails instead of returning an empty list when no connection is active', async () => {
    await expect(vantaWith(1, []).listVulnerabilities()).rejects.toThrow(/no active Vanta connection/);
    await expect(vantaWith(1, ['needs_reauth']).listVulnerabilities()).rejects.toThrow(/conn-1 is needs_reauth/);
  });

  it("fails instead of leaving out a connection that can't be read", async () => {
    await expect(vantaWith(1, ['active', 'needs_reauth']).listVulnerabilities()).rejects.toThrow(
      /conn-2 is needs_reauth/,
    );
  });
});

/** Runs the integration's reconcile once, as its worker would. */
class SyncOnce extends PlatformVantaIntegration {
  async syncOnce(ctx: IntegrationContext): Promise<IssueReconcileSummary> {
    const reconcile = this.reconcile(ctx);
    if (!reconcile) throw new Error('Vanta did not attach its sync');
    return reconcile();
  }
}

describe('Vanta sync through the Factory project connections', () => {
  async function setup(platform: FakePlatform) {
    const seeded = await createFactoryStorageForTests();
    const project = await seeded.projects.create({ orgId: 'org-1', userId: 'user-1', input: { name: 'acme' } });
    await seeded.intake.saveConfig({ orgId: 'org-1', config: { vanta: { enabled: true, sourceIds: [] } } });
    const { item: filed } = await seeded.workItems.upsert({
      orgId: 'org-1',
      userId: 'user-1',
      factoryProjectId: project.id,
      input: {
        externalSource: { integrationId: 'vanta', type: 'vulnerability', externalId: 'vuln-filed' },
        title: 'lodash: CVE-2026-9',
        stages: ['intake'],
        sessions: {},
        metadata: { state: 'open' },
      },
    });
    const ctx = {
      storage: { projects: seeded.projects, intake: seeded.intake },
      runtime: {
        configVersion: 'factory-config-v1',
        workItems: seeded.workItems,
        boards: createBoardRegistry({ boards: [createTestBoard()] }),
      },
    } as unknown as IntegrationContext;
    const commits = vi.spyOn(seeded.workItems, 'commitRuleEvaluation');
    const vanta = new SyncOnce({ connect: platform.connect() });
    return { vanta, ctx, commits, filed };
  }

  function vulnerabilityPages(pages: Array<{ id: string } | 'fail'>) {
    return (_connectionId: string, path: string, query: URLSearchParams) => {
      if (path !== '/v1/vulnerabilities') return problem(404, 'not_found');
      const page = Number(query.get('pageCursor') ?? 0);
      const entry = pages[page];
      if (!entry || entry === 'fail') return { status: 502, body: { message: 'Vanta is unavailable' } };
      return {
        status: 200,
        body: {
          results: {
            data: [{ id: entry.id, name: entry.id }],
            pageInfo: { hasNextPage: page + 1 < pages.length, endCursor: String(page + 1) },
          },
        },
      };
    };
  }

  it("links the org's Vanta connection to the Factory project at boot, then syncs from it", async () => {
    const platform = await startFakePlatform();
    platform.orgConnections = [{ id: 'conn-vanta', integrationId: 'vanta', status: 'active' }];
    platform.proxy = vulnerabilityPages([{ id: 'vuln-filed' }, { id: 'vuln-new' }]);
    const { vanta, ctx, commits } = await setup(platform);

    const [worker] = vanta.workers(ctx);
    expect(worker?.name).toBe('vanta-issue-reconcile');
    const summary = await vanta.syncOnce(ctx);

    expect(platform.linked.has('conn-vanta')).toBe(true);
    expect(summary).toMatchObject({ projects: 1, checked: 2, failed: 0 });
    expect(commits).toHaveBeenCalled();
  });

  it('closes no cards when the connection could not be linked and none is visible', async () => {
    const platform = await startFakePlatform();
    platform.orgConnections = [{ id: 'conn-vanta', integrationId: 'vanta', status: 'active' }];
    platform.linkReplies.set('conn-vanta', problem(403, 'forbidden'));
    const { vanta, ctx, commits } = await setup(platform);

    vanta.workers(ctx);
    const summary = await vanta.syncOnce(ctx);

    expect(summary).toMatchObject({ projects: 0, checked: 0, closed: 0 });
    expect(commits).not.toHaveBeenCalled();
    expect(vanta.needsLinking).toEqual([
      { connectionId: 'conn-vanta', reason: expect.stringContaining('integrations:write') },
    ]);
    expect(platform.requests.some(request => request.path.includes('/proxy'))).toBe(false);
  });

  it('closes no cards when one of the org Vanta connections is not linked to the project', async () => {
    const platform = await startFakePlatform();
    platform.orgConnections = [
      { id: 'conn-linked', integrationId: 'vanta', status: 'active' },
      { id: 'conn-refused', integrationId: 'vanta', status: 'active' },
    ];
    platform.linked.add('conn-linked');
    platform.linkReplies.set('conn-refused', problem(403, 'forbidden'));
    // The linked connection's list lacks vuln-filed, which only the unlinked one holds.
    platform.proxy = vulnerabilityPages([{ id: 'vuln-new' }]);
    const { vanta, ctx, commits } = await setup(platform);

    vanta.workers(ctx);
    const summary = await vanta.syncOnce(ctx);

    expect(summary).toMatchObject({ projects: 0, checked: 0, closed: 0 });
    expect(commits).not.toHaveBeenCalled();
    expect(vanta.needsLinking).toEqual([{ connectionId: 'conn-refused', reason: expect.any(String) }]);
  });

  it('closes no cards when a Vanta connection appears in the org after boot linking', async () => {
    const platform = await startFakePlatform();
    platform.orgConnections = [{ id: 'conn-linked', integrationId: 'vanta', status: 'active' }];
    platform.proxy = vulnerabilityPages([{ id: 'vuln-new' }]);
    const { vanta, ctx, commits } = await setup(platform);
    vanta.workers(ctx);
    await vi.waitFor(() => expect(platform.linked.has('conn-linked')).toBe(true));

    platform.orgConnections.push({ id: 'conn-later', integrationId: 'vanta', status: 'active' });
    const summary = await vanta.syncOnce(ctx);

    expect(summary).toMatchObject({ projects: 0, checked: 0, closed: 0 });
    expect(commits).not.toHaveBeenCalled();
  });

  it('closes no cards when Vanta fails partway through the vulnerability pages', async () => {
    const platform = await startFakePlatform();
    platform.orgConnections = [{ id: 'conn-vanta', integrationId: 'vanta', status: 'active' }];
    platform.linked.add('conn-vanta');
    platform.proxy = vulnerabilityPages([{ id: 'vuln-other' }, 'fail']);
    const { vanta, ctx, commits } = await setup(platform);

    const summary = await vanta.syncOnce(ctx);

    expect(summary).toMatchObject({ projects: 0, checked: 0, failed: 1 });
    expect(commits).not.toHaveBeenCalled();
  });

  it('syncs every 15 minutes unless syncIntervalMs says otherwise', () => {
    const offline = { baseUrl: 'http://127.0.0.1:9', accessToken: 'platform-secret', projectId: 'proj_factory' };
    expect(new PlatformVantaIntegration({ connect: offline }).reconcileIntervalMs).toBe(15 * 60_000);
    expect(new PlatformVantaIntegration({ connect: offline, syncIntervalMs: 5 * 60_000 }).reconcileIntervalMs).toBe(
      5 * 60_000,
    );
  });
});

import { describe, expect, it, vi } from 'vitest';
import { PlatformVantaIntegration } from './integration.js';

const projects = [{ id: 'project-1', orgId: 'org-1' }, { id: 'project-2', orgId: 'org-2' }];
const vulnerability = { id: 'vuln-1', name: 'CVE-2026-1' };

type Connection = { id: string; status: 'active' | 'needs_reauth'; resourceId: string | null; accountLabel: null };

function createIntegration(connections: Connection[], pageInfo = { hasNextPage: false, endCursor: null as string | null }) {
  const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
    const path = new URL(String(input)).pathname;
    if (path === '/v2/connections') return Response.json({ connections });
    if (path.includes('/proxy/v1/vulnerabilities')) {
      return Response.json({ results: { data: [vulnerability], pageInfo } });
    }
    throw new Error(`Unexpected request ${input}`);
  });
  const integration = new PlatformVantaIntegration({
    clientConfig: { baseUrl: 'https://integrations.example', accessToken: 'test-token', fetchImpl: fetchImpl as typeof fetch },
  });
  return { integration, fetchImpl };
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
    const { integration, fetchImpl } = createIntegration([
      { id: 'connection-1', status: 'active', resourceId: 'project-1', accountLabel: null },
    ], { hasNextPage: true, endCursor: 'next-page' });
    await expect(integration.listVulnerabilitiesForOrg('org-1', projects)).rejects.toThrow('Incomplete Vanta vulnerability snapshot');
    expect(fetchImpl).toHaveBeenCalledTimes(51);
  });

  it('rejects a page that claims more results without a cursor', async () => {
    const { integration, fetchImpl } = createIntegration([
      { id: 'connection-1', status: 'active', resourceId: 'project-1', accountLabel: null },
    ], { hasNextPage: true, endCursor: null });
    await expect(integration.listVulnerabilitiesForOrg('org-1', projects)).rejects.toThrow('Incomplete Vanta vulnerability snapshot');
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });
});

import { RequestContext } from '@mastra/core/request-context';
import { describe, expect, it, vi } from 'vitest';
import { PROVIDERS } from '../index.js';
import { getBranchConsumptionInputSchema } from '../providers/neon/tools/get-branch-consumption.js';
import { queryBranchLogsInputSchema } from '../providers/neon/tools/query-branch-logs.js';

describe('generated Neon diagnostics', () => {
  it('retains arrays through generation and the authenticated proxy query', async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValue(Response.json({ branches: [], pagination: { cursor: 'next' } }));
    const tools = PROVIDERS.find(p => p.integrationId === 'neon')!.createTools({
      connectionId: 'connection',
      client: { baseUrl: 'https://platform.example.test', accessToken: 'token', fetch: fetchMock },
    });
    const input = {
      org_id: 'org',
      project_ids: ['project-a', 'project-b'],
      branch_ids: ['branch-a'],
      from: '2026-09-01T00:00:00Z',
      to: '2026-09-02T00:00:00Z',
      granularity: 'daily',
      metrics: ['compute_unit_seconds', 'public_network_transfer_bytes'],
      cursor: 'previous',
    };
    await expect(
      tools.neon_get_branch_consumption!.execute!(input, { requestContext: new RequestContext() }),
    ).resolves.toMatchObject({ next_cursor: 'next' });
    const query = new URL(String(fetchMock.mock.calls[0]![0])).searchParams;
    expect(query.get('project_ids')).toBe('project-a,project-b');
    expect(query.get('metrics')).toBe('compute_unit_seconds,public_network_transfer_bytes');
    expect(query.get('cursor')).toBe('previous');
    expect(
      getBranchConsumptionInputSchema.safeParse({ ...input, metrics: ['snapshot_storage_bytes_month'] }).success,
    ).toBe(false);
  });
  it('preserves log filter exclusions through generation', () => {
    const base = { project_id: 'project', branch_id: 'branch' };
    expect(
      queryBranchLogsInputSchema.safeParse({
        ...base,
        body: { logql: '{service="compute"}', body_contains: 'timeout' },
      }).success,
    ).toBe(false);
    expect(
      queryBranchLogsInputSchema.safeParse({ ...base, body: { since: '1h', start_time: '2026-09-01T00:00:00Z' } })
        .success,
    ).toBe(false);
    expect(
      queryBranchLogsInputSchema.safeParse({ ...base, body: { logql: '{service="compute"}', since: '1h', limit: 10 } })
        .success,
    ).toBe(true);
  });
});

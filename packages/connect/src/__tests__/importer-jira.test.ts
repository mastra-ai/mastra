import { describe, expect, it, vi } from 'vitest';

import type { ImporterProviderContext } from '../importer-registry.js';
import { jiraImporterRegistration } from '../providers/jira/importer.js';
import { createFakeImporter, createFakeState, runImporter, type FakeImporter } from './fixtures/importer-harness.js';

interface JiraIssueFixture {
  key: string;
  summary: string;
  description?: string;
  status?: string;
  project?: string;
  updated: string;
}

function issueNode(fixture: JiraIssueFixture) {
  return {
    id: fixture.key,
    key: fixture.key,
    self: `https://acme.atlassian.net/rest/api/3/issue/${fixture.key}`,
    fields: {
      summary: fixture.summary,
      description: fixture.description ?? null,
      status: fixture.status ? { name: fixture.status } : null,
      project: fixture.project ? { key: fixture.project, name: fixture.project } : null,
      updated: fixture.updated,
    },
  };
}

function searchResponse(issues: JiraIssueFixture[]) {
  return {
    issues: issues.map(issueNode),
    startAt: 0,
    maxResults: 50,
    total: issues.length,
  };
}

function makeContext(overrides?: { role?: 'owner' | 'edit'; request?: ReturnType<typeof vi.fn> }): {
  ctx: ImporterProviderContext;
  request: ReturnType<typeof vi.fn>;
  importer: FakeImporter;
  state: ReturnType<typeof createFakeState>;
} {
  const request = overrides?.request ?? vi.fn(async () => ({ issues: [] }));
  const role = overrides?.role ?? 'owner';
  const ctx: ImporterProviderContext = {
    connection: { id: 'c_jira', integrationId: 'jira', status: 'active' } as never,
    request: request as ImporterProviderContext['request'],
    access: { 'org:acme': role },
    schedule: '*/30 * * * *',
  };
  return { ctx, request, importer: createFakeImporter(role), state: createFakeState() };
}

describe('jira importer', () => {
  it('first run imports every issue as a node with a content-hashed record and advances the watermark', async () => {
    const { ctx, request, importer, state } = makeContext();
    request.mockResolvedValueOnce(
      searchResponse([
        { key: 'PROJ-1', summary: 'Alpha', description: 'first', updated: '2026-09-01T00:00:00.000+0000' },
        { key: 'PROJ-2', summary: 'Beta', description: 'second', updated: '2026-09-02T00:00:00.000+0000' },
      ]),
    );
    await runImporter(jiraImporterRegistration.createImporter(ctx), { importer, state });
    expect(importer.nodes.get('jira:issue:PROJ-1')?.input).toMatchObject({ name: 'Alpha' });
    expect(importer.nodes.get('jira:issue:PROJ-2')?.records.size).toBe(1);
    expect(await state.get('jira:watermark')).toBe(JSON.stringify({ watermark: '2026-09-02T00:00:00.000+0000' }));
    const call = request.mock.calls[0]![0]! as { method: string; path: string; query: Record<string, unknown> };
    expect(call.method).toBe('GET');
    expect(call.path).toBe('rest/api/3/search');
    expect(String(call.query.jql)).toContain('ORDER BY updated ASC');
  });

  it('second run with unchanged fixtures is idempotent', async () => {
    const { ctx, request, importer, state } = makeContext();
    request.mockResolvedValue(
      searchResponse([{ key: 'PROJ-1', summary: 'A', description: 'x', updated: '2026-09-01T00:00:00.000+0000' }]),
    );
    await runImporter(jiraImporterRegistration.createImporter(ctx), { importer, state });
    const first = importer.nodes.get('jira:issue:PROJ-1')!.records.size;
    await runImporter(jiraImporterRegistration.createImporter(ctx), { importer, state });
    expect(importer.nodes.get('jira:issue:PROJ-1')!.records.size).toBe(first);
  });

  it('updated issue bumps to a new record id and removes the stale record', async () => {
    const { ctx, request, importer, state } = makeContext();
    request.mockResolvedValueOnce(
      searchResponse([{ key: 'PROJ-1', summary: 'A', description: 'v1', updated: '2026-09-01T00:00:00.000+0000' }]),
    );
    await runImporter(jiraImporterRegistration.createImporter(ctx), { importer, state });
    const firstIds = [...importer.nodes.get('jira:issue:PROJ-1')!.records.keys()];
    request.mockResolvedValueOnce(
      searchResponse([{ key: 'PROJ-1', summary: 'A', description: 'v2', updated: '2026-09-02T00:00:00.000+0000' }]),
    );
    await runImporter(jiraImporterRegistration.createImporter(ctx), { importer, state });
    const secondIds = [...importer.nodes.get('jira:issue:PROJ-1')!.records.keys()];
    expect(secondIds).toHaveLength(1);
    expect(secondIds[0]).not.toBe(firstIds[0]);
  });

  it('watermark advances only on success — mid-run failure leaves it untouched', async () => {
    const { ctx, request, importer, state } = makeContext();
    request.mockRejectedValueOnce(new Error('platform down'));
    await expect(runImporter(jiraImporterRegistration.createImporter(ctx), { importer, state })).rejects.toThrow(
      /platform down/,
    );
    expect(await state.get('jira:watermark')).toBeUndefined();
  });

  it('edit-role bindings skip removing stale records on updates', async () => {
    // Under edit, the importer still uploads new record ids on update but doesn't remove the old one.
    const { ctx, request, importer, state } = makeContext({ role: 'edit' });
    request.mockResolvedValueOnce(
      searchResponse([{ key: 'PROJ-1', summary: 'A', description: 'v1', updated: '2026-09-01T00:00:00.000+0000' }]),
    );
    await runImporter(jiraImporterRegistration.createImporter(ctx), { importer, state });
    request.mockResolvedValueOnce(
      searchResponse([{ key: 'PROJ-1', summary: 'A', description: 'v2', updated: '2026-09-02T00:00:00.000+0000' }]),
    );
    await runImporter(jiraImporterRegistration.createImporter(ctx), { importer, state });
    expect(importer.nodes.get('jira:issue:PROJ-1')!.records.size).toBe(2);
  });

  it('walks multiple pages until fewer than pageSize issues are returned', async () => {
    const { ctx, request, importer, state } = makeContext();
    const bigPage = Array.from({ length: 50 }, (_, i) => ({
      key: `PROJ-${i + 1}`,
      summary: `Issue ${i + 1}`,
      updated: `2026-09-${String(i + 1).padStart(2, '0')}T00:00:00.000+0000`,
    }));
    request.mockResolvedValueOnce(searchResponse(bigPage));
    request.mockResolvedValueOnce(
      searchResponse([{ key: 'PROJ-51', summary: 'Last', updated: '2026-10-01T00:00:00.000+0000' }]),
    );
    await runImporter(jiraImporterRegistration.createImporter(ctx), { importer, state });
    expect(request).toHaveBeenCalledTimes(2);
    expect(importer.nodes.size).toBe(51);
  });

  it('formats the JQL watermark literal correctly for the second run (yyyy-MM-dd HH:mm)', async () => {
    const { ctx, request, importer, state } = makeContext();
    request.mockResolvedValueOnce(
      searchResponse([{ key: 'PROJ-1', summary: 'A', description: 'v1', updated: '2026-09-01T10:23:45.678+0000' }]),
    );
    await runImporter(jiraImporterRegistration.createImporter(ctx), { importer, state });
    request.mockResolvedValueOnce(searchResponse([]));
    await runImporter(jiraImporterRegistration.createImporter(ctx), { importer, state });
    const secondCall = request.mock.calls[1]![0]! as { query: { jql: string } };
    // JQL date literal must be YYYY-MM-DD HH:mm — no T separator, no timezone offset, no seconds.
    expect(secondCall.query.jql).toMatch(/updated >= "\d{4}-\d{2}-\d{2} \d{2}:\d{2}"/);
    expect(secondCall.query.jql).not.toMatch(/T/);
    expect(secondCall.query.jql).not.toMatch(/\+00/);
  });

  it('rejects malformed payloads via zod', async () => {
    const { ctx, request, importer, state } = makeContext();
    request.mockResolvedValueOnce({ issues: [{ key: 'PROJ-1' }] });
    await expect(runImporter(jiraImporterRegistration.createImporter(ctx), { importer, state })).rejects.toThrow();
    expect(await state.get('jira:watermark')).toBeUndefined();
  });
});

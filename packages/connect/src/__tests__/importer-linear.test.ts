import { describe, expect, it, vi } from 'vitest';

import type { ImporterProviderContext } from '../importer-registry.js';
import { linearImporterRegistration } from '../providers/linear/importer.js';
import { createFakeImporter, createFakeState, runImporter, type FakeImporter } from './fixtures/importer-harness.js';

interface LinearIssueFixture {
  id: string;
  identifier?: string;
  title: string;
  description?: string;
  updatedAt: string;
  archivedAt?: string | null;
  trashed?: boolean;
  state?: string;
  team?: string;
  url?: string;
}

function issueNode(fixture: LinearIssueFixture) {
  return {
    id: fixture.id,
    identifier: fixture.identifier ?? fixture.id,
    title: fixture.title,
    description: fixture.description ?? null,
    url: fixture.url ?? `https://linear.app/${fixture.id}`,
    updatedAt: fixture.updatedAt,
    archivedAt: fixture.archivedAt ?? null,
    trashed: fixture.trashed ?? false,
    state: fixture.state ? { name: fixture.state } : null,
    team: fixture.team ? { key: fixture.team, name: fixture.team } : null,
  };
}

function issuesResponse(issues: LinearIssueFixture[], endCursor?: string) {
  return {
    data: {
      issues: {
        nodes: issues.map(issueNode),
        pageInfo: {
          hasNextPage: Boolean(endCursor),
          endCursor: endCursor ?? null,
        },
      },
    },
  };
}

function makeContext(overrides?: { role?: 'owner' | 'edit'; request?: ReturnType<typeof vi.fn> }): {
  ctx: ImporterProviderContext;
  request: ReturnType<typeof vi.fn>;
  importer: FakeImporter;
  state: ReturnType<typeof createFakeState>;
} {
  const request =
    overrides?.request ??
    vi.fn(async () => ({
      data: { issues: { nodes: [], pageInfo: { hasNextPage: false, endCursor: null } } },
    }));
  const role = overrides?.role ?? 'owner';
  const ctx: ImporterProviderContext = {
    connection: { id: 'c_linear', integrationId: 'linear', status: 'active' } as never,
    request: request as ImporterProviderContext['request'],
    access: { 'org:acme': role },
    schedule: '*/30 * * * *',
  };
  return { ctx, request, importer: createFakeImporter(role), state: createFakeState() };
}

describe('linear importer', () => {
  it('first run imports every issue as a node with a content-hashed record and advances the watermark', async () => {
    const { ctx, request, importer, state } = makeContext();
    request.mockResolvedValueOnce(
      issuesResponse([
        { id: 'i1', title: 'Alpha', description: 'first', updatedAt: '2026-09-01T00:00:00Z' },
        { id: 'i2', title: 'Beta', description: 'second', updatedAt: '2026-09-02T00:00:00Z' },
      ]),
    );
    await runImporter(linearImporterRegistration.createImporter(ctx), { importer, state });

    expect(importer.nodes.get('linear:issue:i1')?.input).toMatchObject({ name: 'Alpha' });
    expect(importer.nodes.get('linear:issue:i2')?.records.size).toBe(1);
    expect(await state.get('linear:watermark')).toBe(JSON.stringify({ watermark: '2026-09-02T00:00:00Z' }));
    const call = request.mock.calls[0]![0]! as { method: string; path: string };
    expect(call.method).toBe('POST');
    expect(call.path).toBe('graphql');
  });

  it('second run with unchanged fixtures is idempotent', async () => {
    const { ctx, request, importer, state } = makeContext();
    request.mockResolvedValue(
      issuesResponse([{ id: 'i1', title: 'A', description: 'x', updatedAt: '2026-09-01T00:00:00Z' }]),
    );
    await runImporter(linearImporterRegistration.createImporter(ctx), { importer, state });
    const first = importer.nodes.get('linear:issue:i1')!.records.size;
    await runImporter(linearImporterRegistration.createImporter(ctx), { importer, state });
    expect(importer.nodes.get('linear:issue:i1')!.records.size).toBe(first);
  });

  it('updated issue bumps to a new record id and removes the stale record', async () => {
    const { ctx, request, importer, state } = makeContext();
    request.mockResolvedValueOnce(
      issuesResponse([{ id: 'i1', title: 'A', description: 'v1', updatedAt: '2026-09-01T00:00:00Z' }]),
    );
    await runImporter(linearImporterRegistration.createImporter(ctx), { importer, state });
    const firstIds = [...importer.nodes.get('linear:issue:i1')!.records.keys()];
    request.mockResolvedValueOnce(
      issuesResponse([{ id: 'i1', title: 'A', description: 'v2', updatedAt: '2026-09-02T00:00:00Z' }]),
    );
    await runImporter(linearImporterRegistration.createImporter(ctx), { importer, state });
    const secondIds = [...importer.nodes.get('linear:issue:i1')!.records.keys()];
    expect(secondIds).toHaveLength(1);
    expect(secondIds[0]).not.toBe(firstIds[0]);
  });

  it('watermark advances only on success — mid-run failure leaves it untouched', async () => {
    const { ctx, request, importer, state } = makeContext();
    request.mockRejectedValueOnce(new Error('platform down'));
    await expect(runImporter(linearImporterRegistration.createImporter(ctx), { importer, state })).rejects.toThrow(
      /platform down/,
    );
    expect(await state.get('linear:watermark')).toBeUndefined();
  });

  it('archived issues remove records under an owner binding but are skipped under edit', async () => {
    const owner = makeContext({ role: 'owner' });
    owner.request.mockResolvedValueOnce(
      issuesResponse([{ id: 'i1', title: 'A', description: 'v1', updatedAt: '2026-09-01T00:00:00Z' }]),
    );
    await runImporter(linearImporterRegistration.createImporter(owner.ctx), owner);
    owner.request.mockResolvedValueOnce(
      issuesResponse([{ id: 'i1', title: 'A', updatedAt: '2026-09-02T00:00:00Z', archivedAt: '2026-09-02T00:00:00Z' }]),
    );
    await runImporter(linearImporterRegistration.createImporter(owner.ctx), owner);
    expect(owner.importer.nodes.get('linear:issue:i1')!.records.size).toBe(0);

    const edit = makeContext({ role: 'edit' });
    edit.request.mockResolvedValueOnce(
      issuesResponse([{ id: 'i1', title: 'A', description: 'v1', updatedAt: '2026-09-01T00:00:00Z' }]),
    );
    await runImporter(linearImporterRegistration.createImporter(edit.ctx), edit);
    edit.request.mockResolvedValueOnce(
      issuesResponse([{ id: 'i1', title: 'A', updatedAt: '2026-09-02T00:00:00Z', archivedAt: '2026-09-02T00:00:00Z' }]),
    );
    await runImporter(linearImporterRegistration.createImporter(edit.ctx), edit);
    expect(edit.importer.nodes.get('linear:issue:i1')!.records.size).toBe(1);
  });

  it('walks multiple pages until hasNextPage is false', async () => {
    const { ctx, request, importer, state } = makeContext();
    request.mockResolvedValueOnce(
      issuesResponse([{ id: 'i1', title: 'A', updatedAt: '2026-09-01T00:00:00Z' }], 'cursor-1'),
    );
    request.mockResolvedValueOnce(issuesResponse([{ id: 'i2', title: 'B', updatedAt: '2026-09-02T00:00:00Z' }]));
    await runImporter(linearImporterRegistration.createImporter(ctx), { importer, state });
    expect(request).toHaveBeenCalledTimes(2);
    expect(importer.nodes.size).toBe(2);
  });

  it('does not advance the watermark when the run bails on maxRecords before hasNextPage: false', async () => {
    const { ctx, request, importer, state } = makeContext();
    // First run: seed a watermark from a fully drained window.
    request.mockResolvedValueOnce(
      issuesResponse([{ id: 'i0', title: 'Zero', description: 'seed', updatedAt: '2026-08-01T00:00:00Z' }]),
    );
    await runImporter(linearImporterRegistration.createImporter(ctx), { importer, state });
    const seededWatermark = await state.get('linear:watermark');
    expect(seededWatermark).toBe(JSON.stringify({ watermark: '2026-08-01T00:00:00Z' }));

    // Second run: return one page that already exceeds DEFAULT_MAX_RECORDS_PER_RUN and signals
    // hasNextPage: true. The record cap trips before the source exhausts — watermark must stay.
    const bigNodes = Array.from({ length: 501 }, (_, i) => ({
      id: `i${i + 1}`,
      title: `Issue ${i + 1}`,
      updatedAt: `2026-09-${String((i % 30) + 1).padStart(2, '0')}T00:00:00Z`,
    }));
    request.mockResolvedValueOnce(issuesResponse(bigNodes, 'cursor-1'));
    await runImporter(linearImporterRegistration.createImporter(ctx), { importer, state });
    expect(await state.get('linear:watermark')).toBe(seededWatermark);
  });

  it('rejects malformed payloads via zod', async () => {
    const { ctx, request, importer, state } = makeContext();
    request.mockResolvedValueOnce({ data: { issues: { nodes: [{ id: 'i1' }], pageInfo: { hasNextPage: false } } } });
    await expect(runImporter(linearImporterRegistration.createImporter(ctx), { importer, state })).rejects.toThrow();
    expect(await state.get('linear:watermark')).toBeUndefined();
  });
});

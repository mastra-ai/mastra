import { describe, expect, it, vi } from 'vitest';

import type { ImporterProviderContext } from '../importer-registry.js';
import { firefliesImporterRegistration } from '../providers/fireflies/importer.js';
import { createFakeImporter, createFakeState, runImporter, type FakeImporter } from './fixtures/importer-harness.js';

interface FirefliesTranscriptFixture {
  id: string;
  title?: string;
  date?: string;
  participants?: string[];
  overview?: string | null;
  actionItems?: string | null;
  keywords?: string[] | null;
}

function transcriptNode(fixture: FirefliesTranscriptFixture) {
  return {
    id: fixture.id,
    title: fixture.title ?? null,
    date: fixture.date ?? null,
    participants: fixture.participants ?? null,
    summary: {
      overview: fixture.overview ?? null,
      action_items: fixture.actionItems ?? null,
      keywords: fixture.keywords ?? null,
    },
  };
}

function transcriptsResponse(transcripts: FirefliesTranscriptFixture[]) {
  return { data: { transcripts: transcripts.map(transcriptNode) } };
}

function makeContext(overrides?: { role?: 'owner' | 'edit'; request?: ReturnType<typeof vi.fn> }): {
  ctx: ImporterProviderContext;
  request: ReturnType<typeof vi.fn>;
  importer: FakeImporter;
  state: ReturnType<typeof createFakeState>;
} {
  const request = overrides?.request ?? vi.fn(async () => ({ data: { transcripts: [] } }));
  const role = overrides?.role ?? 'owner';
  const ctx: ImporterProviderContext = {
    connection: { id: 'c_fireflies', integrationId: 'fireflies', status: 'active' } as never,
    request: request as ImporterProviderContext['request'],
    access: { 'org:acme': role },
    schedule: '0 */2 * * *',
  };
  return { ctx, request, importer: createFakeImporter(role), state: createFakeState() };
}

describe('fireflies importer', () => {
  it('first run creates one node per transcript with facet records and advances the watermark', async () => {
    const { ctx, request, importer, state } = makeContext();
    request.mockResolvedValueOnce(
      transcriptsResponse([
        {
          id: 't1',
          title: 'Weekly Sync',
          date: '2026-09-01T09:00:00Z',
          participants: ['alice@acme.com', 'bob@acme.com'],
          overview: 'Discussed roadmap.',
          actionItems: 'Alice ships auth by Friday.',
          keywords: ['roadmap', 'auth'],
        },
      ]),
    );
    await runImporter(firefliesImporterRegistration.createImporter(ctx), { importer, state });
    const node = importer.nodes.get('fireflies:transcript:t1')!;
    expect(node.input).toMatchObject({ name: 'Weekly Sync' });
    // Three facets → three records.
    expect(node.records.size).toBe(3);
    const call = request.mock.calls[0]![0]! as { method: string; path: string };
    expect(call.method).toBe('POST');
    expect(call.path).toBe('graphql');
    expect(await state.get('fireflies:watermark')).toBe(JSON.stringify({ watermark: '2026-09-01T09:00:00Z' }));
  });

  it('records carry the fireflies deep-link citation metadata', async () => {
    const { ctx, request, importer, state } = makeContext();
    request.mockResolvedValueOnce(
      transcriptsResponse([{ id: 't1', title: 'M', date: '2026-09-01T00:00:00Z', overview: 'hello' }]),
    );
    await runImporter(firefliesImporterRegistration.createImporter(ctx), { importer, state });
    const record = [...importer.nodes.get('fireflies:transcript:t1')!.records.values()][0]!;
    expect(record.metadata).toMatchObject({ citation: 'https://app.fireflies.ai/view/t1' });
  });

  it('second run with unchanged fixtures is idempotent — no new records', async () => {
    const { ctx, request, importer, state } = makeContext();
    request.mockResolvedValue(
      transcriptsResponse([
        { id: 't1', title: 'M', date: '2026-09-01T00:00:00Z', overview: 'x', actionItems: 'y', keywords: ['z'] },
      ]),
    );
    await runImporter(firefliesImporterRegistration.createImporter(ctx), { importer, state });
    const first = importer.nodes.get('fireflies:transcript:t1')!.records.size;
    await runImporter(firefliesImporterRegistration.createImporter(ctx), { importer, state });
    expect(importer.nodes.get('fireflies:transcript:t1')!.records.size).toBe(first);
  });

  it('updated overview bumps the overview record only and removes the stale one', async () => {
    const { ctx, request, importer, state } = makeContext();
    request.mockResolvedValueOnce(
      transcriptsResponse([{ id: 't1', title: 'M', date: '2026-09-01T00:00:00Z', overview: 'v1', keywords: ['k'] }]),
    );
    await runImporter(firefliesImporterRegistration.createImporter(ctx), { importer, state });
    const firstIds = new Set(importer.nodes.get('fireflies:transcript:t1')!.records.keys());
    request.mockResolvedValueOnce(
      transcriptsResponse([{ id: 't1', title: 'M', date: '2026-09-02T00:00:00Z', overview: 'v2', keywords: ['k'] }]),
    );
    await runImporter(firefliesImporterRegistration.createImporter(ctx), { importer, state });
    const secondIds = new Set(importer.nodes.get('fireflies:transcript:t1')!.records.keys());
    // Keywords record id stable across runs; overview id differs.
    const intersection = [...firstIds].filter(id => secondIds.has(id));
    expect(intersection).toHaveLength(1);
    expect(secondIds.size).toBe(2);
  });

  it('watermark advances only on success — mid-run failure leaves it untouched', async () => {
    const { ctx, request, importer, state } = makeContext();
    request.mockRejectedValueOnce(new Error('platform down'));
    await expect(runImporter(firefliesImporterRegistration.createImporter(ctx), { importer, state })).rejects.toThrow(
      /platform down/,
    );
    expect(await state.get('fireflies:watermark')).toBeUndefined();
  });

  it('transcripts with no summary facets create the node but no records', async () => {
    const { ctx, request, importer, state } = makeContext();
    request.mockResolvedValueOnce(
      transcriptsResponse([{ id: 't1', title: 'Empty Meeting', date: '2026-09-01T00:00:00Z' }]),
    );
    await runImporter(firefliesImporterRegistration.createImporter(ctx), { importer, state });
    const node = importer.nodes.get('fireflies:transcript:t1')!;
    expect(node.records.size).toBe(0);
  });

  it('walks multiple pages until fewer than limit transcripts are returned', async () => {
    const { ctx, request, importer, state } = makeContext();
    const bigPage = Array.from({ length: 25 }, (_, i) => ({
      id: `t${i + 1}`,
      title: `M${i + 1}`,
      date: `2026-09-${String(i + 1).padStart(2, '0')}T00:00:00Z`,
      overview: `overview ${i + 1}`,
    }));
    request.mockResolvedValueOnce(transcriptsResponse(bigPage));
    request.mockResolvedValueOnce(
      transcriptsResponse([{ id: 't26', title: 'Last', date: '2026-10-01T00:00:00Z', overview: 'last' }]),
    );
    await runImporter(firefliesImporterRegistration.createImporter(ctx), { importer, state });
    expect(request).toHaveBeenCalledTimes(2);
    expect(importer.nodes.size).toBe(26);
  });

  it('rejects malformed payloads via zod', async () => {
    const { ctx, request, importer, state } = makeContext();
    request.mockResolvedValueOnce({ data: { transcripts: [{ title: 'no id' }] } });
    await expect(runImporter(firefliesImporterRegistration.createImporter(ctx), { importer, state })).rejects.toThrow();
    expect(await state.get('fireflies:watermark')).toBeUndefined();
  });
});

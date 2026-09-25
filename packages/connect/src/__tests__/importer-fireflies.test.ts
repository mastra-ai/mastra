import { describe, expect, it, vi } from 'vitest';

import type { ImporterProviderContext } from '../importer-registry.js';
import { firefliesImporterRegistration } from '../providers/fireflies/importer.js';
import { createFakeImporter, createFakeState, runImporter, type FakeImporter } from './fixtures/importer-harness.js';

interface FirefliesTranscriptFixture {
  id: string;
  title?: string;
  date?: string;
  participants?: string[];
  organizerEmail?: string;
  meetingAttendees?: Array<{ displayName?: string | null; email?: string | null }>;
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
    organizer_email: fixture.organizerEmail ?? null,
    meeting_attendees: fixture.meetingAttendees ?? null,
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
    // Each transcript also mints a title-keyed series container — count transcripts only.
    const transcriptNodes = [...importer.nodes.keys()].filter(a => a.startsWith('fireflies:transcript:'));
    expect(transcriptNodes).toHaveLength(26);
  });

  it('does not advance the watermark when the run bails on maxRecords before the source signals end', async () => {
    const { ctx, request, importer, state } = makeContext();
    // First run: fully drained (one small page, fewer than limit).
    request.mockResolvedValueOnce(
      transcriptsResponse([{ id: 't0', title: 'Seed', date: '2026-08-01T00:00:00Z', overview: 'seed' }]),
    );
    await runImporter(firefliesImporterRegistration.createImporter(ctx), { importer, state });
    const seededWatermark = await state.get('fireflies:watermark');
    expect(seededWatermark).toBe(JSON.stringify({ watermark: '2026-08-01T00:00:00Z' }));

    // Second run: return 501 transcripts across full pages (limit = 25). The record cap trips
    // before a partial page signals end — watermark must stay at the seeded value and skip must
    // be persisted so the next run resumes deeper into the tail.
    const fullPages = Array.from({ length: 21 }, (_, page) =>
      Array.from({ length: 25 }, (_, j) => ({
        id: `t-${page}-${j}`,
        title: `M${page}-${j}`,
        date: `2026-09-${String((page + 1) % 30 || 30).padStart(2, '0')}T00:00:00Z`,
        overview: `o-${page}-${j}`,
      })),
    );
    for (const page of fullPages) request.mockResolvedValueOnce(transcriptsResponse(page));
    await runImporter(firefliesImporterRegistration.createImporter(ctx), { importer, state });
    expect(await state.get('fireflies:watermark')).toBe(seededWatermark);
    // Persisted skip is the offset after all full pages we processed. 20 full pages × 25 = 500,
    // and the 21st page pushes recordsCollected past 500 so the loop breaks before advancing skip.
    // We assert it's non-zero and non-empty — the next run will resume mid-backfill.
    const stored = await state.get('fireflies:resume-cursor');
    expect(stored).toBeDefined();
    const cursor = JSON.parse(stored!).cursor as string;
    expect(Number(cursor)).toBeGreaterThan(0);
  });

  it('converges initial backfill by resuming from a persisted skip and clearing it when drained', async () => {
    const { ctx, request, importer, state } = makeContext();
    // Run 1: no watermark, 20 full pages of 25 items each. After 20 iters collected = 500 and the
    // record cap trips, so exactly 20 requests are consumed and skip is persisted at 500.
    const fullPages = Array.from({ length: 20 }, (_, page) =>
      Array.from({ length: 25 }, (_, j) => ({
        id: `t-A-${page}-${j}`,
        title: `A${page}-${j}`,
        date: `2026-09-${String((page % 30) + 1).padStart(2, '0')}T00:00:00Z`,
        overview: `oA-${page}-${j}`,
      })),
    );
    for (const page of fullPages) request.mockResolvedValueOnce(transcriptsResponse(page));
    await runImporter(firefliesImporterRegistration.createImporter(ctx), { importer, state });
    expect(await state.get('fireflies:watermark')).toBeUndefined();
    const resumeStored = await state.get('fireflies:resume-cursor');
    const resumeSkip = Number(JSON.parse(resumeStored!).cursor);
    expect(resumeSkip).toBeGreaterThan(0);
    const requestsUsed = request.mock.calls.length;
    expect(requestsUsed).toBe(20);

    // Run 2: a small partial page signals end — watermark advances, resume cursor cleared.
    // Watermark must reflect HIGH-WATER across both runs — run 1 processed items in 2026-09,
    // run 2 processed a single item in 2026-07. Watermark must stay in 2026-09, not regress.
    request.mockResolvedValueOnce(
      transcriptsResponse([{ id: 't-B0', title: 'B0', date: '2026-07-15T00:00:00Z', overview: 'oB' }]),
    );
    await runImporter(firefliesImporterRegistration.createImporter(ctx), { importer, state });
    const secondCall = request.mock.calls[requestsUsed]![0]! as {
      body: { variables: { skip: number } };
    };
    expect(secondCall.body.variables.skip).toBe(resumeSkip);
    const storedWatermark = JSON.parse((await state.get('fireflies:watermark'))!).watermark as string;
    expect(storedWatermark.startsWith('2026-09')).toBe(true);
    expect(await state.get('fireflies:resume-cursor')).toBe(JSON.stringify({ cursor: '' }));
  });

  it('rejects malformed payloads via zod', async () => {
    const { ctx, request, importer, state } = makeContext();
    request.mockResolvedValueOnce({ data: { transcripts: [{ title: 'no id' }] } });
    await expect(runImporter(firefliesImporterRegistration.createImporter(ctx), { importer, state })).rejects.toThrow();
    expect(await state.get('fireflies:watermark')).toBeUndefined();
  });

  it('requests organizer_email and meeting_attendees in the GraphQL selection', async () => {
    const { ctx, request, importer, state } = makeContext();
    request.mockResolvedValueOnce(transcriptsResponse([]));
    await runImporter(firefliesImporterRegistration.createImporter(ctx), { importer, state });
    const call = request.mock.calls[0]![0]! as { body: { query: string } };
    expect(call.body.query).toContain('organizer_email');
    expect(call.body.query).toContain('meeting_attendees');
  });

  it('upserts attendee person nodes with display names and rides links on every facet record', async () => {
    const { ctx, request, importer, state } = makeContext();
    request.mockResolvedValueOnce(
      transcriptsResponse([
        {
          id: 't1',
          title: 'Weekly Sync',
          date: '2026-09-01T09:00:00Z',
          organizerEmail: 'Alice@acme.com',
          meetingAttendees: [
            { displayName: 'Alice', email: 'alice@acme.com' },
            { displayName: null, email: 'bob@acme.com' },
          ],
          overview: 'Discussed roadmap.',
          keywords: ['roadmap'],
        },
      ]),
    );
    await runImporter(firefliesImporterRegistration.createImporter(ctx), { importer, state });

    const alice = importer.nodes.get('fireflies:person:alice@acme.com')!;
    expect(alice.input).toMatchObject({
      name: 'Alice',
      kind: 'connect:fireflies:person',
      metadata: { address: 'fireflies:person:alice@acme.com' },
    });
    const bob = importer.nodes.get('fireflies:person:bob@acme.com')!;
    expect(bob.input.name).toBe('bob@acme.com');
    const series = importer.nodes.get('fireflies:series:weekly-sync')!;
    expect(series.input).toMatchObject({ name: 'Weekly Sync', kind: 'connect:fireflies:series' });

    const transcript = importer.nodes.get('fireflies:transcript:t1')!;
    expect(transcript.input.metadata).toEqual({ address: 'fireflies:transcript:t1' });
    const expectedLinks = [
      { address: 'fireflies:person:alice@acme.com', rel: 'attended-by' },
      { address: 'fireflies:person:alice@acme.com', rel: 'organized-by' },
      { address: 'fireflies:person:bob@acme.com', rel: 'attended-by' },
      { address: 'fireflies:series:weekly-sync', rel: 'in' },
    ];
    // Both facet records (overview + keywords) carry the same link set.
    const records = [...transcript.records.values()];
    expect(records).toHaveLength(2);
    for (const record of records) {
      expect((record.metadata as { links: unknown[] }).links).toEqual(expectedLinks);
    }
  });

  it('degrades to participants emails when meeting_attendees is absent', async () => {
    const { ctx, request, importer, state } = makeContext();
    request.mockResolvedValueOnce(
      transcriptsResponse([
        {
          id: 't1',
          title: 'Standup',
          date: '2026-09-01T00:00:00Z',
          participants: ['Carol@acme.com', 'dave@acme.com'],
          overview: 'x',
        },
      ]),
    );
    await runImporter(firefliesImporterRegistration.createImporter(ctx), { importer, state });

    expect(importer.nodes.get('fireflies:person:carol@acme.com')!.input.name).toBe('carol@acme.com');
    expect(importer.nodes.get('fireflies:person:dave@acme.com')).toBeDefined();
    const record = [...importer.nodes.get('fireflies:transcript:t1')!.records.values()][0]!;
    expect((record.metadata as { links: unknown[] }).links).toEqual([
      { address: 'fireflies:person:carol@acme.com', rel: 'attended-by' },
      { address: 'fireflies:person:dave@acme.com', rel: 'attended-by' },
      { address: 'fireflies:series:standup', rel: 'in' },
    ]);
  });

  it('a transcript with no title produces no series link', async () => {
    const { ctx, request, importer, state } = makeContext();
    request.mockResolvedValueOnce(
      transcriptsResponse([{ id: 't1', date: '2026-09-01T00:00:00Z', overview: 'x' }]),
    );
    await runImporter(firefliesImporterRegistration.createImporter(ctx), { importer, state });

    const seriesNodes = [...importer.nodes.keys()].filter(a => a.startsWith('fireflies:series:'));
    expect(seriesNodes).toHaveLength(0);
    const record = [...importer.nodes.get('fireflies:transcript:t1')!.records.values()][0]!;
    expect((record.metadata as { links?: unknown[] }).links).toBeUndefined();
  });

  it('a link change alone produces new facet record ids', async () => {
    const { ctx, request, importer, state } = makeContext();
    request.mockResolvedValueOnce(
      transcriptsResponse([
        {
          id: 't1',
          title: 'Sync',
          date: '2026-09-01T00:00:00Z',
          meetingAttendees: [{ displayName: 'Alice', email: 'alice@acme.com' }],
          overview: 'x',
          keywords: ['k'],
        },
      ]),
    );
    await runImporter(firefliesImporterRegistration.createImporter(ctx), { importer, state });
    const firstIds = new Set(importer.nodes.get('fireflies:transcript:t1')!.records.keys());
    expect(firstIds.size).toBe(2);

    // Same facets, same date — ONLY the attendee list changes, proving the link
    // array is part of every facet's hash payload.
    request.mockResolvedValueOnce(
      transcriptsResponse([
        {
          id: 't1',
          title: 'Sync',
          date: '2026-09-01T00:00:00Z',
          meetingAttendees: [
            { displayName: 'Alice', email: 'alice@acme.com' },
            { displayName: 'Bob', email: 'bob@acme.com' },
          ],
          overview: 'x',
          keywords: ['k'],
        },
      ]),
    );
    await runImporter(firefliesImporterRegistration.createImporter(ctx), { importer, state });
    const secondIds = new Set(importer.nodes.get('fireflies:transcript:t1')!.records.keys());
    expect(secondIds.size).toBe(2);
    const intersection = [...firstIds].filter(id => secondIds.has(id));
    expect(intersection).toHaveLength(0);
  });
});

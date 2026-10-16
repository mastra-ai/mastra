import { describe, expect, it } from 'vitest';

import {
  boundText,
  clearHighWater,
  clearResumeCursor,
  contentRecordId,
  DEFAULT_MAX_PAGES_PER_RUN,
  DEFAULT_MAX_RECORDS_PER_RUN,
  importerCronTrigger,
  linksMetadata,
  MAX_RECORD_TEXT,
  neutralizeWikilinks,
  nodeSelfMetadata,
  readHighWater,
  readResumeCursor,
  readWatermark,
  reconcileImporterNodes,
  walkPages,
  writeHighWater,
  writeResumeCursor,
  writeWatermark,
} from '../importer-runtime.js';
import type { ImporterNodeProbeResult } from '../importer-runtime.js';
import { createFakeImporter, createFakeState } from './fixtures/importer-harness.js';

function conn(id: string) {
  return { id, integrationId: 'test', status: 'active' } as never;
}

describe('importer-runtime helpers', () => {
  describe('importerCronTrigger', () => {
    it('maps concrete access keys to static bindings with the provider source', () => {
      const trigger = importerCronTrigger('notion:c1', {
        access: { 'org:acme': 'owner', 'resource:abc': 'edit' },
        schedule: '0 * * * *',
        connection: conn('c1'),
      });
      expect(trigger.schedule).toBe('0 * * * *');
      expect(trigger.bindings).toEqual([
        { source: 'notion:c1', scope: 'org:acme' },
        { source: 'notion:c1', scope: 'resource:abc' },
      ]);
      expect(trigger.resolveBindings).toBeUndefined();
    });

    it('excludes parameterized access keys from static bindings — they are authority, not destinations', () => {
      const trigger = importerCronTrigger('linear:c2', {
        access: { 'resource:$projectId': 'owner', 'org:acme': 'edit' },
        schedule: '0 * * * *',
        connection: conn('c2'),
      });
      expect(trigger.bindings).toEqual([{ source: 'linear:c2', scope: 'org:acme' }]);
    });

    it("only treats core's `$letter` parameter grammar as a pattern — a literal `$` stays a concrete destination", () => {
      const trigger = importerCronTrigger('notion:c5', {
        access: { 'org:acme$2026': 'owner', 'resource:$projectId': 'owner' },
        schedule: '0 * * * *',
        connection: conn('c5'),
      });
      expect(trigger.bindings).toEqual([{ source: 'notion:c5', scope: 'org:acme$2026' }]);
    });

    it('surfaces dynamic scopes as resolveBindings mapped to the provider source', async () => {
      const trigger = importerCronTrigger('linear:c3', {
        access: { 'resource:$projectId': 'owner' },
        schedule: '0 * * * *',
        scopes: async () => ['resource:one', 'resource:two'],
        connection: conn('c3'),
      });
      expect(trigger.bindings).toBeUndefined();
      expect(trigger.resolveBindings).toBeTypeOf('function');
      await expect(trigger.resolveBindings!()).resolves.toEqual([
        { source: 'linear:c3', scope: 'resource:one' },
        { source: 'linear:c3', scope: 'resource:two' },
      ]);
    });

    it('passes the importer connection to the scopes resolver for per-connection routing', async () => {
      const seen: string[] = [];
      const trigger = importerCronTrigger('notion:c6', {
        access: { 'resource:$projectId': 'owner' },
        schedule: '0 * * * *',
        scopes: ({ connection }) => {
          seen.push(connection.id);
          return [`resource:for-${connection.id}`];
        },
        connection: conn('c6'),
      });
      await expect(trigger.resolveBindings!()).resolves.toEqual([{ source: 'notion:c6', scope: 'resource:for-c6' }]);
      expect(seen).toEqual(['c6']);
    });

    it('keeps concrete keys as static bindings alongside a dynamic scopes resolver', async () => {
      const trigger = importerCronTrigger('zendesk:c4', {
        access: { 'org:acme': 'edit', 'resource:$projectId': 'owner' },
        schedule: '0 * * * *',
        scopes: () => ['resource:one'],
        connection: conn('c4'),
      });
      expect(trigger.bindings).toEqual([{ source: 'zendesk:c4', scope: 'org:acme' }]);
      await expect(trigger.resolveBindings!()).resolves.toEqual([{ source: 'zendesk:c4', scope: 'resource:one' }]);
    });
  });

  describe('watermark', () => {
    it('round-trips through durable state as JSON', async () => {
      const state = createFakeState();
      expect(await readWatermark(state, 'w')).toBeUndefined();
      await writeWatermark(state, 'w', '2026-01-01T00:00:00.000Z');
      expect(state.entries.get('w')).toBe(JSON.stringify({ watermark: '2026-01-01T00:00:00.000Z' }));
      expect(await readWatermark(state, 'w')).toBe('2026-01-01T00:00:00.000Z');
    });

    it('rejects malformed persisted state so a run fails instead of silently resetting the cursor', async () => {
      const state = createFakeState({ w: 'not-json' });
      await expect(readWatermark(state, 'w')).rejects.toThrow(/not valid JSON/);

      const wrongShape = createFakeState({ w: JSON.stringify({ mark: '1' }) });
      await expect(readWatermark(wrongShape, 'w')).rejects.toThrow();
    });
  });

  describe('resume cursor', () => {
    it('round-trips through durable state, treats a cleared cursor as unset, and rejects malformed state', async () => {
      const state = createFakeState();
      expect(await readResumeCursor(state, 'c')).toBeUndefined();
      await writeResumeCursor(state, 'c', 'cursor-abc');
      expect(await readResumeCursor(state, 'c')).toBe('cursor-abc');
      await clearResumeCursor(state, 'c');
      // Cleared is persisted as an empty cursor and readResumeCursor treats it as unset.
      expect(state.entries.get('c')).toBe(JSON.stringify({ cursor: '' }));
      expect(await readResumeCursor(state, 'c')).toBeUndefined();

      const bad = createFakeState({ c: 'not-json' });
      await expect(readResumeCursor(bad, 'c')).rejects.toThrow(/not valid JSON/);
    });
  });

  describe('high water', () => {
    it('round-trips through durable state, treats a cleared value as unset, and rejects malformed state', async () => {
      const state = createFakeState();
      expect(await readHighWater(state, 'h')).toBeUndefined();
      await writeHighWater(state, 'h', '2026-09-30T00:00:00Z');
      expect(await readHighWater(state, 'h')).toBe('2026-09-30T00:00:00Z');
      await clearHighWater(state, 'h');
      expect(state.entries.get('h')).toBe(JSON.stringify({ highWater: '' }));
      expect(await readHighWater(state, 'h')).toBeUndefined();

      const bad = createFakeState({ h: 'not-json' });
      await expect(readHighWater(bad, 'h')).rejects.toThrow(/not valid JSON/);
    });
  });

  describe('linksMetadata', () => {
    it('sorts deterministically by address-or-name then rel, and dedups identical entries', () => {
      expect(
        linksMetadata([
          { address: 'z:2', rel: 'references' },
          { address: 'a:1', rel: 'references' },
          { address: 'a:1', rel: 'references' },
          { address: 'a:1', rel: 'child-of' },
          { name: 'Middle Page', rel: 'references' },
        ]),
      ).toEqual({
        // Sorted by code-unit order of `address ?? name`, then `rel` — 'M' < 'a' < 'z'.
        links: [
          { name: 'Middle Page', rel: 'references' },
          { address: 'a:1', rel: 'child-of' },
          { address: 'a:1', rel: 'references' },
          { address: 'z:2', rel: 'references' },
        ],
      });
    });

    it('drops entries with neither address nor name and returns {} when nothing survives', () => {
      expect(linksMetadata([])).toEqual({});
      expect(linksMetadata([{ rel: 'references' }, { address: '  ' }, { name: '' }])).toEqual({});
    });
  });

  describe('nodeSelfMetadata', () => {
    it('produces the address, adding aliases only when present', () => {
      expect(nodeSelfMetadata('notion:page:p1')).toEqual({ address: 'notion:page:p1' });
      expect(nodeSelfMetadata('linear:document:d1', ['linear:document:slug:s1'])).toEqual({
        address: 'linear:document:d1',
        addressAliases: ['linear:document:slug:s1'],
      });
      expect(nodeSelfMetadata('a', [])).toEqual({ address: 'a' });
    });
  });

  describe('neutralizeWikilinks', () => {
    it('replaces both bracket forms with fullwidth lookalikes so imported text cannot mint edges', () => {
      expect(neutralizeWikilinks('see [[Other Page]] and [[Another]]')).toBe(
        'see ［［Other Page］］ and ［［Another］］',
      );
      expect(neutralizeWikilinks('no links here')).toBe('no links here');
    });
  });

  describe('contentRecordId', () => {
    it('is deterministic for identical content and differs on any change', () => {
      const a = contentRecordId({ id: '1', text: 'hello' });
      const b = contentRecordId({ id: '1', text: 'hello' });
      const c = contentRecordId({ id: '1', text: 'hello!' });
      expect(a).toBe(b);
      expect(a).not.toBe(c);
    });

    it('produces an RFC-4122-shaped id', () => {
      expect(contentRecordId('x')).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-8[0-9a-f]{3}-[0-9a-f]{12}$/);
    });
  });

  describe('boundText', () => {
    it('truncates over the configured limit and preserves the leading portion', () => {
      const long = 'a'.repeat(MAX_RECORD_TEXT + 100);
      const bounded = boundText(long);
      expect(bounded.length).toBe(MAX_RECORD_TEXT);
      expect(boundText('short')).toBe('short');
    });
  });

  describe('walkPages', () => {
    it('stops when fetchPage returns undefined', async () => {
      const seen: number[] = [];
      await walkPages(
        { signal: new AbortController().signal },
        async i => (i < 3 ? { i } : undefined),
        async ({ page, recordsProcessed }) => {
          seen.push(page.i);
          return recordsProcessed + 1;
        },
      );
      expect(seen).toEqual([0, 1, 2]);
    });

    it('honours the record cap even if pages keep coming', async () => {
      let calls = 0;
      await walkPages(
        { signal: new AbortController().signal, maxRecords: 2 },
        async i => {
          calls++;
          return { i };
        },
        async ({ recordsProcessed }) => recordsProcessed + 1,
      );
      expect(calls).toBe(2);
    });

    it('respects an aborted signal without another fetch', async () => {
      const controller = new AbortController();
      const fetched: number[] = [];
      await walkPages(
        { signal: controller.signal },
        async i => {
          fetched.push(i);
          return { i };
        },
        async ({ recordsProcessed }) => {
          controller.abort();
          return recordsProcessed + 1;
        },
      );
      expect(fetched).toEqual([0]);
    });

    it('exposes sensible defaults for record and page bounds', () => {
      expect(DEFAULT_MAX_RECORDS_PER_RUN).toBeGreaterThan(0);
      expect(DEFAULT_MAX_PAGES_PER_RUN).toBeGreaterThan(0);
    });
  });

  describe('reconcileImporterNodes', () => {
    const PREFIX = 'linear:document:';
    const KEY = 'linear:reconcile:cursor';

    async function seed(
      role: 'owner' | 'edit' = 'owner',
      addresses = ['linear:document:a', 'linear:document:b', 'linear:document:c'],
    ) {
      const importer = createFakeImporter(role);
      for (const address of addresses) {
        const handle = await importer.upsertNode(address, { name: address, metadata: nodeSelfMetadata(address) });
        await handle.appendKnowledge({ id: `${address}#r`, text: 'body' });
      }
      return { importer, state: createFakeState() };
    }

    function run(
      fixtures: Awaited<ReturnType<typeof seed>>,
      probe: (address: string) => Promise<ImporterNodeProbeResult>,
      overrides: { limit?: number; signal?: AbortSignal; canRemove?: boolean } = {},
    ) {
      return reconcileImporterNodes({
        importer: fixtures.importer,
        state: fixtures.state,
        cursorKey: KEY,
        addressPrefixes: [PREFIX],
        canRemove: overrides.canRemove ?? fixtures.importer.role === 'owner',
        probe,
        signal: overrides.signal ?? new AbortController().signal,
        limit: overrides.limit ?? 50,
      });
    }

    const records = (f: Awaited<ReturnType<typeof seed>>, address: string) =>
      f.importer.nodes.get(address)!.records.size;

    it('probes metadata addresses, never handle ids, and harness ids differ from addresses', async () => {
      const f = await seed();
      const handles = await f.importer.listNodes();
      expect(handles.every(h => !h.id.startsWith(PREFIX))).toBe(true);
      expect(handles.map(h => h.node.metadata)).toEqual([
        { address: 'linear:document:a' },
        { address: 'linear:document:b' },
        { address: 'linear:document:c' },
      ]);
      const seen: string[] = [];
      await run(f, async address => {
        seen.push(address);
        return 'present';
      });
      expect(seen).toEqual(['linear:document:a', 'linear:document:b', 'linear:document:c']);
    });

    it('removes records only on a positive removed verdict and keeps the node', async () => {
      const f = await seed();
      const result = await run(f, async a => (a === 'linear:document:b' ? 'removed' : 'present'));
      expect(result).toEqual({ probed: 3, removedRecords: 1, wrapped: true });
      expect(records(f, 'linear:document:b')).toBe(0);
      expect(f.importer.nodes.has('linear:document:b')).toBe(true);
      expect(records(f, 'linear:document:a')).toBe(1);
      expect(await readResumeCursor(f.state, KEY)).toBeUndefined();
    });

    it('keeps records on uncertain and advances past it', async () => {
      const f = await seed();
      await run(f, async () => 'uncertain', { limit: 1 });
      expect(records(f, 'linear:document:a')).toBe(1);
      expect(await readResumeCursor(f.state, KEY)).toBe('linear:document:a');
    });

    it('keeps records and does not advance the cursor when the probe throws, then resumes there', async () => {
      const f = await seed();
      await expect(
        run(f, async a => {
          if (a === 'linear:document:b') throw new Error('503');
          return 'removed';
        }),
      ).rejects.toThrow('503');
      expect(records(f, 'linear:document:a')).toBe(0);
      expect(records(f, 'linear:document:b')).toBe(1);
      expect(await readResumeCursor(f.state, KEY)).toBe('linear:document:a');

      const seen: string[] = [];
      await run(f, async a => {
        seen.push(a);
        return 'removed';
      });
      expect(seen).toEqual(['linear:document:b', 'linear:document:c']);
      expect(records(f, 'linear:document:b')).toBe(0);
    });

    it('never deletes or advances when aborted, including mid-probe', async () => {
      const f = await seed();
      const pre = new AbortController();
      pre.abort();
      expect(await run(f, async () => 'removed', { signal: pre.signal })).toEqual({
        probed: 0,
        removedRecords: 0,
        wrapped: false,
      });

      const mid = new AbortController();
      await run(
        f,
        async () => {
          mid.abort();
          return 'removed';
        },
        { signal: mid.signal },
      );
      expect([...f.importer.nodes.values()].every(n => n.records.size === 1)).toBe(true);
      expect(f.state.entries.has(KEY)).toBe(false);
    });

    it('leaves foreign-prefix, metadata-less, and id-mismatched nodes untouched', async () => {
      const f = await seed('owner', ['linear:document:a']);
      const project = await f.importer.upsertNode('linear:project:p', {
        name: 'p',
        metadata: nodeSelfMetadata('linear:project:p'),
      });
      await project.appendKnowledge({ id: 'p#r', text: 'x' });
      const bare = await f.importer.upsertNode('linear:document:z', { name: 'z' });
      await bare.appendKnowledge({ id: 'z#r', text: 'x' });
      // Metadata claims an address whose binding resolves to a different node.
      const liar = await f.importer.upsertNode('linear:document:y', {
        name: 'y',
        metadata: nodeSelfMetadata('linear:document:a'),
      });
      await liar.appendKnowledge({ id: 'y#r', text: 'x' });

      const seen: string[] = [];
      const result = await run(f, async a => {
        seen.push(a);
        return 'removed';
      });
      expect(seen).toEqual(['linear:document:a']);
      expect(result.removedRecords).toBe(1);
      expect(records(f, 'linear:project:p')).toBe(1);
      expect(records(f, 'linear:document:z')).toBe(1);
      expect(records(f, 'linear:document:y')).toBe(1);
    });

    it('is a no-op without owner authority', async () => {
      const f = await seed('edit');
      let probes = 0;
      const result = await run(f, async () => {
        probes++;
        return 'removed';
      });
      expect(result).toEqual({ probed: 0, removedRecords: 0, wrapped: false });
      expect(probes).toBe(0);
      expect(f.state.entries.has(KEY)).toBe(false);
    });

    it('walks in bounded address-ordered slices and wraps deterministically', async () => {
      const f = await seed('owner', ['linear:document:c', 'linear:document:a', 'linear:document:b']);
      const seen: string[][] = [];
      for (let i = 0; i < 3; i++) {
        const batch: string[] = [];
        const result = await run(
          f,
          async a => {
            batch.push(a);
            return 'present';
          },
          { limit: 2 },
        );
        seen.push(batch);
        expect(result.wrapped).toBe(i === 1);
      }
      expect(seen).toEqual([
        ['linear:document:a', 'linear:document:b'],
        ['linear:document:c'],
        ['linear:document:a', 'linear:document:b'],
      ]);
    });

    it('replays idempotently after a crash between removal and checkpoint', async () => {
      const f = await seed();
      await run(f, async () => 'removed');
      await clearResumeCursor(f.state, KEY);
      const result = await run(f, async () => 'removed');
      expect(result).toEqual({ probed: 3, removedRecords: 0, wrapped: true });
    });
  });
});

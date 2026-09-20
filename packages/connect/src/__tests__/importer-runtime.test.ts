import { describe, expect, it } from 'vitest';

import {
  boundText,
  clearResumeCursor,
  contentRecordId,
  DEFAULT_MAX_PAGES_PER_RUN,
  DEFAULT_MAX_RECORDS_PER_RUN,
  MAX_RECORD_TEXT,
  readResumeCursor,
  readWatermark,
  walkPages,
  writeResumeCursor,
  writeWatermark,
} from '../importer-runtime.js';
import { createFakeState } from './fixtures/importer-harness.js';

describe('importer-runtime helpers', () => {
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
});

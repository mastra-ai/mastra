import { describe, expect, it } from 'vitest';

import { fitRows, MAX_RESULT_CHARS } from './result-size';

const HINT = 'Call again with a smaller page.limit and follow page.next to see every row.';
const size = (value: unknown) => JSON.stringify(value).length;

describe('fitRows', () => {
  it('keeps the keyset cursor when a single oversized row is clipped, so paging continues past it', () => {
    // A keyset store answering page.limit: 1, where the middle row is far over the cap.
    const rows = [
      { spanId: 's1', input: 'small' },
      { spanId: 's2', input: 'x'.repeat(60_000) },
      { spanId: 's3', input: 'small' },
    ];
    const query = (cursor?: string) => {
      const index = cursor ? Number(cursor) : 0;
      const next = index + 1 < rows.length ? String(index + 1) : undefined;
      return { spans: [rows[index]], page: next ? { next } : {} };
    };

    const seen: string[] = [];
    let cursor: string | undefined;
    do {
      const result = fitRows(query(cursor), 'spans', HINT, { cursors: ['page'], detail: 'get_span' }) as any;
      expect(size(result)).toBeLessThanOrEqual(MAX_RESULT_CHARS);
      seen.push(...result.spans.map((span: { spanId: string }) => span.spanId));
      cursor = result.page?.next;
    } while (cursor);
    expect(seen).toEqual(['s1', 's2', 's3']);
  });

  it('removes other views of the rows (uiMessages) even when the only row is clipped, and keeps the cursor', () => {
    const message = {
      id: 'm1',
      role: 'user',
      content: { format: 2, parts: [{ type: 'text', text: 'x'.repeat(60_000) }] },
    };
    const uiMessage = { id: 'm1', role: 'user', parts: [{ type: 'text', text: 'x'.repeat(60_000) }] };
    const result = fitRows({ messages: [message], uiMessages: [uiMessage], hasMore: true }, 'messages', HINT, {
      cursors: ['hasMore'],
      views: ['uiMessages'],
    }) as any;
    expect(size(result)).toBeLessThanOrEqual(MAX_RESULT_CHARS);
    expect(result).not.toHaveProperty('uiMessages');
    expect(result.hasMore).toBe(true);
    expect(result.messages[0].id).toBe('m1');
    expect(result.messages[0].content.parts[0].text).toMatch(/\[truncated \d+ chars\]$/);
  });

  it('drops the cursor when rows were cut, since it would skip them', () => {
    const rows = Array.from({ length: 10 }, (_, index) => ({ spanId: `s${index}`, input: 'x'.repeat(10_000) }));
    const result = fitRows({ spans: rows, page: { next: 'after-s9' } }, 'spans', HINT, { cursors: ['page'] }) as any;
    expect(result.spans.length).toBeLessThan(10);
    expect(result).not.toHaveProperty('page');
  });

  it('never clips id-like keys and stops clipping at 100 characters', () => {
    const longId = `id-${'i'.repeat(200)}`;
    const row = {
      id: longId,
      spanId: longId,
      trace_id: longId,
      parts: Array.from({ length: 2_000 }, () => ({ text: 't'.repeat(150) })),
    };
    const result = fitRows({ spans: [row, row] }, 'spans', HINT, { detail: 'get_span' }) as any;
    expect(result.spans).toHaveLength(1);
    const [kept] = result.spans;
    expect(kept.id).toBe(longId);
    expect(kept.spanId).toBe(longId);
    expect(kept.trace_id).toBe(longId);
    expect(kept.parts[0].text).toMatch(/^t{100}\[truncated 50 chars, use get_span for the full value\]$/);
  });
});

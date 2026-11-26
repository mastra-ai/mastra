import { describe, expect, it } from 'vitest';

import { EventRingBuffer } from './ring-buffer';

function occurrence(id: string, data: Record<string, unknown> = {}, timestamp = new Date().toISOString()) {
  return { eventId: id, name: 'test', timestamp, data };
}

function filled(count: number, capacity = 10) {
  const buffer = new EventRingBuffer('boot/test', capacity);
  for (let i = 1; i <= count; i++) buffer.push(occurrence(`e${i}`, { i }));
  return buffer;
}

const ids = (result: { events: Array<{ eventId: string }> }) => result.events.map(event => event.eventId);

describe('EventRingBuffer', () => {
  it('starts from now for a null or absent cursor', () => {
    const buffer = filled(3);
    for (const cursor of [null, undefined]) {
      const result = buffer.read(cursor, { maxEvents: 10, maxAgeMs: 1_000_000 });
      expect(result).toEqual({ from: buffer.head, events: [], cursor: buffer.head, truncated: false, hasMore: false });
    }

    const start = buffer.read(null, { maxEvents: 10 }).cursor;
    buffer.push(occurrence('e4'));
    expect(ids(buffer.read(start, { maxEvents: 10 }))).toEqual(['e4']);
  });

  it('resumes after a cursor, with each event carrying its own position', () => {
    const buffer = new EventRingBuffer('boot/test', 10);
    const start = buffer.head;
    for (let i = 1; i <= 4; i++) buffer.push(occurrence(`e${i}`));

    const first = buffer.read(start, { maxEvents: 2 });
    expect(ids(first)).toEqual(['e1', 'e2']);
    const second = buffer.read(first.cursor, { maxEvents: 10 });
    expect(ids(second)).toEqual(['e3', 'e4']);
    expect(second.truncated).toBe(false);
    expect(second.from).toBe(first.cursor);
    expect(second.cursor).toBe(buffer.head);
    expect(second.events[1]!.cursor).toBe(buffer.head);
  });

  it('marks a cursor older than the retained window as truncated and resumes at the oldest event', () => {
    const buffer = new EventRingBuffer('boot/test', 3);
    buffer.push(occurrence('e1'));
    const stale = buffer.read(null, { maxEvents: 10 }).cursor;
    for (let i = 2; i <= 6; i++) buffer.push(occurrence(`e${i}`));

    const result = buffer.read(stale, { maxEvents: 10 });
    expect(result.truncated).toBe(true);
    expect(ids(result)).toEqual(['e4', 'e5', 'e6']);
  });

  it('treats foreign and malformed cursors as a gap', () => {
    const buffer = filled(2);
    // Same sequence numbers, different process.
    const restarted = new EventRingBuffer('other-boot/test', 10);
    restarted.push(occurrence('x'));

    for (const cursor of ['not-a-cursor', restarted.head, Buffer.from('boot/test:99').toString('base64url')]) {
      const result = buffer.read(cursor, { maxEvents: 10 });
      expect(result.truncated).toBe(true);
      expect(ids(result)).toEqual(['e1', 'e2']);
    }
  });

  it('applies the maxAgeMs floor and reports the skipped events as truncation', () => {
    const now = Date.parse('2026-01-01T00:10:00Z');
    const buffer = new EventRingBuffer('boot/test', 10);
    const start = buffer.head;
    buffer.push(occurrence('old', {}, '2026-01-01T00:00:00Z'));
    buffer.push(occurrence('new', {}, '2026-01-01T00:09:30Z'));

    const floored = buffer.read(start, { maxEvents: 10, maxAgeMs: 60_000, now });
    expect(ids(floored)).toEqual(['new']);
    expect(floored.truncated).toBe(true);

    const unfloored = buffer.read(start, { maxEvents: 10, maxAgeMs: 3_600_000, now });
    expect(ids(unfloored)).toEqual(['old', 'new']);
    expect(unfloored.truncated).toBe(false);
  });

  it('caps a read at maxEvents and reports hasMore with the cursor at the last returned event', () => {
    const buffer = new EventRingBuffer('boot/test', 10);
    const start = buffer.head;
    for (let i = 1; i <= 5; i++) buffer.push(occurrence(`e${i}`));

    const page = buffer.read(start, { maxEvents: 2 });
    expect(ids(page)).toEqual(['e1', 'e2']);
    expect(page.hasMore).toBe(true);
    expect(page.cursor).toBe(page.events[1]!.cursor);

    const rest = buffer.read(page.cursor, { maxEvents: 10 });
    expect(ids(rest)).toEqual(['e3', 'e4', 'e5']);
    expect(rest.hasMore).toBe(false);
  });

  it('filters with match while advancing the cursor past rejected events', () => {
    const buffer = new EventRingBuffer('boot/test', 10);
    const start = buffer.head;
    buffer.push(occurrence('a1', { project: 'a' }));
    buffer.push(occurrence('b1', { project: 'b' }));
    buffer.push(occurrence('b2', { project: 'b' }));

    const result = buffer.read(start, { maxEvents: 10, match: data => data.project === 'a' });
    expect(ids(result)).toEqual(['a1']);
    expect(result.cursor).toBe(buffer.head);
    expect(buffer.read(result.cursor, { maxEvents: 10, match: data => data.project === 'a' }).events).toEqual([]);
  });

  it('mints monotonic cursors per type, independent across types', () => {
    const a = new EventRingBuffer('boot/a', 10);
    const b = new EventRingBuffer('boot/b', 10);
    const aStart = a.head;
    const cursors = [a.push(occurrence('1')).cursor, a.push(occurrence('2')).cursor];
    expect(new Set([aStart, ...cursors]).size).toBe(3);
    b.push(occurrence('b1'));

    // A cursor from another type is foreign to this one.
    expect(b.read(cursors[0], { maxEvents: 10 }).truncated).toBe(true);
    expect(ids(a.read(cursors[0], { maxEvents: 10 }))).toEqual(['2']);
  });
});

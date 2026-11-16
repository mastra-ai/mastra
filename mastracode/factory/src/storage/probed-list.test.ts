import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ProbedList } from './probed-list.js';
import type { Probe } from './probed-list.js';

interface Row {
  id: string;
  title: string;
  at: number;
}

function table(rows: Row[] = []) {
  let loads = 0;
  return {
    rows,
    get loads() {
      return loads;
    },
    probe: async (): Promise<Probe> => {
      const newest = rows.reduce<Row | undefined>(
        (best, row) => (!best || row.at > best.at || (row.at === best.at && row.id > best.id) ? row : best),
        undefined,
      );
      return { stamp: `${rows.length}:${newest?.id ?? ''}:${newest?.at ?? 0}`, newestAt: newest?.at ?? 0 };
    },
    load: async (): Promise<readonly Row[]> => {
      loads += 1;
      return rows.map(row => ({ ...row }));
    },
  };
}

const titles = (rows: readonly Row[]) => rows.map(row => row.title);

describe('ProbedList', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'], now: new Date('2026-11-15T10:00:00Z') });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const settledRow = (id: string, title: string): Row => ({ id, title, at: Date.now() - 10_000 });

  it('serves an unchanged, settled list without reading it again', async () => {
    const t = table([settledRow('a', 'first')]);
    const list = new ProbedList<Row>();

    expect(titles(await list.read('p', t.probe, t.load))).toEqual(['first']);
    expect(titles(await list.read('p', t.probe, t.load))).toEqual(['first']);
    expect(t.loads).toBe(1);
  });

  it('shows a new row at once, even one older than the newest', async () => {
    const t = table([settledRow('b', 'second')]);
    const list = new ProbedList<Row>();
    await list.read('p', t.probe, t.load);

    t.rows.push({ id: 'a', title: 'backdated', at: Date.now() - 60_000 });

    expect(titles(await list.read('p', t.probe, t.load))).toEqual(['second', 'backdated']);
  });

  it('shows an edited row at once', async () => {
    const t = table([settledRow('a', 'first'), settledRow('b', 'second')]);
    const list = new ProbedList<Row>();
    await list.read('p', t.probe, t.load);

    t.rows[0] = { id: 'a', title: 'renamed', at: Date.now() };
    vi.setSystemTime(Date.now() + 6_000);

    expect(titles(await list.read('p', t.probe, t.load))).toEqual(['renamed', 'second']);
  });

  it('holds a list only once it was read seconds after its newest write, since that write may have raced the probe', async () => {
    const t = table([{ id: 'a', title: 'first', at: Date.now() }]);
    const list = new ProbedList<Row>();
    await list.read('p', t.probe, t.load);

    t.rows[0] = { id: 'a', title: 'committed late', at: t.rows[0]?.at ?? 0 };
    vi.setSystemTime(Date.now() + 4_000);

    expect(titles(await list.read('p', t.probe, t.load))).toEqual(['committed late']);

    vi.setSystemTime(Date.now() + 1_000);
    t.rows[0] = { id: 'a', title: 'made private', at: t.rows[0]?.at ?? 0 };

    expect(titles(await list.read('p', t.probe, t.load))).toEqual(['made private']);

    t.rows[0] = { id: 'a', title: 'unseen', at: t.rows[0]?.at ?? 0 };

    expect(titles(await list.read('p', t.probe, t.load))).toEqual(['made private']);
  });

  it('reads the list again once the hold is a minute old, whatever the probe says', async () => {
    const t = table([settledRow('a', 'first')]);
    const list = new ProbedList<Row>();
    await list.read('p', t.probe, t.load);
    t.rows[0] = { id: 'a', title: 'missed by the probe', at: t.rows[0]?.at ?? 0 };

    vi.setSystemTime(Date.now() + 59_999);
    expect(titles(await list.read('p', t.probe, t.load))).toEqual(['first']);

    vi.setSystemTime(Date.now() + 1);
    expect(titles(await list.read('p', t.probe, t.load))).toEqual(['missed by the probe']);
  });

  it('reads every time when the store cannot probe', async () => {
    const t = table([settledRow('a', 'first')]);
    const list = new ProbedList<Row>();
    await list.read('p', t.probe, t.load);

    await list.read('p', async () => undefined, t.load);
    await list.read('p', async () => undefined, t.load);
    t.rows[0] = { id: 'a', title: 'edited while unprobed', at: t.rows[0]?.at ?? 0 };

    expect(titles(await list.read('p', t.probe, t.load))).toEqual(['edited while unprobed']);
    expect(t.loads).toBe(4);
  });

  it('shares one read between concurrent callers', async () => {
    const t = table([settledRow('a', 'first')]);
    const list = new ProbedList<Row>();
    const gate = Promise.withResolvers<void>();
    const load = async () => {
      await gate.promise;
      return t.load();
    };

    const reads = [list.read('p', t.probe, load), list.read('p', t.probe, load), list.read('p', t.probe, load)];
    gate.resolve();

    expect((await Promise.all(reads)).map(titles)).toEqual([['first'], ['first'], ['first']]);
    expect(t.loads).toBe(1);
  });

  it('reads again after a failed read instead of holding the failure', async () => {
    const t = table([settledRow('a', 'first')]);
    const list = new ProbedList<Row>();

    await expect(
      list.read('p', t.probe, async () => {
        throw new Error('connection reset');
      }),
    ).rejects.toThrow('connection reset');

    expect(titles(await list.read('p', t.probe, t.load))).toEqual(['first']);
  });

  it('holds at most 100 lists, dropping the oldest', async () => {
    const t = table([settledRow('a', 'first')]);
    const list = new ProbedList<Row>();
    for (let key = 0; key <= 100; key += 1) await list.read(`p${key}`, t.probe, t.load);
    expect(t.loads).toBe(101);

    await list.read('p1', t.probe, t.load);
    expect(t.loads).toBe(101);

    await list.read('p0', t.probe, t.load);
    expect(t.loads).toBe(102);
  });

  it('hands out a list callers cannot change under each other', async () => {
    const t = table([settledRow('a', 'first')]);
    const list = new ProbedList<Row>();
    const rows = await list.read('p', t.probe, t.load);

    expect(Object.isFrozen(rows)).toBe(true);
  });
});

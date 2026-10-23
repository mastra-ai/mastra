import { describe, expect, it } from 'vitest';
import { buildMovers, figuresFromAggregate, moverTrend, previousWindow, windowLength, withCost } from './movers';
import type { MoverFigures } from './movers';

const figures = (entries: Record<string, MoverFigures>) => new Map(Object.entries(entries));

describe('buildMovers', () => {
  describe('when runs changed for several entities', () => {
    it('ranks by absolute change, so a big entity moving by hundreds outranks a small one doubling', () => {
      const movers = buildMovers(
        figures({ big: { count: 1300 }, small: { count: 20 } }),
        figures({ big: { count: 1000 }, small: { count: 10 } }),
        'count',
      );
      expect(movers).toEqual([
        { key: 'big', current: 1300, previous: 1000, change: 0.3 },
        { key: 'small', current: 20, previous: 10, change: 1 },
      ]);
    });
  });

  describe('when an entity is new this window', () => {
    it('lists it after every entity with a previous figure, with no change', () => {
      const movers = buildMovers(
        figures({ fresh: { count: 5000 }, old: { count: 11 } }),
        figures({ old: { count: 10 } }),
        'count',
      );
      expect(movers.map(m => [m.key, m.change])).toEqual([
        ['old', 0.1],
        ['fresh', null],
      ]);
    });
  });

  describe('when an entity went quiet', () => {
    it('counts a drop to zero for runs and cost', () => {
      const prev = figures({ gone: { count: 40, cost: 2, errorRate: 0.5 } });
      expect(buildMovers(new Map(), prev, 'count')).toEqual([{ key: 'gone', current: 0, previous: 40, change: -1 }]);
      expect(buildMovers(new Map(), prev, 'cost')).toEqual([{ key: 'gone', current: 0, previous: 2, change: -1 }]);
    });

    it('has no error rate or P95 to compare', () => {
      expect(buildMovers(new Map(), figures({ gone: { errorRate: 0.5, p95: 100 } }), 'errorRate')).toEqual([]);
    });
  });

  describe('when error rate changed', () => {
    it('reports the change in points, not percent', () => {
      const [mover] = buildMovers(
        figures({ a: { errorRate: 0.07 } }),
        figures({ a: { errorRate: 0.02 } }),
        'errorRate',
      );
      expect(mover?.change).toBeCloseTo(0.05);
    });
  });

  describe('when nothing changed', () => {
    it('lists nothing', () => {
      expect(buildMovers(figures({ a: { count: 3 } }), figures({ a: { count: 3 } }), 'count')).toEqual([]);
    });
  });
});

describe('moverTrend', () => {
  describe('when a figure went up', () => {
    it('is good for runs and bad for error rate, P95 and cost', () => {
      const up = { key: 'a', current: 2, previous: 1, change: 1 };
      expect(moverTrend(up, 'count')).toBe('good');
      expect(moverTrend(up, 'errorRate')).toBe('bad');
      expect(moverTrend(up, 'p95')).toBe('bad');
      expect(moverTrend(up, 'cost')).toBe('bad');
    });
  });

  describe('when there is no previous figure', () => {
    it('is neither', () => {
      expect(moverTrend({ key: 'a', current: 2, previous: null, change: null }, 'count')).toBeNull();
    });
  });
});

describe('figuresFromAggregate', () => {
  describe('when rows group by two dimensions', () => {
    it('keys them as metric series do', () => {
      const map = figuresFromAggregate(
        [
          {
            dimensions: { spanType: 'agent_run', entityName: 'Code Agent' },
            measures: { count: 4, errorRate: 0.25, 'duration.p95': 9 },
          },
        ],
        ['spanType', 'entityName'],
      );
      expect(map.get('agent_run|Code Agent')).toEqual({ count: 4, errorRate: 0.25, p95: 9 });
    });
  });
});

describe('withCost', () => {
  describe('when a key has cost but no runs', () => {
    it('still gets a row', () => {
      expect(withCost(new Map(), [['p1', 3]]).get('p1')).toEqual({ cost: 3 });
    });
  });
});

describe('previousWindow', () => {
  describe('when given a 7-day window', () => {
    it('returns the 7 days before it', () => {
      const end = new Date('2026-10-23T00:00:00Z');
      const start = new Date('2026-10-16T00:00:00Z');
      expect(previousWindow({ start, end })).toEqual({ start: new Date('2026-10-09T00:00:00Z'), end: start });
      expect(windowLength({ start, end })).toBe('7 days');
    });
  });

  describe('when given a 24-hour window', () => {
    it('names it in hours', () => {
      expect(windowLength({ start: new Date(0), end: new Date(24 * 3_600_000) })).toBe('24 hours');
    });
  });
});

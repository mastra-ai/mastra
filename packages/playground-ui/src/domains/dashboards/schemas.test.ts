import { describe, expect, it } from 'vitest';
import {
  BUILT_IN_WIDGET_KINDS,
  KPI_ICONS,
  kpisOptionsSchema,
  scoresOptionsSchema,
  tableOptionsSchema,
  timeseriesOptionsSchema,
  valueExprSchema,
} from './index';

describe('dashboard schema exports', () => {
  it('exports the schema each built-in kind validates its options with', () => {
    const byKind = Object.fromEntries(BUILT_IN_WIDGET_KINDS.map(k => [k.kind, k.optionsSchema]));
    expect(byKind).toEqual({
      kpis: kpisOptionsSchema,
      table: tableOptionsSchema,
      timeseries: timeseriesOptionsSchema,
      scores: scoresOptionsSchema,
    });
  });

  it('accepts every exported KPI icon', () => {
    for (const icon of KPI_ICONS) {
      const options = { items: [{ label: 'Runs', icon, format: 'count', value: { query: 'runs' } }] };
      expect(kpisOptionsSchema.safeParse(options).success).toBe(true);
    }
    const unknown = { items: [{ label: 'Runs', icon: 'rocket', format: 'count', value: { query: 'runs' } }] };
    expect(kpisOptionsSchema.safeParse(unknown).success).toBe(false);
  });

  it('parses a nested value expression', () => {
    const expr = { ratio: { of: { minus: [{ query: 'a' }, { query: 'b' }] }, over: { sum: [{ query: 'a' }] } } };
    expect(valueExprSchema.parse(expr)).toEqual(expr);
  });
});

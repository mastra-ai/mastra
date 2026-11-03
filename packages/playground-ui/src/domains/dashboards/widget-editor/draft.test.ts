import { describe, expect, it } from 'vitest';
import type { EditorKind } from './catalogue';
import { draftToWidget } from './codec';
import { DEFAULT_VIEW_LABEL, carrySplit, emptyView, emptyWidget, metricKey } from './draft';
import type { ViewDraft, WidgetDraft } from './draft';

const split: ViewDraft = {
  ...emptyView(DEFAULT_VIEW_LABEL),
  metrics: [{ key: metricKey(), entry: 'input-tokens' }],
  splitBy: 'entityName',
  splitValues: ['weather-agent', 'support-agent'],
};

/** The split each query of the saved widget groups by, once the view is switched to `kind`. */
function groupsAfterSwitch(view: ViewDraft, kind: EditorKind) {
  const draft: WidgetDraft = { ...emptyWidget('Tokens'), kind, kindPicked: true, views: [carrySplit(view, kind)] };
  const encoded = draftToWidget(draft, []);
  expect([...encoded.issues, ...encoded.views.flatMap(v => v.issues)]).toEqual([]);
  return encoded.widget?.views[0]?.queries.map(q => ('groupBy' in q ? q.groupBy : undefined));
}

describe('carrySplit', () => {
  it('keeps the series split between line and stacked bars', () => {
    expect(carrySplit(split, 'stackedBar')).toEqual(split);
    expect(groupsAfterSwitch(split, 'stackedBar')).toEqual([['entityName']]);
  });

  it('turns a chart split into table rows, and back into the same series', () => {
    const asTable = carrySplit(split, 'table');
    expect(groupsAfterSwitch(split, 'table')).toEqual([['entityName']]);
    expect(carrySplit(asTable, 'line')).toEqual(split);
  });

  it('drops table rows a chart has no values to draw for', () => {
    const rows = { ...split, splitValues: [] };
    expect(carrySplit(rows, 'line')).toMatchObject({ splitBy: undefined, splitValues: [] });
    expect(groupsAfterSwitch(rows, 'line')).toEqual([undefined]);
  });

  it("drops the split for KPIs, which don't split", () => {
    expect(carrySplit(split, 'kpis')).toMatchObject({ splitBy: undefined, splitValues: [] });
  });
});

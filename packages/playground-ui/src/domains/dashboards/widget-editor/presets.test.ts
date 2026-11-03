import { describe, expect, it } from 'vitest';
import { BUILT_IN_WIDGET_KINDS } from '../kinds';
import { prepareWidget } from '../lib/prepare-widget';
import { draftToWidget, effectiveKind, widgetToDraft } from './codec';
import { emptyView, emptyWidget, metricKey } from './draft';
import type { ViewDraft, WidgetDraft } from './draft';
import { QUICK_METRICS, WIDGET_PRESETS } from './presets';

const REGISTRY = new Map(BUILT_IN_WIDGET_KINDS.map(k => [k.kind, k]));

/** The draft the starter hands the editor, encoded the way the dialog saves it. */
function save(view: ViewDraft, picked?: WidgetDraft['kind']) {
  const base = emptyWidget('New widget 1');
  const draft: WidgetDraft = { ...base, views: [view], ...(picked && { kind: picked, kindPicked: true }) };
  const kind = effectiveKind(draft, []);
  return { kind, encoded: draftToWidget({ ...draft, kind }, []) };
}

function expectUsable(encoded: ReturnType<typeof save>['encoded']) {
  expect([...encoded.issues, ...encoded.views.flatMap(v => v.issues)]).toEqual([]);
  const widget = encoded.widget;
  if (!widget) throw new Error('no widget');
  // The dashboard draws it…
  expect(prepareWidget(widget, REGISTRY, 'project')).toMatchObject({ ok: true });
  // …and Edit stays offered on it.
  expect(widgetToDraft(widget, [])).toBeDefined();
}

describe('widget starter', () => {
  it.each(WIDGET_PRESETS)('preset $id saves a widget the dashboard draws and the editor reopens', preset => {
    const { kind, encoded } = save(preset.view(), preset.kind);
    expect(kind).toBe(preset.kind);
    expectUsable(encoded);
  });

  it.each(QUICK_METRICS)('quick metric $label saves a widget the dashboard draws and the editor reopens', m => {
    const view = {
      ...emptyView('Default view'),
      metrics: [{ key: metricKey(), entry: m.entry, aggregation: m.aggregation }],
    };
    expectUsable(save(view).encoded);
  });
});

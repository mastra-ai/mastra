import type { DashboardWidget } from '@mastra/core/storage/dashboards';
import { BUILT_IN_WIDGET_KINDS } from '@mastra/playground-ui/domains/dashboards/kinds';
import { describeIssue, prepareWidget } from '@mastra/playground-ui/domains/dashboards/lib/prepare-widget';
import { describe, expect, it } from 'vitest';
import { inScope, KIND_CHECKS, viewIssues } from '../dashboard-views';
import type { DashboardScope } from '../dashboard-views';
import {
  BROKEN_DASHBOARDS,
  emptyKpis,
  kpis,
  metricsWidgets,
  readsMissingQuery,
  threeKpiViews,
} from './fixtures/broken-dashboards';

const registry = new Map(BUILT_IN_WIDGET_KINDS.map(kind => [kind.kind, kind]));
const scopes: DashboardScope[] = ['org', 'project'];

const widgets: [name: string, widget: DashboardWidget][] = [
  ...metricsWidgets.map(widget => [`Studio's ${widget.id} widget`, widget] as [string, DashboardWidget]),
  ...BROKEN_DASHBOARDS.flatMap(([name, definition]) =>
    definition.rows.flatMap(row =>
      row.widgets.map(widget => [`${name}: ${widget.id}`, widget] as [string, DashboardWidget]),
    ),
  ),
];

describe("the strict schema's view checks", () => {
  it.each(widgets.flatMap(([name, widget]) => scopes.map(scope => [name, scope, widget] as const)))(
    "reject what the renderer rejects: %s at %s scope, with the renderer's message",
    (_, scope, widget) => {
      const prepared = prepareWidget(widget, registry, scope);

      if (!inScope(widget, scope)) return expect(prepared).toEqual({ ok: 'hidden' });
      if (!Object.hasOwn(KIND_CHECKS, widget.kind)) {
        return expect(prepared).toEqual({ ok: false, message: 'This widget needs a newer version.' });
      }
      const [first] = viewIssues(widget, KIND_CHECKS[widget.kind as keyof typeof KIND_CHECKS], scope);
      if (first) expect(prepared).toEqual({ ok: false, message: describeIssue(first) });
      else expect(prepared.ok).not.toBe(false);
    },
  );

  it.each([
    ['its options fail to parse', emptyKpis],
    ['its kind finds a problem', readsMissingQuery],
  ])('report a later issue as the renderer does once the view before it is fixed, when %s', (_, first) => {
    const [, second] = viewIssues(threeKpiViews(first), KIND_CHECKS.kpis, 'project');

    const fixed = threeKpiViews(kpis.views[0]!);

    expect(second).toBeDefined();
    expect(prepareWidget(fixed, registry, 'project')).toEqual({ ok: false, message: describeIssue(second) });
  });
});

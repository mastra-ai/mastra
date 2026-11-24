import { dashboardDefinitionSchema, dashboardWidgetSchema } from '@mastra/core/storage/dashboards';
import { METRICS_DASHBOARD } from '@mastra/playground-ui/domains/dashboards/metrics-dashboard';
import { describe, expect, it } from 'vitest';
import type { z } from 'zod/v4';
import { strictDashboardDefinitionSchema, strictDashboardWidgetSchema } from '../dashboards';
import {
  BROKEN_DASHBOARDS,
  definition,
  kpis,
  metricsWidget,
  metricsWidgets,
  withView,
} from './fixtures/broken-dashboards';

const issuesOf = (result: { error?: z.ZodError }) =>
  result.error?.issues.map(issue => ({ path: issue.path, message: issue.message }));

describe('strictDashboardDefinitionSchema', () => {
  it("passes Studio's Metrics dashboard, returning it unchanged", () => {
    const result = strictDashboardDefinitionSchema.safeParse(METRICS_DASHBOARD);

    expect(issuesOf(result)).toBeUndefined();
    expect(result.data).toEqual(METRICS_DASHBOARD);
  });

  it("passes Studio's Metrics dashboard once core has parsed it, filling in defaults", () => {
    const parsed = dashboardDefinitionSchema.parse(structuredClone(METRICS_DASHBOARD));

    expect(parsed).not.toEqual(METRICS_DASHBOARD);
    expect(issuesOf(strictDashboardDefinitionSchema.safeParse(parsed))).toBeUndefined();
  });

  it.each(BROKEN_DASHBOARDS)('rejects %s, at its path', (_, value, issues) => {
    expect(dashboardDefinitionSchema.safeParse(value).success).toBe(true);
    expect(issuesOf(strictDashboardDefinitionSchema.safeParse(value))).toEqual(issues);
  });

  it("reports what core's schema rejects at core's path, without checking kinds", () => {
    const value = definition(kpis, { ...kpis, kind: 'heatmap' });

    expect(issuesOf(strictDashboardDefinitionSchema.safeParse(value))).toEqual(
      issuesOf(dashboardDefinitionSchema.safeParse(value)),
    );
    expect(issuesOf(strictDashboardDefinitionSchema.safeParse(value))).toEqual([
      { path: ['rows', 0, 'widgets', 1, 'id'], message: expect.any(String) },
    ]);
    expect(strictDashboardDefinitionSchema.safeParse({ ...definition(kpis), schemaVersion: 2 }).success).toBe(false);
  });
});

describe('strictDashboardWidgetSchema', () => {
  it.each(metricsWidgets.map(widget => [widget.id, widget] as const))(
    "passes Studio's %s widget, as written and as core parses it",
    (_, widget) => {
      expect(issuesOf(strictDashboardWidgetSchema.safeParse(widget))).toBeUndefined();
      expect(strictDashboardWidgetSchema.safeParse(widget).data).toBe(widget);
      expect(issuesOf(strictDashboardWidgetSchema.safeParse(dashboardWidgetSchema.parse(widget)))).toBeUndefined();
    },
  );

  it('reports paths from the widget', () => {
    const widget = withView(metricsWidget('agent-runs'), view => ({ ...view, options: { chart: 'pie' } }));

    expect(issuesOf(strictDashboardWidgetSchema.safeParse(widget))).toContainEqual({
      path: ['views', 0, 'options', 'chart'],
      message: expect.any(String),
    });
  });
});

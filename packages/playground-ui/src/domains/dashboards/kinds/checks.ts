import type { DashboardBuiltInWidgetKind } from '@mastra/client-js';
import { tableIssues, tableOptionsSchema } from '../lib/table';
import type { TableOptions } from '../lib/table';
import { timeseriesIssues, timeseriesOptionsSchema } from '../lib/timeseries';
import type { TimeseriesOptions } from '../lib/timeseries';
import type { WidgetKindCheck } from '../widget-kind';
import { kpisIssues, kpisOptionsSchema } from './kpis/options';
import type { KpisOptions } from './kpis/options';
import { scoresIssues, scoresOptionsSchema } from './scores/options';
import type { ScoresOptions } from './scores/options';

/**
 * How each built-in kind checks a view, with no React: the renderer's kinds are built from these,
 * and a stored definition can be checked with them before it's saved.
 */

export const kpisCheck: WidgetKindCheck<KpisOptions> = {
  kind: 'kpis',
  optionsSchema: kpisOptionsSchema,
  issues: kpisIssues,
};

export const tableCheck: WidgetKindCheck<TableOptions> = {
  kind: 'table',
  optionsSchema: tableOptionsSchema,
  issues: view => tableIssues(view.columns, view.options, view.queries),
};

export const timeseriesCheck: WidgetKindCheck<TimeseriesOptions> = {
  kind: 'timeseries',
  optionsSchema: timeseriesOptionsSchema,
  issues: view => timeseriesIssues(view.options, view.queries),
};

export const scoresCheck: WidgetKindCheck<ScoresOptions> = {
  kind: 'scores',
  optionsSchema: scoresOptionsSchema,
  issues: scoresIssues,
};

/** Every built-in kind's check, by kind. */
export const BUILT_IN_WIDGET_CHECKS: Record<DashboardBuiltInWidgetKind, WidgetKindCheck<any>> = {
  kpis: kpisCheck,
  table: tableCheck,
  timeseries: timeseriesCheck,
  scores: scoresCheck,
};

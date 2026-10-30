import { timeseriesIssues, timeseriesOptionsSchema } from '../../lib/timeseries';
import { defineWidgetKind } from '../../widget-kind';
import { TimeseriesWidget } from './timeseries-widget';

/** Values per time bucket as stacked bars or lines, from metrics, trace or span time series. */
export const timeseriesKind = defineWidgetKind({
  kind: 'timeseries',
  optionsSchema: timeseriesOptionsSchema,
  issues: view => timeseriesIssues(view.options, view.queries),
  component: TimeseriesWidget,
});

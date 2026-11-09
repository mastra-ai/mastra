import { defineWidgetKind } from '../../widget-kind';
import { timeseriesCheck } from '../checks';
import { timeseriesGatedQueries, timeseriesRequests } from './timeseries-plan';
import { TimeseriesWidget } from './timeseries-widget';

/** Values per time bucket as stacked bars or lines, from metrics, trace or span time series. */
export const timeseriesKind = defineWidgetKind({
  ...timeseriesCheck,
  gatedQueries: timeseriesGatedQueries,
  requests: timeseriesRequests,
  component: TimeseriesWidget,
});

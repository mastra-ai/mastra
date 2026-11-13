import type { AnyWidgetKind } from '../widget-kind';
import { kpisKind } from './kpis';
import { scoresKind } from './scores';
import { tableKind } from './table';
import { timeseriesKind } from './timeseries';

export { tableColumnOptionsSchema, tableKind, tableOptionsSchema } from './table';
export type { TableColumnOptions, TableOptions } from './table';
export { KPI_ICONS, kpiItemSchema, kpisKind, kpisOptionsSchema } from './kpis';
export type { KpiIcon, KpiItem, KpisOptions } from './kpis';
export { scoresKind, scoresOptionsSchema } from './scores';
export type { ScoresOptions } from './scores';
export { timeseriesKind, timeseriesOptionsSchema, timeseriesSeriesSchema } from './timeseries';
export type { TimeseriesOptions, TimeseriesSeries } from './timeseries';

/** The kinds every dashboard can use; hosts add their own through `DashboardRenderer`'s `kinds`. */
export const BUILT_IN_WIDGET_KINDS: AnyWidgetKind[] = [kpisKind, tableKind, timeseriesKind, scoresKind];

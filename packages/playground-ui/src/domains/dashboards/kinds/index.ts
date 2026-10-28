import type { AnyWidgetKind } from '../widget-kind';
import { kpisKind } from './kpis';
import { scoresKind } from './scores';
import { tableKind } from './table';
import { timeseriesKind } from './timeseries';

export { kpisKind } from './kpis';
export { scoresKind } from './scores';
export { tableKind } from './table';
export { timeseriesKind } from './timeseries';

/** The kinds every dashboard can use; hosts add their own through `DashboardRenderer`'s `kinds`. */
export const BUILT_IN_WIDGET_KINDS: AnyWidgetKind[] = [kpisKind, tableKind, timeseriesKind, scoresKind];

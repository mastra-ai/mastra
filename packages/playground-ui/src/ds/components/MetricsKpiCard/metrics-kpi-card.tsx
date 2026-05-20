import { MetricsKpiCardChange } from './metrics-kpi-card-change';
import { MetricsKpiCardError } from './metrics-kpi-card-error';
import { MetricsKpiCardLabel } from './metrics-kpi-card-label';
import { MetricsKpiCardLoading } from './metrics-kpi-card-loading';
import { MetricsKpiCardNoChange } from './metrics-kpi-card-no-change';
import { MetricsKpiCardNoData } from './metrics-kpi-card-no-data';
import { MetricsKpiCardRoot } from './metrics-kpi-card-root';
import { MetricsKpiCardValue } from './metrics-kpi-card-value';

export const MetricsKpiCard = Object.assign(MetricsKpiCardRoot, {
  Label: MetricsKpiCardLabel,
  Value: MetricsKpiCardValue,
  Change: MetricsKpiCardChange,
  NoChange: MetricsKpiCardNoChange,
  NoData: MetricsKpiCardNoData,
  Error: MetricsKpiCardError,
  Loading: MetricsKpiCardLoading,
});

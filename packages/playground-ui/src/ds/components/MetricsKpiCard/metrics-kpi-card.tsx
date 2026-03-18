import { MetricsKpiCardRoot } from './metrics-kpi-card-root';
import { MetricsKpiCardLabel } from './metrics-kpi-card-label';
import { MetricsKpiCardValue } from './metrics-kpi-card-value';
import { MetricsKpiCardChange } from './metrics-kpi-card-change';
import { MetricsKpiCardNoChange } from './metrics-kpi-card-no-change';
import { MetricsKpiCardNoData } from './metrics-kpi-card-no-data';

export const MetricsKpiCard = Object.assign(MetricsKpiCardRoot, {
  Label: MetricsKpiCardLabel,
  Value: MetricsKpiCardValue,
  Change: MetricsKpiCardChange,
  NoChange: MetricsKpiCardNoChange,
  NoData: MetricsKpiCardNoData,
});

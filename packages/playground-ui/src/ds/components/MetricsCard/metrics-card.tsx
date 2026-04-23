import { MetricsCardContent } from './metrics-card-content';
import { MetricsCardDescription } from './metrics-card-description';
import { MetricsCardError } from './metrics-card-error';
import { MetricsCardLoading } from './metrics-card-loading';
import { MetricsCardNoData } from './metrics-card-no-data';
import { MetricsCardRoot } from './metrics-card-root';
import { MetricsCardSummary } from './metrics-card-summary';
import { MetricsCardTitle } from './metrics-card-title';
import { MetricsCardTitleAndDescription } from './metrics-card-title-and-description';
import { MetricsCardTopBar } from './metrics-card-top-bar';
import { MetricsKpiCard } from '@/ds/components/MetricsKpiCard';

export const MetricsCard = Object.assign(MetricsCardRoot, {
  Root: MetricsCardRoot,
  Kpi: MetricsKpiCard,
  TopBar: MetricsCardTopBar,
  TitleAndDescription: MetricsCardTitleAndDescription,
  Title: MetricsCardTitle,
  Description: MetricsCardDescription,
  Summary: MetricsCardSummary,
  Loading: MetricsCardLoading,
  Error: MetricsCardError,
  Content: MetricsCardContent,
  NoData: MetricsCardNoData,
});

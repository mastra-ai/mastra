import { MetricsCardActions } from './metrics-card-actions';
import { MetricsCardContent } from './metrics-card-content';
import { MetricsCardError } from './metrics-card-error';
import { MetricsCardHeadline } from './metrics-card-headline';
import { MetricsCardLoading } from './metrics-card-loading';
import { MetricsCardNoData } from './metrics-card-no-data';
import { MetricsCardRoot } from './metrics-card-root';
import { MetricsCardTitle } from './metrics-card-title';
import { MetricsCardTitleMenu } from './metrics-card-title-menu';
import { MetricsCardToolbar } from './metrics-card-toolbar';
import { MetricsCardTopBar } from './metrics-card-top-bar';
import { MetricsCardTotal } from './metrics-card-total';
import { MetricsKpiCard } from '@/ds/components/MetricsKpiCard';

export const MetricsCard = Object.assign(MetricsCardRoot, {
  Root: MetricsCardRoot,
  Kpi: MetricsKpiCard,
  TopBar: MetricsCardTopBar,
  Toolbar: MetricsCardToolbar,
  Actions: MetricsCardActions,
  Title: MetricsCardTitle,
  TitleMenu: MetricsCardTitleMenu,
  Total: MetricsCardTotal,
  Headline: MetricsCardHeadline,
  Loading: MetricsCardLoading,
  Error: MetricsCardError,
  Content: MetricsCardContent,
  NoData: MetricsCardNoData,
});

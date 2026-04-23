import {
  ButtonWithTooltip,
  ErrorState,
  NoDataPageLayout,
  PageHeader,
  PageLayout,
  PermissionDenied,
  SessionExpired,
  is401UnauthorizedError,
  is403ForbiddenError,
} from '@mastra/playground-ui';
import { BarChart3Icon, BookIcon } from 'lucide-react';
import { useCallback } from 'react';
import { useSearchParams } from 'react-router';
import { MetricsProvider, useAgentRunsKpiMetrics, isValidPreset } from '@/domains/metrics/components';
import { DateRangeSelector } from '@/domains/metrics/components/date-range-selector';
import { MetricsDashboard } from '@/domains/metrics/components/metrics-dashboard';
import type { DatePreset } from '@/domains/metrics/hooks/use-metrics';

const PERIOD_PARAM = 'period';

export default function Metrics() {
  const [searchParams, setSearchParams] = useSearchParams();
  const urlPreset = searchParams.get(PERIOD_PARAM);
  const initialPreset: DatePreset = isValidPreset(urlPreset) ? urlPreset : '24h';

  const handlePresetChange = useCallback(
    (preset: DatePreset) => {
      setSearchParams(
        prev => {
          const next = new URLSearchParams(prev);
          if (preset === '24h') {
            next.delete(PERIOD_PARAM);
          } else {
            next.set(PERIOD_PARAM, preset);
          }
          return next;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  return (
    <MetricsProvider initialPreset={initialPreset} onPresetChange={handlePresetChange}>
      <MetricsContent />
    </MetricsProvider>
  );
}

function MetricsContent() {
  const { error } = useAgentRunsKpiMetrics();

  if (error && is401UnauthorizedError(error)) {
    return (
      <NoDataPageLayout title="Metrics" icon={<BarChart3Icon />}>
        <SessionExpired />
      </NoDataPageLayout>
    );
  }

  if (error && is403ForbiddenError(error)) {
    return (
      <NoDataPageLayout title="Metrics" icon={<BarChart3Icon />}>
        <PermissionDenied resource="metrics" />
      </NoDataPageLayout>
    );
  }

  if (error) {
    return (
      <NoDataPageLayout title="Metrics" icon={<BarChart3Icon />}>
        <ErrorState title="Failed to load metrics" message={error.message} />
      </NoDataPageLayout>
    );
  }

  return (
    <PageLayout width="wide" height="full">
      <PageLayout.TopArea className="sticky top-0 z-100 bg-surface1 ">
        <PageLayout.Row>
          <PageLayout.Column>
            <PageHeader>
              <PageHeader.Title>
                <BarChart3Icon /> Metrics
              </PageHeader.Title>
            </PageHeader>
          </PageLayout.Column>
          <PageLayout.Column className="flex justify-end gap-2">
            <DateRangeSelector />
            <ButtonWithTooltip
              as="a"
              href="https://mastra.ai/en/docs/observability/overview"
              target="_blank"
              rel="noopener noreferrer"
              tooltipContent="Go to Metrics documentation"
            >
              <BookIcon />
            </ButtonWithTooltip>
          </PageLayout.Column>
        </PageLayout.Row>
      </PageLayout.TopArea>

      <MetricsDashboard />
    </PageLayout>
  );
}

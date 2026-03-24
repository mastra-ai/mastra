import {
  MetricsDashboard,
  DateRangeSelector,
  MetricsProvider,
  MainHeader,
  isValidPreset,
  ButtonWithTooltip,
  useExperimentalFeatures,
} from '@mastra/playground-ui';
import type { DatePreset } from '@mastra/playground-ui';
import { BarChart3Icon, BookIcon } from 'lucide-react';
import { useCallback } from 'react';
import { useSearchParams } from 'react-router';

const PERIOD_PARAM = 'period';

export default function Metrics() {
  const { experimentalFeaturesEnabled } = useExperimentalFeatures();
  const [searchParams, setSearchParams] = useSearchParams();

  if (!experimentalFeaturesEnabled) {
    return null;
  }
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
      <div className="w-full  px-[3vw] mx-auto grid h-full grid-rows-[auto_1fr] overflow-y-auto">
        <MainHeader withMargins={false} className="mt-6 mb-4">
          <MainHeader.Column>
            <MainHeader.Title>
              <BarChart3Icon /> Metrics
            </MainHeader.Title>
          </MainHeader.Column>
          <MainHeader.Column className="flex justify-end gap-2">
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
          </MainHeader.Column>
        </MainHeader>

        <MetricsDashboard />
      </div>
    </MetricsProvider>
  );
}

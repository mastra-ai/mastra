import { MetricsDashboard, DateRangeSelector, MetricsProvider, MainHeader, isValidPreset } from '@mastra/playground-ui';
import type { DatePreset } from '@mastra/playground-ui';
import { BarChart3Icon } from 'lucide-react';
import { useSearchParams } from 'react-router';
import { useCallback } from 'react';

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
      <div className="w-full  px-[3vw] mx-auto grid h-full grid-rows-[auto_1fr] overflow-y-auto">
        <MainHeader withMargins={false} className="mt-6 mb-4">
          <MainHeader.Column>
            <MainHeader.Title>
              <BarChart3Icon /> Metrics
            </MainHeader.Title>
          </MainHeader.Column>
          <MainHeader.Column>
            <DateRangeSelector />
          </MainHeader.Column>
        </MainHeader>

        <MetricsDashboard />
      </div>
    </MetricsProvider>
  );
}

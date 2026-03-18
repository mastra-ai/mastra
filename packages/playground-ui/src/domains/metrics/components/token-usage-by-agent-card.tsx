import { MetricsCard } from '@/ds/components/MetricsCard';
import { HorizontalBars } from '@/ds/components/HorizontalBars';
import { CHART_COLORS, formatCompact } from './metrics-utils';
import { Tabs, TabList, Tab, TabContent } from '@/ds/components/Tabs';
import { useTokenUsageByAgentMetrics } from '../hooks/use-token-usage-by-agent-metrics';

export function TokenUsageByAgentCard() {
  const { data, isLoading } = useTokenUsageByAgentMetrics();

  const hasData = !!data && data.length > 0;
  const totalTokens = data?.reduce((s, d) => s + d.total, 0) ?? 0;

  return (
    <MetricsCard>
      <MetricsCard.TopBar>
        <MetricsCard.TitleAndDescription
          title="Token Usage by Agent"
          description="Token consumption grouped by agent."
        />
        {hasData && <MetricsCard.Summary value={formatCompact(totalTokens)} label="Total tokens" />}
      </MetricsCard.TopBar>
      {isLoading ? (
        <MetricsCard.Loading />
      ) : (
        <MetricsCard.Content>
          {!hasData ? (
            <MetricsCard.NoData message="No token usage data yet" />
          ) : (
            <Tabs defaultTab="tokens" className="grid grid-rows-[auto_1fr] overflow-y-auto h-full">
              <TabList>
                <Tab value="tokens" size="smaller">
                  Tokens
                </Tab>
                <Tab value="cost" size="smaller">
                  Cost
                </Tab>
              </TabList>
              <TabContent value="tokens">
                <HorizontalBars
                  data={data.map(d => ({ name: d.name, values: [d.input, d.output] }))}
                  segments={[
                    { label: 'Input', color: CHART_COLORS.blueDark },
                    { label: 'Output', color: CHART_COLORS.blue },
                  ]}
                  maxVal={Math.max(...data.map(d => d.input + d.output))}
                  fmt={formatCompact}
                />
              </TabContent>
              <TabContent value="cost">
                <MetricsCard.NoData message="No cost data yet" />
              </TabContent>
            </Tabs>
          )}
        </MetricsCard.Content>
      )}
    </MetricsCard>
  );
}

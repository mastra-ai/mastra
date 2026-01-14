import { Tabs, TabList, Tab, TabContent } from '@/ds/components/Tabs';
import {
  KeyValueList,
  KeyValueListItemData,
  Section,
  Sections,
  SpanScoring,
  SpanScoreList,
  useLinkComponent,
} from '@/index';
import { TraceSpanUsage, type TokenUsage } from './trace-span-usage';
import { SpanDetails } from './span-details';
import { CircleGaugeIcon } from 'lucide-react';
import type { ListScoresResponse } from '@mastra/core/evals';
import type { GetScorerResponse } from '@mastra/client-js';
import { SpanRecord } from '@mastra/core/storage';

type SpanTabsProps = {
  trace?: SpanRecord;
  span?: SpanRecord;
  spanScoresData?: ListScoresResponse | null;
  onSpanScoresPageChange?: (page: number) => void;
  isLoadingSpanScoresData?: boolean;
  spanInfo?: KeyValueListItemData[];
  defaultActiveTab?: string;
  initialScoreId?: string;
  computeTraceLink: (traceId: string, spanId?: string) => string;
  scorers?: Record<string, GetScorerResponse>;
  isLoadingScorers?: boolean;
};

export function SpanTabs({
  trace,
  span,
  spanScoresData,
  onSpanScoresPageChange,
  isLoadingSpanScoresData,
  spanInfo = [],
  defaultActiveTab = 'details',
  initialScoreId,
  computeTraceLink,
  scorers,
  isLoadingScorers,
}: SpanTabsProps) {
  const { Link } = useLinkComponent();

  let entityType;
  if (span?.attributes?.agentId) {
    entityType = 'Agent';
  } else if (span?.attributes?.workflowId) {
    entityType = 'Workflow';
  }

  return (
    <Tabs defaultTab={defaultActiveTab}>
      <TabList>
        <Tab value="details">Details</Tab>
        <Tab value="scores">Scoring {spanScoresData?.pagination && `(${spanScoresData.pagination.total || 0})`}</Tab>
      </TabList>
      <TabContent value="details">
        <Sections>
          {span?.attributes?.usage ? <TraceSpanUsage spanUsage={span.attributes.usage as TokenUsage} /> : null}
          <KeyValueList data={spanInfo} LinkComponent={Link} />
          <SpanDetails span={span} />
        </Sections>
      </TabContent>
      <TabContent value="scores">
        <Sections>
          <Section>
            <Section.Header>
              <Section.Heading>
                <CircleGaugeIcon /> Scoring
              </Section.Heading>
            </Section.Header>
            <SpanScoring
              traceId={trace?.traceId}
              isTopLevelSpan={!Boolean(span?.parentSpanId)}
              spanId={span?.spanId}
              entityType={entityType}
              scorers={scorers}
              isLoadingScorers={isLoadingScorers}
            />
          </Section>
          <Section>
            <Section.Header>
              <Section.Heading>
                <CircleGaugeIcon /> Scores
              </Section.Heading>
            </Section.Header>
            <SpanScoreList
              scoresData={spanScoresData}
              onPageChange={onSpanScoresPageChange}
              isLoadingScoresData={isLoadingSpanScoresData}
              initialScoreId={initialScoreId}
              traceId={trace?.traceId}
              spanId={span?.spanId}
              computeTraceLink={computeTraceLink}
            />
          </Section>
        </Sections>
      </TabContent>
    </Tabs>
  );
}

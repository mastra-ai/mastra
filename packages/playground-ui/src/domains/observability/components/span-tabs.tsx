import { Tabs } from '@/components/ui/elements/tabs';
import {
  KeyValueList,
  KeyValueListItemData,
  Section,
  Sections,
  SpanScoring,
  SpanScoreList,
  useLinkComponent,
} from '@/index';
import { TraceSpanUsage } from './trace-span-usage';
import { SpanDetails } from './span-details';
import { CircleGaugeIcon } from 'lucide-react';
import { ListScoresResponse } from '@mastra/client-js';
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
      <Tabs.List>
        <Tabs.Tab value="details">Details</Tabs.Tab>
        <Tabs.Tab value="scores">
          Scoring {spanScoresData?.pagination && `(${spanScoresData.pagination.total || 0})`}
        </Tabs.Tab>
      </Tabs.List>
      <Tabs.Content value="details">
        <Sections>
          {span?.attributes?.usage && <TraceSpanUsage spanUsage={span.attributes.usage} />}
          <KeyValueList data={spanInfo} LinkComponent={Link} />
          <SpanDetails span={span} />
        </Sections>
      </Tabs.Content>
      <Tabs.Content value="scores">
        <Sections>
          <Section>
            <Section.Header>
              <Section.Heading>
                <CircleGaugeIcon /> Scoring
              </Section.Heading>
            </Section.Header>
            <SpanScoring traceId={trace?.traceId} spanId={span?.spanId} entityType={entityType} />
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
      </Tabs.Content>
    </Tabs>
  );
}

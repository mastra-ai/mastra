import { Tabs } from '@/components/ui/elements/tabs';
import {
  KeyValueList,
  KeyValueListItemData,
  Section,
  Sections,
  SpanScoring,
  TraceScoreList,
  useLinkComponent,
} from '@/index';
import { TraceSpanUsage } from './trace-span-usage';
import { SpanDetails } from './span-details';
import { CircleGaugeIcon } from 'lucide-react';
import { GetScoresResponse } from 'node_modules/@mastra/client-js/dist/types';
import { AISpanRecord } from 'node_modules/@mastra/core/dist/storage/index.warning';

type SpanTabsProps = {
  trace?: AISpanRecord;
  span?: AISpanRecord;
  spanScoresData?: GetScoresResponse | null;
  onSpanScoresPageChange?: (page: number) => void;
  isLoadingSpanScoresData?: boolean;
  spanInfo?: KeyValueListItemData[];
  isOpen: boolean;
  onClose?: () => void;
  onNext?: () => void;
  onPrevious?: () => void;
  onViewToggle?: () => void;
  onScorerTriggered: (scorerName: string, traceId: string, spanId?: string) => void;
  defaultActiveTab?: string;
  initialScoreId?: string;
};

export function SpanTabs({
  trace,
  span,
  spanScoresData,
  onSpanScoresPageChange,
  isLoadingSpanScoresData,
  spanInfo = [],
  onScorerTriggered,
  defaultActiveTab = 'details',
  initialScoreId,
}: SpanTabsProps) {
  const { Link } = useLinkComponent();

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
          <SpanDetails span={span} onScorerTriggered={onScorerTriggered} />
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
            <SpanScoring traceId={trace?.traceId} spanId={span?.spanId} onScorerTriggered={onScorerTriggered} />
          </Section>
          <Section>
            <Section.Header>
              <Section.Heading>
                <CircleGaugeIcon /> Scores
              </Section.Heading>
            </Section.Header>
            <TraceScoreList
              scoresData={spanScoresData}
              onPageChange={onSpanScoresPageChange}
              isLoadingScoresData={isLoadingSpanScoresData}
              initialScoreId={initialScoreId}
              traceId={trace?.traceId}
              spanId={span?.spanId}
            />
          </Section>
        </Sections>
      </Tabs.Content>
    </Tabs>
  );
}

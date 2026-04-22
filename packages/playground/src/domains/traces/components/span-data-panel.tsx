import type { GetScorerResponse } from '@mastra/client-js';
import type { ListScoresResponse, ScoreRowData } from '@mastra/core/evals';
import { EntityType } from '@mastra/core/observability';
import type { SpanRecord } from '@mastra/core/storage';
import {
  Alert,
  AlertTitle,
  AlertDescription,
  DataKeysAndValues,
  DataPanel,
  Tabs,
  TabList,
  Tab,
  TabContent,
  ButtonsGroup,
} from '@mastra/playground-ui';
import { format } from 'date-fns';
import { BracesIcon, FileInputIcon, FileOutputIcon } from 'lucide-react';
import { useSpanDetail } from '../hooks/use-span-detail';
import { isTokenLimitExceeded, getTokenLimitMessage } from '../utils/span-utils';
import { SpanScoresList } from './span-scores-list';
import { SpanScoring } from './span-scoring';
import { SpanTokenUsage } from './span-token-usage';
import type { TokenUsage } from './span-token-usage';

function buildDialogTitle(sectionTitle: string, icon: React.ReactNode, span: { spanId: string; traceId: string }) {
  return (
    <>
      <span className="flex items-center gap-1.5 text-neutral2 uppercase tracking-widest [&>svg]:size-3.5">
        {icon}
        {sectionTitle}
      </span>
      <span>
        › Span <b className="text-neutral3">#{span.spanId}</b>
      </span>
      <span>
        › Trace <b className="text-neutral3">#{span.traceId}</b>
      </span>
    </>
  );
}

export interface SpanDataPanelProps {
  traceId: string;
  spanId: string;
  onClose: () => void;
  onPrevious?: () => void;
  onNext?: () => void;
  spanScoresData?: ListScoresResponse | null;
  onSpanScoresPageChange?: (page: number) => void;
  isLoadingSpanScoresData?: boolean;
  onScoreSelect?: (score: ScoreRowData) => void;
  scorers?: Record<string, GetScorerResponse>;
  isLoadingScorers?: boolean;
  activeTab?: string;
  onTabChange?: (tab: string) => void;
}

export function SpanDataPanel({
  traceId,
  spanId,
  onClose,
  onPrevious,
  onNext,
  spanScoresData,
  onSpanScoresPageChange,
  isLoadingSpanScoresData,
  onScoreSelect,
  scorers,
  isLoadingScorers,
  activeTab,
  onTabChange,
}: SpanDataPanelProps) {
  const { data: spanDetail, isLoading } = useSpanDetail(traceId, spanId);
  const span = spanDetail?.span;

  return (
    <DataPanel>
      <DataPanel.Header>
        <DataPanel.Heading>
          Span <b># {spanId}</b>
        </DataPanel.Heading>
        <ButtonsGroup className="ml-auto shrink-0">
          <DataPanel.NextPrevNav
            onPrevious={onPrevious}
            onNext={onNext}
            previousLabel="Previous span"
            nextLabel="Next span"
          />
          <DataPanel.CloseButton onClick={onClose} />
        </ButtonsGroup>
      </DataPanel.Header>

      {isLoading ? (
        <DataPanel.LoadingData>Loading span details...</DataPanel.LoadingData>
      ) : !span ? (
        <DataPanel.NoData>Span not found.</DataPanel.NoData>
      ) : (
        <SpanDataPanelContent
          span={span}
          traceId={traceId}
          spanId={spanId}
          spanScoresData={spanScoresData}
          onSpanScoresPageChange={onSpanScoresPageChange}
          isLoadingSpanScoresData={isLoadingSpanScoresData}
          onScoreSelect={onScoreSelect}
          scorers={scorers}
          isLoadingScorers={isLoadingScorers}
          activeTab={activeTab}
          onTabChange={onTabChange}
        />
      )}
    </DataPanel>
  );
}

function SpanDataPanelContent({
  span,
  traceId,
  spanId,
  spanScoresData,
  onSpanScoresPageChange,
  isLoadingSpanScoresData,
  onScoreSelect,
  scorers,
  isLoadingScorers,
  activeTab,
  onTabChange,
}: {
  span: SpanRecord;
  traceId: string;
  spanId: string;
  spanScoresData?: ListScoresResponse | null;
  onSpanScoresPageChange?: (page: number) => void;
  isLoadingSpanScoresData?: boolean;
  onScoreSelect?: (score: ScoreRowData) => void;
  scorers?: Record<string, GetScorerResponse>;
  isLoadingScorers?: boolean;
  activeTab?: string;
  onTabChange?: (tab: string) => void;
}) {
  const durationMs =
    span.startedAt && span.endedAt ? new Date(span.endedAt).getTime() - new Date(span.startedAt).getTime() : null;
  const usage = span.attributes?.usage as TokenUsage | undefined;

  return (
    <DataPanel.Content>
      <Tabs defaultTab="details" value={activeTab} onValueChange={onTabChange}>
        <TabList>
          <Tab value="details">Details</Tab>
          <Tab value="scoring">Scoring {spanScoresData?.pagination && `(${spanScoresData.pagination.total || 0})`}</Tab>
        </TabList>

        <TabContent value="details">
          {isTokenLimitExceeded(span) && (
            <Alert variant="warning" className="mb-3">
              <AlertTitle>Token Limit Exceeded</AlertTitle>
              <AlertDescription as="p">{getTokenLimitMessage(span)}</AlertDescription>
            </Alert>
          )}
          {usage && <SpanTokenUsage usage={usage} className="mb-3" />}

          <DataKeysAndValues numOfCol={2}>
            {span.name && (
              <>
                <DataKeysAndValues.Key>Name</DataKeysAndValues.Key>
                <DataKeysAndValues.Value className="col-span-3">{span.name}</DataKeysAndValues.Value>
              </>
            )}
            {span.spanType && (
              <>
                <DataKeysAndValues.Key>Type</DataKeysAndValues.Key>
                <DataKeysAndValues.Value>{span.spanType}</DataKeysAndValues.Value>
              </>
            )}
            {span.startedAt && (
              <>
                <DataKeysAndValues.Key>Started</DataKeysAndValues.Key>
                <DataKeysAndValues.Value>
                  {format(new Date(span.startedAt), 'MMM dd, HH:mm:ss.SSS')}
                </DataKeysAndValues.Value>
              </>
            )}
            {span.endedAt && (
              <>
                <DataKeysAndValues.Key>Ended</DataKeysAndValues.Key>
                <DataKeysAndValues.Value>
                  {format(new Date(span.endedAt), 'MMM dd, HH:mm:ss.SSS')}
                </DataKeysAndValues.Value>
              </>
            )}
            {durationMs != null && (
              <>
                <DataKeysAndValues.Key>Duration</DataKeysAndValues.Key>
                <DataKeysAndValues.Value>
                  {durationMs < 1000 ? `${durationMs}ms` : `${(durationMs / 1000).toFixed(2)}s`}
                </DataKeysAndValues.Value>
              </>
            )}
          </DataKeysAndValues>

          <div className="grid gap-3 mt-3">
            <DataPanel.CodeSection
              title="Input"
              dialogTitle={buildDialogTitle('Input', <FileInputIcon />, { spanId, traceId })}
              icon={<FileInputIcon />}
              codeStr={JSON.stringify(span.input ?? null, null, 2)}
            />
            <DataPanel.CodeSection
              title="Output"
              dialogTitle={buildDialogTitle('Output', <FileOutputIcon />, { spanId, traceId })}
              icon={<FileOutputIcon />}
              codeStr={JSON.stringify(span.output ?? null, null, 2)}
            />
            <DataPanel.CodeSection
              title="Metadata"
              dialogTitle={buildDialogTitle('Metadata', <BracesIcon />, { spanId, traceId })}
              icon={<BracesIcon />}
              codeStr={JSON.stringify(span.metadata ?? null, null, 2)}
            />
            <DataPanel.CodeSection
              title="Attributes"
              dialogTitle={buildDialogTitle('Attributes', <BracesIcon />, { spanId, traceId })}
              icon={<BracesIcon />}
              codeStr={JSON.stringify(span.attributes ?? null, null, 2)}
            />
          </div>
        </TabContent>

        <TabContent value="scoring">
          <div className="grid gap-6">
            <SpanScoring
              traceId={traceId}
              isTopLevelSpan={!Boolean(span.parentSpanId)}
              spanId={spanId}
              entityType={
                span.attributes?.agentId || span.entityType === EntityType.AGENT
                  ? 'Agent'
                  : span.attributes?.workflowId || span.entityType === EntityType.WORKFLOW_RUN
                    ? 'Workflow'
                    : undefined
              }
              scorers={scorers}
              isLoadingScorers={isLoadingScorers}
            />
            <SpanScoresList
              scoresData={spanScoresData}
              onPageChange={onSpanScoresPageChange}
              isLoadingScoresData={isLoadingSpanScoresData}
              onScoreSelect={onScoreSelect}
            />
          </div>
        </TabContent>
      </Tabs>
    </DataPanel.Content>
  );
}

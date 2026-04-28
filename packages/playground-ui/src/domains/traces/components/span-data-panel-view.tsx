import type { SpanRecord } from '@mastra/core/storage';
import { format } from 'date-fns';
import { BracesIcon, FileInputIcon, FileOutputIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { getTokenLimitMessage, isTokenLimitExceeded } from '../utils/span-utils';
import { SpanTokenUsage } from './span-token-usage';
import type { TokenUsage } from './span-token-usage';
import { Alert, AlertDescription, AlertTitle } from '@/ds/components/Alert';
import { ButtonsGroup } from '@/ds/components/ButtonsGroup';
import { DataKeysAndValues } from '@/ds/components/DataKeysAndValues';
import { DataPanel } from '@/ds/components/DataPanel';
import { Tab, TabContent, TabList, Tabs } from '@/ds/components/Tabs';

function buildDialogTitle(sectionTitle: string, icon: ReactNode, span: { spanId: string; traceId: string }) {
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

export interface SpanDataPanelViewProps {
  traceId: string;
  spanId: string;
  /** Full span record. Caller fetches via useSpanDetail. */
  span: SpanRecord | undefined;
  isLoading?: boolean;
  onClose: () => void;
  onPrevious?: () => void;
  onNext?: () => void;
  activeTab?: string;
  onTabChange?: (tab: string) => void;
  /**
   * When provided, a "Scoring" tab appears; the slot receives the loaded span and renders
   * whatever scoring UI the consumer wants. When undefined, only the "Details" tab renders.
   */
  scoringTabSlot?: (args: { span: SpanRecord; traceId: string; spanId: string }) => ReactNode;
  /** Optional count shown in the "Scoring" tab label (e.g. number of scores). */
  scoringTabBadge?: ReactNode;
  /**
   * When provided, a "Feedback" tab appears; the slot receives the loaded span and renders
   * whatever feedback UI the consumer wants.
   */
  feedbackTabSlot?: (args: { span: SpanRecord; traceId: string; spanId: string }) => ReactNode;
  /** Optional count shown in the "Feedback" tab label. */
  feedbackTabBadge?: ReactNode;
}

export function SpanDataPanelView({
  traceId,
  spanId,
  span,
  isLoading,
  onClose,
  onPrevious,
  onNext,
  activeTab,
  onTabChange,
  scoringTabSlot,
  scoringTabBadge,
  feedbackTabSlot,
  feedbackTabBadge,
}: SpanDataPanelViewProps) {
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
          activeTab={activeTab}
          onTabChange={onTabChange}
          scoringTabSlot={scoringTabSlot}
          scoringTabBadge={scoringTabBadge}
          feedbackTabSlot={feedbackTabSlot}
          feedbackTabBadge={feedbackTabBadge}
        />
      )}
    </DataPanel>
  );
}

function SpanDataPanelContent({
  span,
  traceId,
  spanId,
  activeTab,
  onTabChange,
  scoringTabSlot,
  scoringTabBadge,
  feedbackTabSlot,
  feedbackTabBadge,
}: {
  span: SpanRecord;
  traceId: string;
  spanId: string;
  activeTab?: string;
  onTabChange?: (tab: string) => void;
  scoringTabSlot?: (args: { span: SpanRecord; traceId: string; spanId: string }) => ReactNode;
  scoringTabBadge?: ReactNode;
  feedbackTabSlot?: (args: { span: SpanRecord; traceId: string; spanId: string }) => ReactNode;
  feedbackTabBadge?: ReactNode;
}) {
  const durationMs =
    span.startedAt && span.endedAt ? new Date(span.endedAt).getTime() - new Date(span.startedAt).getTime() : null;
  const usage = span.attributes?.usage as TokenUsage | undefined;

  const detailsBody = (
    <>
      {isTokenLimitExceeded(span) && (
        <Alert variant="warning" className="mb-3">
          <AlertTitle>Token Limit Exceeded</AlertTitle>
          <AlertDescription as="p">{getTokenLimitMessage(span)}</AlertDescription>
        </Alert>
      )}
      {usage && <SpanTokenUsage usage={usage} className="mb-3" />}

      <DataKeysAndValues>
        {/* Root-span only: rich trace-context fields. Live on the full SpanRecord, not on the
         *  lightweight payload, so they only have values once the full span is loaded. */}
        {span.parentSpanId == null && (
          <>
            {span.traceId && (
              <>
                <DataKeysAndValues.Key>Trace Id</DataKeysAndValues.Key>
                <DataKeysAndValues.ValueWithCopyBtn copyTooltip="Copy Trace Id to clipboard" copyValue={span.traceId}>
                  {span.traceId}
                </DataKeysAndValues.ValueWithCopyBtn>
              </>
            )}
            {span.tags && span.tags.length > 0 && (
              <>
                <DataKeysAndValues.Key>Tags</DataKeysAndValues.Key>
                <DataKeysAndValues.Value>{span.tags.join(', ')}</DataKeysAndValues.Value>
              </>
            )}
            {span.runId && (
              <>
                <DataKeysAndValues.Key>Run Id</DataKeysAndValues.Key>
                <DataKeysAndValues.ValueWithCopyBtn copyTooltip="Copy Run Id to clipboard" copyValue={span.runId}>
                  {span.runId}
                </DataKeysAndValues.ValueWithCopyBtn>
              </>
            )}
            {span.threadId && (
              <>
                <DataKeysAndValues.Key>Thread Id</DataKeysAndValues.Key>
                <DataKeysAndValues.ValueWithCopyBtn copyTooltip="Copy Thread Id to clipboard" copyValue={span.threadId}>
                  {span.threadId}
                </DataKeysAndValues.ValueWithCopyBtn>
              </>
            )}
            {span.sessionId && (
              <>
                <DataKeysAndValues.Key>Session Id</DataKeysAndValues.Key>
                <DataKeysAndValues.ValueWithCopyBtn
                  copyTooltip="Copy Session Id to clipboard"
                  copyValue={span.sessionId}
                >
                  {span.sessionId}
                </DataKeysAndValues.ValueWithCopyBtn>
              </>
            )}
            {span.requestId && (
              <>
                <DataKeysAndValues.Key>Request Id</DataKeysAndValues.Key>
                <DataKeysAndValues.ValueWithCopyBtn
                  copyTooltip="Copy Request Id to clipboard"
                  copyValue={span.requestId}
                >
                  {span.requestId}
                </DataKeysAndValues.ValueWithCopyBtn>
              </>
            )}
            {span.resourceId && (
              <>
                <DataKeysAndValues.Key>Resource Id</DataKeysAndValues.Key>
                <DataKeysAndValues.ValueWithCopyBtn
                  copyTooltip="Copy Resource Id to clipboard"
                  copyValue={span.resourceId}
                >
                  {span.resourceId}
                </DataKeysAndValues.ValueWithCopyBtn>
              </>
            )}
            {span.userId && (
              <>
                <DataKeysAndValues.Key>User Id</DataKeysAndValues.Key>
                <DataKeysAndValues.ValueWithCopyBtn copyTooltip="Copy User Id to clipboard" copyValue={span.userId}>
                  {span.userId}
                </DataKeysAndValues.ValueWithCopyBtn>
              </>
            )}
            {span.organizationId && (
              <>
                <DataKeysAndValues.Key>Organization Id</DataKeysAndValues.Key>
                <DataKeysAndValues.ValueWithCopyBtn
                  copyTooltip="Copy Organization Id to clipboard"
                  copyValue={span.organizationId}
                >
                  {span.organizationId}
                </DataKeysAndValues.ValueWithCopyBtn>
              </>
            )}
            {span.experimentId && (
              <>
                <DataKeysAndValues.Key>Experiment Id</DataKeysAndValues.Key>
                <DataKeysAndValues.ValueWithCopyBtn
                  copyTooltip="Copy Experiment Id to clipboard"
                  copyValue={span.experimentId}
                >
                  {span.experimentId}
                </DataKeysAndValues.ValueWithCopyBtn>
              </>
            )}
          </>
        )}
        {span.name && (
          <>
            <DataKeysAndValues.Key>Name</DataKeysAndValues.Key>
            <DataKeysAndValues.Value>{span.name}</DataKeysAndValues.Value>
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
            <DataKeysAndValues.Value>{format(new Date(span.endedAt), 'MMM dd, HH:mm:ss.SSS')}</DataKeysAndValues.Value>
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
    </>
  );

  // No extra tab slots → render details directly without the Tabs/TabList wrapper.
  if (!scoringTabSlot && !feedbackTabSlot) {
    return <DataPanel.Content>{detailsBody}</DataPanel.Content>;
  }

  return (
    <DataPanel.Content>
      <Tabs defaultTab="details" value={activeTab} onValueChange={onTabChange}>
        <TabList>
          <Tab value="details">Details</Tab>
          {scoringTabSlot && <Tab value="scoring">Scoring {scoringTabBadge != null && <>({scoringTabBadge})</>}</Tab>}
          {feedbackTabSlot && (
            <Tab value="feedback">Feedback {feedbackTabBadge != null && <>({feedbackTabBadge})</>}</Tab>
          )}
        </TabList>

        <TabContent value="details">{detailsBody}</TabContent>
        {scoringTabSlot && <TabContent value="scoring">{scoringTabSlot({ span, traceId, spanId })}</TabContent>}
        {feedbackTabSlot && <TabContent value="feedback">{feedbackTabSlot({ span, traceId, spanId })}</TabContent>}
      </Tabs>
    </DataPanel.Content>
  );
}

import type { SpanRecord } from '@mastra/core/storage';
import { BracesIcon, FileInputIcon, FileOutputIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { getTokenLimitMessage, isTokenLimitExceeded } from '../utils/span-utils';
import { SpanSummaryDescription } from './span-summary-description';
import { SpanTokenUsage } from './span-token-usage';
import type { TokenUsage } from './span-token-usage';
import { TraceIdButton } from './trace-id-button';
import { ButtonsGroup } from '@/ds/components/ButtonsGroup';
import { DataKeysAndValues } from '@/ds/components/DataKeysAndValues';
import { DataPanel } from '@/ds/components/DataPanel';
import { Notice } from '@/ds/components/Notice';
import { Tab, TabContent, TabList, Tabs } from '@/ds/components/Tabs';

function buildDialogTitle(sectionTitle: string, icon: ReactNode, span: { spanId: string; traceId: string }) {
  return (
    <>
      <span className="text-neutral2 flex items-center gap-1.5 tracking-widest uppercase [&>svg]:size-3.5">
        {icon}
        {sectionTitle}
      </span>
      <span>
        › Span <b className="text-neutral3">{span.spanId}</b>
      </span>
      <span>
        › Trace <b className="text-neutral3">{span.traceId}</b>
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
   * When provided, a "Feedback" tab appears; the slot receives the loaded span and renders
   * whatever feedback UI the consumer wants.
   */
  feedbackTabSlot?: (args: { span: SpanRecord; traceId: string; spanId: string }) => ReactNode;
  /** Optional indicator rendered after the "Feedback" tab label (e.g. a needs-review dot). */
  feedbackTabBadge?: ReactNode;
  /**
   * Whether this span is the displayed root of the current view (trace root or
   * branch anchor). Controls visibility of trace-level metadata fields. Defaults
   * to `span.parentSpanId == null` (trace case) when omitted.
   */
  isAnchor?: boolean;
  /** Extra classes for the panel root (e.g. flattening the card when nested in the trace panel). */
  className?: string;
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
  feedbackTabSlot,
  feedbackTabBadge,
  isAnchor,
  className,
}: SpanDataPanelViewProps) {
  return (
    <DataPanel className={className}>
      {/* Two-line header (heading + summary); neighbouring panel headers use min-h-16 to stay level. */}
      <DataPanel.Header className="min-h-16 py-2">
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <DataPanel.Heading className="items-center whitespace-nowrap">
            Span
            <TraceIdButton id={spanId} />
          </DataPanel.Heading>
          {span && <SpanSummaryDescription span={span} />}
        </div>
        <ButtonsGroup className="ml-auto shrink-0 self-start">
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
          feedbackTabSlot={feedbackTabSlot}
          feedbackTabBadge={feedbackTabBadge}
          isAnchor={isAnchor}
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
  feedbackTabSlot,
  feedbackTabBadge,
  isAnchor,
}: {
  span: SpanRecord;
  traceId: string;
  spanId: string;
  activeTab?: string;
  onTabChange?: (tab: string) => void;
  feedbackTabSlot?: (args: { span: SpanRecord; traceId: string; spanId: string }) => ReactNode;
  feedbackTabBadge?: ReactNode;
  isAnchor?: boolean;
}) {
  const usage = span.attributes?.usage as TokenUsage | undefined;

  const detailsBody = (
    <>
      {isTokenLimitExceeded(span) && (
        <div className="mb-3">
          <Notice variant="warning" title="Token Limit Exceeded">
            <Notice.Message>{getTokenLimitMessage(span)}</Notice.Message>
          </Notice>
        </div>
      )}

      {usage && <SpanTokenUsage usage={usage} className="mb-3" />}

      <DataKeysAndValues>
        {/* Anchor-only: rich trace-context fields. Live on the full SpanRecord, not on the
         *  lightweight payload, so they only have values once the full span is loaded. */}
        {(isAnchor ?? span.parentSpanId == null) && (
          <>
            {span.tags && span.tags.length > 0 && (
              <>
                <DataKeysAndValues.Key>Tags</DataKeysAndValues.Key>
                <DataKeysAndValues.Value>{span.tags.join(', ')}</DataKeysAndValues.Value>
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
      </DataKeysAndValues>

      <div className="mt-3 grid gap-3">
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
  if (!feedbackTabSlot) {
    return <DataPanel.Content>{detailsBody}</DataPanel.Content>;
  }

  return (
    <DataPanel.Content>
      <Tabs defaultTab="details" value={activeTab} onValueChange={onTabChange}>
        <TabList variant="pill-ghost" className="px-0">
          <Tab value="details">Details</Tab>
          <Tab value="feedback">Feedback{feedbackTabBadge}</Tab>
        </TabList>

        <TabContent value="details">{detailsBody}</TabContent>
        <TabContent value="feedback">{feedbackTabSlot({ span, traceId, spanId })}</TabContent>
      </Tabs>
    </DataPanel.Content>
  );
}

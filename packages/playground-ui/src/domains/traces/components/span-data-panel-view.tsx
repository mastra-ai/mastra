import { ArrowLeftRightIcon, BracesIcon, ExternalLinkIcon, FileInputIcon, FileOutputIcon } from 'lucide-react';
import { Fragment } from 'react';
import type { ReactNode } from 'react';
import type { SpanRecord } from '../types';
import { getTokenLimitMessage, isTokenLimitExceeded } from '../utils/span-utils';
import { SpanOutcomeSummary } from './span-outcome';
import { getSpanChanges, getSpanOutcome } from './span-outcome.utils';
import {
  SpanErrorDetails,
  SpanErrorRenderer,
  SpanInputRenderer,
  getSpanOutputPayload,
  hasSpanInputPreview,
  hasSpanOutputPreview,
  SpanOutputRenderer,
  SpanPayloadSection,
  SpanPayloadJsonSection,
  SpanProcessorAttributes,
  SpanProcessorMutations,
} from './span-payload';
import { SpanAvailableToolsSection, SpanToolCallsSection, SpanToolsSection } from './span-payload/span-tools-section';
import { SpanRunId, SpanSummaryDescription } from './span-summary-description';
import { SpanModelSummary } from './span-token-usage';
import { TraceIdButton } from './trace-id-button';
import { Button } from '@/ds/components/Button';
import { DataKeysAndValues } from '@/ds/components/DataKeysAndValues';
import { DataPanel } from '@/ds/components/DataPanel';
import { Notice } from '@/ds/components/Notice';
import { Tab, TabContent, TabList, Tabs } from '@/ds/components/Tabs';
import { cn } from '@/lib/utils';

// Mirrors `DataPanel.Content` padding without requiring the Drawer root (this view also renders standalone).
const BODY_CLASS = 'min-h-0 flex-1 overflow-y-auto p-2';

type SpanSection = 'error' | 'changes' | 'output' | 'input' | 'tools' | 'metadata' | 'attributes';
// Every span reads the same way: how it failed, what it changed, what it received, what it returned,
// then the rest, with the raw metadata and attributes last.
const LEAD: SpanSection[] = ['error', 'changes', 'input', 'output'];
const REST: SpanSection[] = ['tools', 'metadata', 'attributes'];

export interface SpanDataPanelViewProps {
  traceId: string;
  spanId: string;
  /** Full span record. Caller fetches via useSpanDetail. */
  span: SpanRecord | undefined;
  isLoading?: boolean;
  /** Previous/next buttons show only when one is provided; omit both where a span tree already navigates. */
  onPrevious?: () => void;
  onNext?: () => void;
  /** When provided, an × button in the header closes the span column. */
  onClose?: () => void;
  /**
   * When provided, a "Go to trace" button in the header calls it with the span's ids.
   * The caller decides where the trace opens (e.g. its own traces route).
   */
  onShowTrace?: (span: { traceId: string; spanId: string }) => void;
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
  onPrevious,
  onNext,
  onClose,
  onShowTrace,
  activeTab,
  onTabChange,
  feedbackTabSlot,
  feedbackTabBadge,
  isAnchor,
  className,
}: SpanDataPanelViewProps) {
  // Not a DataPanel: this is the span column rendered inside `TraceDataPanelView`,
  // which already provides the panel chrome.
  return (
    <section className={cn('flex min-h-0 flex-1 flex-col overflow-hidden', className)}>
      <DataPanel.Header>
        <DataPanel.HeaderContent>
          <DataPanel.Heading>
            Span
            <TraceIdButton id={spanId} maxLength={6} ellipsis={false} />
          </DataPanel.Heading>
          {span?.runId && <SpanRunId runId={span.runId} />}
          {span && <SpanSummaryDescription span={span} />}
        </DataPanel.HeaderContent>
        <DataPanel.HeaderActions>
          {onShowTrace && (
            <Button
              size="icon-sm"
              variant="ghost"
              aria-label="Go to trace"
              tooltip="Go to trace"
              className="shrink-0"
              onClick={() => onShowTrace({ traceId, spanId })}
            >
              <ExternalLinkIcon />
            </Button>
          )}
          {(onPrevious || onNext) && (
            <DataPanel.NextPrevNav
              onPrevious={onPrevious}
              onNext={onNext}
              previousLabel="Go to previous span"
              nextLabel="Go to next span"
            />
          )}
          {onClose && <DataPanel.CloseButton icon="x" onClick={onClose} label="Close span" tooltip="Close span" />}
        </DataPanel.HeaderActions>
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
    </section>
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
  const isRoot = isAnchor ?? span.parentSpanId == null;
  const hasContext =
    isRoot &&
    Boolean(
      span.tags?.length || span.sessionId || span.requestId || span.userId || span.organizationId || span.experimentId,
    );
  const outcome = getSpanOutcome(span);
  // The root span's input and output already tell its story; only a failed or stopped run needs a summary on top.
  const showOutcome = outcome != null && (!isRoot || outcome.tone === 'error' || outcome.tone === 'warning');
  const outputPayload = getSpanOutputPayload(span);
  const evidence = outcome?.evidence === 'output' && outputPayload == null ? undefined : outcome?.evidence;
  const toolCallsInOutcome = showOutcome && evidence === 'toolCalls';
  const changesInOutcome = showOutcome && evidence === 'changes';
  const errorInOutcome = showOutcome && evidence === 'error';
  const changes = getSpanChanges(span);

  const sections: Record<SpanSection, ReactNode> = {
    // A failed span says so in the summary on top, with its error; only spans with no summary need the section.
    error: span.error != null && !errorInOutcome && (
      <SpanPayloadSection title="Error" raw={span.error} framed={false}>
        <SpanErrorRenderer span={span} />
      </SpanPayloadSection>
    ),
    // A failed or stopped processor still shows what it changed before it stopped.
    changes: changes.length > 0 && !changesInOutcome && (
      <SpanPayloadSection
        title="Changes"
        icon={<ArrowLeftRightIcon />}
        raw={changes}
        hasPreview
        emphasis={evidence === 'changes'}
      >
        <SpanProcessorMutations span={span} />
      </SpanPayloadSection>
    ),
    output: (
      <SpanPayloadSection
        title="Output"
        icon={<FileOutputIcon />}
        raw={outputPayload}
        hasPreview={hasSpanOutputPreview(span)}
      >
        <SpanOutputRenderer span={span} />
      </SpanPayloadSection>
    ),
    input: (
      <SpanPayloadSection
        title="Input"
        icon={<FileInputIcon />}
        raw={span.input}
        hasPreview={hasSpanInputPreview(span)}
      >
        <SpanInputRenderer span={span} />
      </SpanPayloadSection>
    ),
    // The tool calls already sit in the summary; the tools the model could pick from still read here.
    tools: toolCallsInOutcome ? <SpanAvailableToolsSection span={span} /> : <SpanToolsSection span={span} />,
    metadata: <SpanPayloadJsonSection title="Metadata" icon={<BracesIcon />} raw={span.metadata} />,
    attributes: <SpanPayloadJsonSection title="Attributes" icon={<BracesIcon />} raw={span.attributes} />,
  };

  const detailsBody = (
    <>
      {showOutcome && (
        <SpanOutcomeSummary
          outcome={outcome}
          showDetail={!evidence}
          className="mb-3"
          // The error, changes or tool calls prove the headline, so they sit in the notice under it rather than in a section of their own.
          renderProof={
            errorInOutcome
              ? headline => (
                  <SpanPayloadSection title="Error" heading={headline} raw={span.error} framed={false} clip={false}>
                    <SpanErrorDetails span={span} />
                  </SpanPayloadSection>
                )
              : changesInOutcome
                ? headline => (
                    <SpanPayloadSection title="Changes" heading={headline} raw={changes} hasPreview>
                      <SpanProcessorMutations span={span} />
                    </SpanPayloadSection>
                  )
                : toolCallsInOutcome
                  ? headline => <SpanToolCallsSection span={span} heading={headline} />
                  : undefined
          }
        />
      )}

      {isTokenLimitExceeded(span) && (
        <div className="mb-3">
          <Notice variant="warning" title="Token Limit Exceeded">
            <Notice.Message>{getTokenLimitMessage(span)}</Notice.Message>
          </Notice>
        </div>
      )}

      <SpanModelSummary span={span} className="mb-4" />
      <SpanProcessorAttributes span={span} className="mb-4" />

      <div className="grid gap-4">
        {LEAD.map(section => (
          <Fragment key={section}>{sections[section]}</Fragment>
        ))}
        {hasContext && (
          <DataKeysAndValues>
            {/* Anchor-only: rich trace-context fields. Live on the full SpanRecord, not on the
             *  lightweight payload, so they only have values once the full span is loaded. */}
            {isRoot && (
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
        )}
        {REST.map(section => (
          <Fragment key={section}>{sections[section]}</Fragment>
        ))}
      </div>
    </>
  );

  // No extra tab slots → render details directly without the Tabs/TabList wrapper.
  if (!feedbackTabSlot) {
    return <div className={BODY_CLASS}>{detailsBody}</div>;
  }

  // Same chrome as the trace column: tab list in a header row, content scrolling beneath it.
  return (
    <Tabs
      defaultTab="details"
      value={activeTab}
      onValueChange={onTabChange}
      className="grid min-h-0 flex-1 grid-rows-[auto_1fr]"
    >
      <DataPanel.Header>
        <TabList variant="pill-ghost" size="sm">
          <Tab value="details">Details</Tab>
          <Tab value="feedback">Feedback{feedbackTabBadge != null && <> ({feedbackTabBadge})</>}</Tab>
        </TabList>
      </DataPanel.Header>

      <TabContent value="details" flush>
        <div className={BODY_CLASS}>{detailsBody}</div>
      </TabContent>
      <TabContent value="feedback" flush>
        <div className={BODY_CLASS}>{feedbackTabSlot({ span, traceId, spanId })}</div>
      </TabContent>
    </Tabs>
  );
}

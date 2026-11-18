import { describeProcessorPipeline, describeSpanInput } from '@mastra/core/observability';
import type { UsageStats } from '@mastra/core/observability';
import type { ReactNode } from 'react';
import type { SpanRecord, TraceSpanRecord } from '../../types';
import { getSpanSignal } from '../../utils/span-signal';
import { getSpanDurationMs, getTokenLimitMessage, isTokenLimitExceeded } from '../../utils/span-utils';
import { formatSpanToolCallMessages } from '../format-trace-thread-messages';
import { getSpanTypeUi } from '../shared';
import { SpanOutcomeSummary } from '../span-outcome';
import { getSpanOutcome } from '../span-outcome.utils';
import {
  SpanErrorDetails,
  SpanInputRenderer,
  SpanOutputRenderer,
  SpanPayloadJson,
  SpanPayloadProcessor,
  getSpanOutputPayload,
  hasSpanInputPreview,
  hasSpanOutputPreview,
} from '../span-payload';
import { asCoreSpan, getSpanTools } from '../span-payload/span-payload-registry';
import { SpanToolCallList, SpanToolList } from '../span-payload/span-tools-section';
import type { RegisteredTools } from '../span-payload/span-tools-section';
import { SpanPromptChanges } from '../span-prompt-changes';
import { getPromptChanges, runsAfterModel } from '../span-prompt-impact';
import { SpanTokenUsage } from '../span-token-usage';
import { getModelFacts, getTokenUsageRows } from '../span-token-usage.utils';
import { SpanTypeBadge } from '../span-type-badge';
import type { TraceToolCallsProps } from '../trace-tool-calls';
import { useSpanDataPanel } from './span-data-panel-context';
import type { PayloadView } from './span-data-panel-context';
import { getSpanTitle } from './span-data-panel-title';
import { ProviderLogo } from '@/domains/llm';
import { Badge } from '@/ds/components/Badge';
import { Button } from '@/ds/components/Button';
import { CopyButton } from '@/ds/components/CopyButton';
import { DataKeysAndValues } from '@/ds/components/DataKeysAndValues';
import { DataPanel } from '@/ds/components/DataPanel';
import { Notice } from '@/ds/components/Notice';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/ds/components/Tooltip';
import { Txt } from '@/ds/components/Txt';
import { IconCircleX } from '@/ds/icons/central/IconCircleX';
import { IconCodeBrackets } from '@/ds/icons/central/IconCodeBrackets';
import { IconEyeOpen } from '@/ds/icons/central/IconEyeOpen';
import { IconSquareArrowTopRight } from '@/ds/icons/central/IconSquareArrowTopRight';
import { formatTimestampPrecise } from '@/utils/date-format';
import { formatDuration, formatDurationPrecise } from '@/utils/duration';

/* ------------------------------------------------------------------------------------------------
 * Header parts
 * ---------------------------------------------------------------------------------------------- */

export interface SpanDataPanelHeaderProps {
  /** On the left, typically `SpanDataPanel.Identity`. */
  identity?: ReactNode;
  /** On the right, e.g. `SpanDataPanel.ShowTraceButton`, `SpanDataPanel.Navigation`, `SpanDataPanel.CloseButton`. */
  actions?: ReactNode;
}

/** The header row: what the span is on the left, its controls on the right. */
export function SpanDataPanelHeader({ identity, actions }: SpanDataPanelHeaderProps) {
  return (
    <DataPanel.Header className="flex-nowrap">
      {identity}
      {actions && <DataPanel.HeaderActions>{actions}</DataPanel.HeaderActions>}
    </DataPanel.Header>
  );
}

/**
 * What ran and how long it took, on one row. Only the unusual is called out: a failure, a span still
 * running, or a processor that had to retry. Before the record arrives, it just says "Span".
 */
export function SpanDataPanelIdentity() {
  const { span } = useSpanDataPanel();
  if (!span) {
    return (
      <DataPanel.HeaderContent>
        <DataPanel.Heading>Span</DataPanel.Heading>
      </DataPanel.HeaderContent>
    );
  }
  return <SpanIdentity span={span} />;
}

export interface SpanDataPanelShowTraceButtonProps {
  /** Opens the span's trace; the host decides where (e.g. its own traces route). */
  onShowTrace: (span: { traceId: string; spanId: string }) => void;
}

export function SpanDataPanelShowTraceButton({ onShowTrace }: SpanDataPanelShowTraceButtonProps) {
  const { traceId, spanId } = useSpanDataPanel();
  return (
    <Button
      size="icon-sm"
      variant="ghost"
      aria-label="Go to trace"
      tooltip="Go to trace"
      className="shrink-0"
      onClick={() => onShowTrace({ traceId, spanId })}
    >
      <IconSquareArrowTopRight />
    </Button>
  );
}

export interface SpanDataPanelNavigationProps {
  onPrevious?: () => void;
  onNext?: () => void;
}

/** Steps to the previous or next span of the host's list; renders nothing without either. */
export function SpanDataPanelNavigation({ onPrevious, onNext }: SpanDataPanelNavigationProps) {
  if (!onPrevious && !onNext) return null;
  return (
    <DataPanel.NextPrevNav
      onPrevious={onPrevious}
      onNext={onNext}
      previousLabel="Go to previous span"
      nextLabel="Go to next span"
    />
  );
}

export function SpanDataPanelCloseButton({ onClose }: { onClose: () => void }) {
  return <DataPanel.CloseButton icon="x" onClick={onClose} label="Close span" tooltip="Close span" />;
}

/* ------------------------------------------------------------------------------------------------
 * Tab parts
 * ---------------------------------------------------------------------------------------------- */

/** The Details tab: prompt changes, model, token usage, timing, ids, metadata and attributes. */
export function SpanDataPanelDetails() {
  const { traceId, span } = useSpanDataPanel();
  if (!span) return null;
  return <DetailsTab traceId={traceId} span={span} />;
}

export interface SpanDataPanelInputProps {
  /** The tool registry (`listTools`), so the tools the span offered link to their pages. */
  registeredTools?: RegisteredTools;
}

/** The Input tab: what the span was given, previewed or as JSON, and the tools it offered. */
export function SpanDataPanelInput({ registeredTools }: SpanDataPanelInputProps) {
  const { span, view, setView } = useSpanDataPanel();
  if (!span) return null;
  return <InputTab span={span} view={view} onViewChange={setView} registeredTools={registeredTools} />;
}

export interface SpanDataPanelOutputProps extends TraceToolCallsProps {
  /**
   * Every span of the trace with its payload (`getTrace`): each tool call the span requested is paired
   * with the result its tool span recorded. Without it, the calls show no result.
   */
  traceSpans?: TraceSpanRecord[];
}

/** The Output tab: why it failed or stopped, what it produced, and the tools it called. */
export function SpanDataPanelOutput({ traceSpans, mcpAppTools, renderToolCall }: SpanDataPanelOutputProps) {
  const { span, view, setView } = useSpanDataPanel();
  if (!span) return null;
  return (
    <OutputTab
      span={span}
      view={view}
      onViewChange={setView}
      traceSpans={traceSpans}
      mcpAppTools={mcpAppTools}
      renderToolCall={renderToolCall}
    />
  );
}

/* ------------------------------------------------------------------------------------------------
 * Rendering
 * ---------------------------------------------------------------------------------------------- */

function getProcessorInput(span: SpanRecord) {
  if (getSpanSignal(span)) return undefined;
  const input = describeSpanInput(asCoreSpan(span));
  return input?.type === 'processor' ? input.value : undefined;
}

/** How many times a processor re-ran this step. Zero, the normal case, is not worth showing. */
function getRetryCount(span: SpanRecord) {
  const data: Record<string, unknown> = getProcessorInput(span)?.data ?? {};
  const retryCount = data.retryCount;
  return typeof retryCount === 'number' && retryCount > 0 ? retryCount : 0;
}

/**
 * What ran and how long it took, on one row. Only the unusual is called out: a failure, a span still
 * running, or a processor that had to retry. A normal success says nothing extra.
 */
function SpanIdentity({ span }: { span: SpanRecord }) {
  const durationMs = getSpanDurationMs(span.startedAt, span.endedAt);
  const retries = getRetryCount(span);

  return (
    <div className="flex min-w-0 flex-1 items-center gap-2 pl-1">
      {/* Same type mark as the span's row in the trace tree, processors included. */}
      <SpanTypeBadge type={span.spanType ?? ''} spanUI={getSpanTypeUi(span.spanType ?? '')} />
      <Tooltip>
        <TooltipTrigger
          render={
            <Txt as="h2" variant="card-title-strong" className="min-w-0 truncate">
              {getSpanTitle(span)}
            </Txt>
          }
        />
        <TooltipContent>{span.name}</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger
          render={
            <Txt as="span" variant="body-sm" tone="muted" className="shrink-0 cursor-help tabular-nums" tabIndex={0}>
              {durationMs == null ? 'Running' : formatDuration(durationMs)}
            </Txt>
          }
        />
        <TooltipContent>
          {durationMs == null ? 'Still running' : `Duration ${formatDurationPrecise(durationMs)}`}
        </TooltipContent>
      </Tooltip>
      {span.error != null && (
        <Badge size="xs" variant="destructive" className="shrink-0">
          Failed
        </Badge>
      )}
      {retries > 0 && (
        <Badge size="xs" variant="warning" className="shrink-0 tabular-nums">
          {retries === 1 ? 'Retried once' : `Retried ${retries}×`}
        </Badge>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------------------------------------
 * Tab bodies
 * ---------------------------------------------------------------------------------------------- */

type PayloadTabProps = { span: SpanRecord; view: PayloadView; onViewChange: (view: PayloadView) => void };

/**
 * Processor input keys the preview leaves out: tools have their own section, retries are a header badge,
 * and the step number repeats the `step › N` parent the span sits under in the tree.
 */
const PROCESSOR_INPUT_HIDDEN = ['tools', 'toolChoice', 'retryCount', 'stepNumber'];

function InputTab({
  span,
  view,
  onViewChange,
  registeredTools,
}: PayloadTabProps & { registeredTools?: RegisteredTools }) {
  const tools = getSpanTools(span);
  const processorInput = getProcessorInput(span);
  return (
    <Stack>
      <Payload
        label="Input"
        raw={span.input}
        hasPreview={hasSpanInputPreview(span, PROCESSOR_INPUT_HIDDEN)}
        view={view}
        onViewChange={onViewChange}
        empty="No input recorded."
      >
        {processorInput ? (
          <SpanPayloadProcessor value={processorInput} hidden={PROCESSOR_INPUT_HIDDEN} />
        ) : (
          <SpanInputRenderer span={span} />
        )}
      </Payload>
      {tools && (
        <Section title="Available tools" count={tools.tools.length}>
          <SpanToolList tools={tools.tools} registeredTools={registeredTools} />
        </Section>
      )}
    </Stack>
  );
}

function OutputTab({
  span,
  view,
  onViewChange,
  traceSpans,
  ...toolCallsProps
}: PayloadTabProps & SpanDataPanelOutputProps) {
  const output = getSpanOutputPayload(span);
  return (
    <Stack>
      <SpanProblem span={span} />
      {isTokenLimitExceeded(span) && (
        <Notice variant="warning" title="Token Limit Exceeded">
          <Notice.Message>{getTokenLimitMessage(span)}</Notice.Message>
        </Notice>
      )}
      {(output != null || span.error == null) && (
        <Payload
          label="Output"
          raw={output}
          hasPreview={hasSpanOutputPreview(span)}
          view={view}
          onViewChange={onViewChange}
          empty="No output recorded."
        >
          <SpanOutputRenderer span={span} />
        </Payload>
      )}
      <ToolCalls span={span} traceSpans={traceSpans} {...toolCallsProps} />
    </Stack>
  );
}

/** Everything looked up rather than read, grouped the same way for every span type. */
function DetailsTab({ traceId, span }: { traceId: string; span: SpanRecord }) {
  const { finishReason, firstToken, speed, ...facts } = getModelFacts(span);
  // Agent runs and model steps record the model they ran natively, not only model-call spans.
  const model = span.model || facts.model;
  const provider = span.provider || facts.provider;
  // oxlint-disable-next-line typescript/no-unnecessary-type-assertion -- Built SDK declarations type attributes.usage as unknown.
  const usage = span.attributes?.usage as UsageStats | undefined;
  const hasModel = Boolean(model || provider || finishReason || firstToken || speed);
  const durationMs = getSpanDurationMs(span.startedAt, span.endedAt);
  const ids: Array<[string, string | null | undefined]> = [
    ['Span', span.spanId],
    ['Trace', traceId],
    ['Parent span', span.parentSpanId],
    ['Run', span.runId],
    ['Session', span.sessionId],
    ['Thread', span.threadId],
    ['Request', span.requestId],
    ['User', span.userId],
    ['Organization', span.organizationId],
    ['Experiment', span.experimentId],
  ];

  return (
    <Stack>
      <PromptSection span={span} />

      {hasModel && (
        <Section title="Model">
          <DataKeysAndValues>
            {model && (
              <Row label="Model">
                <span className="inline-flex min-w-0 items-center gap-1.5">
                  {provider && <ProviderLogo providerId={provider} size="xs" />}
                  <span className="truncate">{model}</span>
                </span>
              </Row>
            )}
            {provider && <Row label="Provider">{provider}</Row>}
            {finishReason && <Row label="Finish reason">{finishReason}</Row>}
            {firstToken && <Row label="First token">{firstToken}</Row>}
            {speed && <Row label="Speed">{speed}</Row>}
          </DataKeysAndValues>
        </Section>
      )}

      {usage && getTokenUsageRows(usage) && (
        <Section title="Token usage">
          <SpanTokenUsage usage={usage} />
        </Section>
      )}

      <Section title="Timing">
        <DataKeysAndValues>
          <Row label="Started">{formatTimestampPrecise(span.startedAt)}</Row>
          {span.endedAt && <Row label="Ended">{formatTimestampPrecise(span.endedAt)}</Row>}
          {durationMs != null && <Row label="Duration">{formatDurationPrecise(durationMs)}</Row>}
          {span.timeToFirstChunkMs != null && (
            <Row label="Time to first chunk">{formatDurationPrecise(span.timeToFirstChunkMs)}</Row>
          )}
          {span.timeToFirstTokenMs != null && (
            <Row label="Time to first token">{formatDurationPrecise(span.timeToFirstTokenMs)}</Row>
          )}
        </DataKeysAndValues>
      </Section>

      <Section title="Identifiers">
        <DataKeysAndValues>
          {ids.map(([label, value]) => (value ? <IdRow key={label} label={label} value={value} /> : null))}
          {span.tags && span.tags.length > 0 && (
            <Row label="Tags">
              <span className="flex flex-wrap gap-1">
                {span.tags.map(tag => (
                  <Badge key={tag} size="xs" variant="neutral" emphasis="subtle">
                    {tag}
                  </Badge>
                ))}
              </span>
            </Row>
          )}
        </DataKeysAndValues>
      </Section>

      <JsonSection title="Metadata" value={span.metadata} />
      <JsonSection title="Attributes" value={span.attributes} />
    </Stack>
  );
}

/**
 * What this span changed in the request, from its own recorded changes, as diff cards. Changes made
 * after the model answered get a short note: they can't have shaped this request. Nothing is shown
 * when the span changed nothing.
 */
function PromptSection({ span }: { span: SpanRecord }) {
  if (getPromptChanges(span).length === 0) return null;

  return (
    <Section title="Prompt">
      {runsAfterModel(span) && (
        <Txt as="p" variant="body-sm" tone="muted">
          Ran after the model answered: its changes are kept for later turns and could not shape this request.
        </Txt>
      )}
      <SpanPromptChanges span={span} />
    </Section>
  );
}

/** Why the span failed or stopped, above whatever output it still produced. */
function SpanProblem({ span }: { span: SpanRecord }) {
  const outcome = getSpanOutcome(span);
  if (outcome?.tone !== 'error' && outcome?.tone !== 'warning') return null;
  if (span.error != null) {
    return (
      <Notice variant="destructive" icon={<IconCircleX />} title={<h3>{outcome.headline}</h3>}>
        <SpanErrorDetails span={span} />
      </Notice>
    );
  }
  // A tripwire leaves no error: its reason is the only account of why the run stopped.
  const tripwire = describeProcessorPipeline(asCoreSpan(span))?.tripwireAbort;
  if (!tripwire) return <SpanOutcomeSummary outcome={outcome} showDetail />;
  return (
    <Notice variant="destructive" icon={<IconCircleX />} title={<h3>{outcome.headline}</h3>}>
      {tripwire.reason && <p className="break-words whitespace-pre-wrap">{tripwire.reason}</p>}
      {tripwire.retry !== undefined && (
        <Txt as="p" variant="body-sm" tone="muted">
          {tripwire.retry ? 'The model was asked to retry.' : 'Not retried.'}
        </Txt>
      )}
    </Notice>
  );
}

function ToolCalls({
  span,
  traceSpans = [],
  ...toolCallsProps
}: { span: SpanRecord; traceSpans?: TraceSpanRecord[] } & TraceToolCallsProps) {
  const toolCalls = formatSpanToolCallMessages(span, traceSpans);
  if (toolCalls.length === 0) return null;
  return (
    <Section title="Tool calls" count={toolCalls.length}>
      <SpanToolCallList toolCalls={toolCalls} {...toolCallsProps} />
    </Section>
  );
}

/* ------------------------------------------------------------------------------------------------
 * Building blocks
 * ---------------------------------------------------------------------------------------------- */

function Stack({ children }: { children: ReactNode }) {
  return <div className="grid min-w-0 content-start gap-4">{children}</div>;
}

/**
 * A hairline and a small heading between groups, instead of a titled card around each one.
 * The hairline runs edge to edge: it bleeds through the body padding.
 */
function Section({
  title,
  label = title,
  count,
  children,
}: {
  title?: string;
  /** Names the region for assistive tech when the heading is rendered by the children. */
  label?: string;
  count?: number;
  children: ReactNode;
}) {
  return (
    <section
      aria-label={label}
      className="-mx-3 grid min-w-0 gap-3 border-t border-surface-rim px-3 pt-4 first:border-t-0 first:pt-0"
    >
      {title && (
        <DataPanel.SectionHeading>
          {title}
          {count != null && <span className="tabular-nums">{count}</span>}
        </DataPanel.SectionHeading>
      )}
      {children}
    </section>
  );
}

/**
 * Stored JSON that is rarely why someone opened the span. The heading always shows; the block opens
 * folded on its root, and unfolding it shows the top-level keys with their values still folded, so it
 * collapses through the code block's own fold markers instead of a second disclosure around it.
 */
function JsonSection({ title, value }: { title: string; value: unknown }) {
  if (value == null || (typeof value === 'object' && Object.keys(value).length === 0)) return null;
  return (
    <Section label={title}>
      <div className="flex min-w-0 items-center justify-between gap-2">
        <DataPanel.SectionHeading>{title}</DataPanel.SectionHeading>
        <CopyButton
          content={JSON.stringify(value, null, 2)}
          copyMessage={`${title} copied`}
          tooltip={`Copy ${title.toLowerCase()} as JSON`}
          variant="ghost"
        />
      </div>
      <SpanPayloadJson value={value} foldRoot foldNested />
    </Section>
  );
}

/**
 * The payload, unframed. Its Preview/JSON switch and copy sit on a small toolbar inside the tab,
 * right above what they act on, so the tab bar stays the same for every tab.
 */
function Payload({
  label,
  raw,
  hasPreview,
  view,
  onViewChange,
  empty,
  children,
}: {
  label: string;
  raw: unknown;
  hasPreview: boolean;
  view: PayloadView;
  onViewChange: (view: PayloadView) => void;
  empty: string;
  children: ReactNode;
}) {
  if (raw == null) {
    return (
      <Txt variant="body-sm" tone="muted">
        {empty}
      </Txt>
    );
  }
  const shown = hasPreview ? view : 'raw';
  return (
    <div role="group" aria-label={label} data-view={shown} className="grid min-w-0 gap-3">
      <div className="flex items-center justify-end gap-1">
        {hasPreview && (
          <Button
            variant="ghost"
            size="icon-sm"
            aria-pressed={view === 'raw'}
            tooltip={view === 'raw' ? `Show ${label.toLowerCase()} preview` : `Show ${label.toLowerCase()} as JSON`}
            onClick={() => onViewChange(view === 'raw' ? 'rich' : 'raw')}
          >
            {view === 'raw' ? <IconEyeOpen /> : <IconCodeBrackets />}
          </Button>
        )}
        <CopyButton
          content={JSON.stringify(raw, null, 2)}
          copyMessage={`${label} copied`}
          tooltip={`Copy ${label.toLowerCase()} as JSON`}
          variant="ghost"
        />
      </div>
      <div className="min-w-0 [&_[data-slot=message]]:my-0">
        {shown === 'rich' ? children : <SpanPayloadJson value={raw} foldNested />}
      </div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <>
      <DataKeysAndValues.Key>{label}</DataKeysAndValues.Key>
      <DataKeysAndValues.Value>{children}</DataKeysAndValues.Value>
    </>
  );
}

function IdRow({ label, value }: { label: string; value: string }) {
  return (
    <>
      <DataKeysAndValues.Key>{label}</DataKeysAndValues.Key>
      <DataKeysAndValues.ValueWithCopyBtn copyTooltip={`Copy ${label} id`} copyValue={value}>
        {value}
      </DataKeysAndValues.ValueWithCopyBtn>
    </>
  );
}

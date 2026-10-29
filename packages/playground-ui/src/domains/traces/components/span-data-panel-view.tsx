import { describeProcessorPipeline, describeSpanInput } from '@mastra/core/observability';
import type { UsageStats } from '@mastra/core/observability';
import {
  BracesIcon,
  CircleXIcon,
  ExternalLinkIcon,
  EyeIcon,
  FileInputIcon,
  FileOutputIcon,
  InfoIcon,
  MessageSquareReplyIcon,
} from 'lucide-react';
import { useId, useState } from 'react';
import type { ReactNode } from 'react';
import type { SpanRecord, SpanTab } from '../types';
import { getSpanSignal } from '../utils/span-signal';
import { getSpanDurationMs, getTokenLimitMessage, isTokenLimitExceeded } from '../utils/span-utils';
import { getSpanTypeUi } from './shared';
import { SpanOutcomeSummary } from './span-outcome';
import { getSpanOutcome } from './span-outcome.utils';
import {
  SpanErrorDetails,
  SpanInputRenderer,
  SpanOutputRenderer,
  SpanPayloadJson,
  SpanPayloadProcessor,
  getSpanOutputPayload,
  hasSpanInputPreview,
  hasSpanOutputPreview,
} from './span-payload';
import { asCoreSpan, getSpanTools } from './span-payload/span-payload-registry';
import { SpanToolCallList, SpanToolList } from './span-payload/span-tools-section';
import { useSpanToolCalls } from './span-payload/use-span-tool-calls';
import { SpanPromptChanges } from './span-prompt-changes';
import { getPromptChanges, runsAfterModel } from './span-prompt-impact';
import { SpanTokenUsage } from './span-token-usage';
import { getModelFacts, getTokenUsageRows } from './span-token-usage.utils';
import { SpanTypeBadge } from './span-type-badge';
import { ProviderLogo } from '@/domains/llm';
import { Badge } from '@/ds/components/Badge';
import { Button } from '@/ds/components/Button';
import { CopyButton } from '@/ds/components/CopyButton';
import { DataKeysAndValues } from '@/ds/components/DataKeysAndValues';
import { DataPanel } from '@/ds/components/DataPanel';
import { Notice } from '@/ds/components/Notice';
import { Tab, TabList, Tabs } from '@/ds/components/Tabs';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/ds/components/Tooltip';
import { Txt } from '@/ds/components/Txt';
import { Icon } from '@/ds/icons/Icon';
import { cn } from '@/lib/utils';
import { formatTimestampPrecise } from '@/utils/date-format';
import { formatDuration, formatDurationPrecise } from '@/utils/duration';

// Mirrors `DataPanel.Content` without requiring the Drawer root (this view also renders standalone).
// Sections bleed their hairlines through this padding, so the two must match.
const BODY_CLASS = 'min-h-0 flex-1 overflow-y-auto p-3';

type PayloadView = 'rich' | 'raw';

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
  /** Controls the open tab; the panel keeps its own when omitted. Defaults to Details. */
  activeTab?: SpanTab;
  onTabChange?: (tab: SpanTab) => void;
  /**
   * When provided, a "Feedback" tab appears; the slot receives the loaded span and renders
   * whatever feedback UI the consumer wants.
   */
  feedbackTabSlot?: (args: { span: SpanRecord; traceId: string; spanId: string }) => ReactNode;
  /** Optional indicator rendered after the "Feedback" tab label (e.g. a needs-review dot). */
  feedbackTabBadge?: ReactNode;
  /** Extra classes for the panel root (e.g. flattening the card when nested in the trace panel). */
  className?: string;
}

/**
 * The same rows for every span type: what ran and how long it took, then the tabs. The body is flat:
 * the tab says what it holds, so the payload isn't wrapped in a titled card again. The open tab and the
 * Preview/JSON choice are kept when another span is selected, so stepping through spans compares like for like.
 */
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
  className,
}: SpanDataPanelViewProps) {
  const [ownTab, setOwnTab] = useState<SpanTab>('details');
  const [view, setView] = useState<PayloadView>('rich');

  const requested = activeTab ?? ownTab;
  // A feedback tab asked for by the URL means nothing where the consumer offers no feedback.
  const tab = requested === 'feedback' && !feedbackTabSlot ? 'details' : requested;
  const changeTab = (next: SpanTab) => {
    setOwnTab(next);
    onTabChange?.(next);
  };

  const tabs: Array<{ value: SpanTab; name: string; icon: ReactNode; attention?: boolean; badge?: ReactNode }> = [
    { value: 'details', name: 'Details', icon: <InfoIcon /> },
    { value: 'input', name: 'Input', icon: <FileInputIcon /> },
    { value: 'output', name: 'Output', icon: <FileOutputIcon />, attention: span?.error != null },
    ...(feedbackTabSlot
      ? [{ value: 'feedback' as const, name: 'Feedback', icon: <MessageSquareReplyIcon />, badge: feedbackTabBadge }]
      : []),
  ];

  const headingId = useId();

  // Not a DataPanel: this is the span column rendered inside `TraceDataPanelView`,
  // which already provides the panel chrome.
  return (
    <section
      aria-labelledby={headingId}
      data-slot="span-data-panel"
      className={cn('flex min-h-0 min-w-96 flex-1 flex-col overflow-hidden', className)}
    >
      <DataPanel.Header className="flex-nowrap">
        {span ? (
          <SpanIdentity span={span} headingId={headingId} />
        ) : (
          <DataPanel.HeaderContent>
            <DataPanel.Heading>
              <span id={headingId}>Span</span>
            </DataPanel.Heading>
          </DataPanel.HeaderContent>
        )}
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
        <>
          <Tabs<SpanTab> defaultTab="details" value={tab} onValueChange={changeTab}>
            <DataPanel.Header className="flex-nowrap border-b border-surface-rim">
              <div className="min-w-0 flex-1">
                <TabList variant="pill-ghost" size="sm">
                  {tabs.map(item => (
                    <Tab key={item.value} value={item.value} attention={item.attention}>
                      <Icon size="xs">{item.icon}</Icon>
                      <span>{item.name}</span>
                      {item.badge != null && <> ({item.badge})</>}
                    </Tab>
                  ))}
                </TabList>
              </div>
            </DataPanel.Header>
          </Tabs>

          <div role="tabpanel" aria-label={tabs.find(item => item.value === tab)?.name} className={BODY_CLASS}>
            {tab === 'details' && <DetailsTab traceId={traceId} span={span} />}
            {tab === 'input' && <InputTab span={span} view={view} onViewChange={setView} />}
            {tab === 'output' && <OutputTab span={span} view={view} onViewChange={setView} />}
            {tab === 'feedback' && feedbackTabSlot?.({ span, traceId, spanId })}
          </div>
        </>
      )}
    </section>
  );
}

/* ------------------------------------------------------------------------------------------------
 * Header
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
function SpanIdentity({ span, headingId }: { span: SpanRecord; headingId: string }) {
  const durationMs = getSpanDurationMs(span.startedAt, span.endedAt);
  const retries = getRetryCount(span);

  return (
    <div className="flex min-w-0 flex-1 items-center gap-2 pl-1">
      {/* Same type mark as the span's row in the trace tree, processors included. */}
      <SpanTypeBadge type={span.spanType ?? ''} spanUI={getSpanTypeUi(span.spanType ?? '')} />
      <Tooltip>
        <TooltipTrigger
          render={
            <Txt id={headingId} as="h2" variant="card-title-strong" className="min-w-0 truncate">
              {getModelFacts(span).model ?? span.entityName ?? span.name}
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

function InputTab({ span, view, onViewChange }: PayloadTabProps) {
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
          <SpanToolList tools={tools.tools} />
        </Section>
      )}
    </Stack>
  );
}

function OutputTab({ span, view, onViewChange }: PayloadTabProps) {
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
      <ToolCalls span={span} />
    </Stack>
  );
}

/** Everything looked up rather than read, grouped the same way for every span type. */
function DetailsTab({ traceId, span }: { traceId: string; span: SpanRecord }) {
  const { model, provider, finishReason, firstToken, speed } = getModelFacts(span);
  // oxlint-disable-next-line typescript/no-unnecessary-type-assertion -- Built SDK declarations type attributes.usage as unknown.
  const usage = span.attributes?.usage as UsageStats | undefined;
  const hasModel = Boolean(model || finishReason || firstToken || speed);
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
      <Notice variant="destructive" icon={<CircleXIcon />} title={<h3>{outcome.headline}</h3>}>
        <SpanErrorDetails span={span} />
      </Notice>
    );
  }
  // A tripwire leaves no error: its reason is the only account of why the run stopped.
  const tripwire = describeProcessorPipeline(asCoreSpan(span))?.tripwireAbort;
  if (!tripwire) return <SpanOutcomeSummary outcome={outcome} showDetail />;
  return (
    <Notice variant="destructive" icon={<CircleXIcon />} title={<h3>{outcome.headline}</h3>}>
      {tripwire.reason && <p className="break-words whitespace-pre-wrap">{tripwire.reason}</p>}
      {tripwire.retry !== undefined && (
        <Txt as="p" variant="body-sm" tone="muted">
          {tripwire.retry ? 'The model was asked to retry.' : 'Not retried.'}
        </Txt>
      )}
    </Notice>
  );
}

function ToolCalls({ span }: { span: SpanRecord }) {
  const toolCalls = useSpanToolCalls(span);
  if (toolCalls.length === 0) return null;
  return (
    <Section title="Tool calls" count={toolCalls.length}>
      <SpanToolCallList toolCalls={toolCalls} />
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
          {count != null && <span className="tabular-nums"> · {count}</span>}
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
            {view === 'raw' ? <EyeIcon /> : <BracesIcon />}
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

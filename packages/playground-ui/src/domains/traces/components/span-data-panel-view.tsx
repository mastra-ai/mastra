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

// Match DataPanel.Content padding for section dividers.
const BODY_CLASS = 'min-h-0 flex-1 overflow-y-auto p-3';

type PayloadView = 'rich' | 'raw';

export interface SpanDataPanelViewProps {
  traceId: string;
  spanId: string;
  span: SpanRecord | undefined;
  isLoading?: boolean;
  onPrevious?: () => void;
  onNext?: () => void;
  onClose?: () => void;
  onShowTrace?: (span: { traceId: string; spanId: string }) => void;
  activeTab?: SpanTab;
  onTabChange?: (tab: SpanTab) => void;
  feedbackTabSlot?: (args: { span: SpanRecord; traceId: string; spanId: string }) => ReactNode;
  feedbackTabBadge?: ReactNode;
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
  className,
}: SpanDataPanelViewProps) {
  const [ownTab, setOwnTab] = useState<SpanTab>('details');
  const [view, setView] = useState<PayloadView>('rich');

  const requested = activeTab ?? ownTab;
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

  // TraceDataPanelView already supplies the panel chrome.
  return (
    <section
      aria-labelledby={headingId}
      data-slot="span-data-panel"
      className={cn('flex min-h-0 flex-1 flex-col overflow-hidden', className)}
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

function getProcessorInput(span: SpanRecord) {
  if (getSpanSignal(span)) return undefined;
  const input = describeSpanInput(asCoreSpan(span));
  return input?.type === 'processor' ? input.value : undefined;
}

function getRetryCount(span: SpanRecord) {
  const data: Record<string, unknown> = getProcessorInput(span)?.data ?? {};
  const retryCount = data.retryCount;
  return typeof retryCount === 'number' && retryCount > 0 ? retryCount : 0;
}

function SpanIdentity({ span, headingId }: { span: SpanRecord; headingId: string }) {
  const durationMs = getSpanDurationMs(span.startedAt, span.endedAt);
  const retries = getRetryCount(span);

  return (
    <div className="flex min-w-0 flex-1 items-center gap-2 pl-1">
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

type PayloadTabProps = { span: SpanRecord; view: PayloadView; onViewChange: (view: PayloadView) => void };

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

function DetailsTab({ traceId, span }: { traceId: string; span: SpanRecord }) {
  const { finishReason, firstToken, speed, ...facts } = getModelFacts(span);
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

function Stack({ children }: { children: ReactNode }) {
  return <div className="grid min-w-0 content-start gap-4">{children}</div>;
}

function Section({
  title,
  label = title,
  count,
  children,
}: {
  title?: string;
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

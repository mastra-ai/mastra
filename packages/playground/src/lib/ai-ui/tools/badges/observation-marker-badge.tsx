import { Badge } from '@mastra/playground-ui/components/Badge';
import { MarkdownRenderer } from '@mastra/playground-ui/components/MarkdownRenderer';
import { Icon } from '@mastra/playground-ui/icons/Icon';
import { cn } from '@mastra/playground-ui/utils/cn';
import { Brain, XCircle, Loader2, ChevronDown, ChevronRight, Unplug, Eye } from 'lucide-react';
import { useState, useEffect } from 'react';
import { ObservationRenderer } from './observation-renderer';

export interface OmMarkerData {
  observedAt?: string;
  completedAt?: string;
  failedAt?: string;
  startedAt?: string;
  tokensObserved?: number;
  tokensToObserve?: number;
  observationTokens?: number;
  observations?: string;
  currentTask?: string;
  suggestedResponse?: string;
  extractedValues?: Record<string, unknown>;
  extractionFailures?: Array<{ slug: string; error: string }>;
  durationMs?: number;
  error?: string;
  recordId?: string;
  cycleId?: string;
  threadId?: string;
  threadIds?: string[];
  operationType?: 'observation' | 'reflection';
  _state?: 'loading' | 'complete' | 'failed' | 'buffering' | 'buffering-complete' | 'buffering-failed' | 'activated';
  // Activation-specific fields
  chunksActivated?: number;
  tokensActivated?: number;
  messagesActivated?: number;
  config?: {
    scope?: string;
    messageTokens?: number;
    observationTokens?: number;
  };
  // Buffering-specific fields
  tokensToBuffer?: number;
  tokensBuffered?: number;
  bufferedTokens?: number;
}

export interface ObservationMarkerBadgeProps {
  toolName: string;
  args: Record<string, unknown>;
  metadata?: {
    mode?: string;
    omData?: OmMarkerData;
  };
}

/**
 * Format token count for display (e.g., 7234 -> "7.2k", 234 -> "234")
 */
const formatTokens = (tokens: number): string => {
  if (tokens >= 1000) {
    return `${(tokens / 1000).toFixed(1)}k`;
  }
  return String(Math.round(tokens));
};

const hasExtractedValue = (value: unknown) => value !== undefined && value !== null && value !== '';

const getExtractedValueEntries = (values?: Record<string, unknown>) => {
  return Object.entries(values ?? {}).filter(([, value]) => hasExtractedValue(value));
};

const formatExtractedValue = (value: unknown): string => {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);

  try {
    return JSON.stringify(value, null, 2) ?? String(value);
  } catch {
    return String(value);
  }
};

const isStructuredExtractedValue = (value: unknown) => typeof value === 'object' && value !== null;

const ObservationIcon = ({ className }: { className?: string }) => <Eye className={className} />;

const MarkerPill = ({
  children,
  icon,
  expanded,
  onClick,
  className,
}: {
  children: React.ReactNode;
  icon: React.ReactNode;
  expanded?: boolean;
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
  className?: string;
}) => {
  const content = (
    <>
      {onClick && (
        <Icon>
          <ChevronDown className={cn('transition-all', expanded ? 'rotate-0' : '-rotate-90')} />
        </Icon>
      )}
      <Badge icon={icon}>{children}</Badge>
    </>
  );

  if (!onClick) {
    return <div className={cn('inline-flex items-center gap-2', className)}>{content}</div>;
  }

  return (
    <button onClick={onClick} className={cn('inline-flex items-center gap-2', className)} type="button">
      {content}
    </button>
  );
};

const ExtractedValuesPanel = ({
  extractedValues,
  extractionFailures,
  isExpanded,
  onToggle,
}: {
  extractedValues?: Record<string, unknown>;
  extractionFailures?: Array<{ slug: string; error: string }>;
  isExpanded: boolean;
  onToggle: () => void;
}) => {
  const entries = getExtractedValueEntries(extractedValues);
  const failures = extractionFailures ?? [];

  if (entries.length === 0 && failures.length === 0) return null;

  return (
    <div className="mt-2 border-t border-neutral-700 pt-2">
      <button
        onClick={onToggle}
        className="text-foreground flex items-center gap-1 text-[10px] font-medium tracking-wide uppercase transition-opacity hover:opacity-80"
      >
        {isExpanded ? <ChevronDown className="h-2.5 w-2.5" /> : <ChevronRight className="h-2.5 w-2.5" />}
        Extractions ({entries.length}){failures.length > 0 ? ` · ${failures.length} failed` : ''}
      </button>
      {isExpanded && (
        <div className="mt-1 space-y-2">
          {entries.map(([slug, value]) => (
            <div key={slug} className="rounded border border-neutral-700/60 bg-black/5 p-2 dark:bg-white/5">
              <div className="text-foreground/70 text-[10px] font-medium tracking-wide uppercase">{slug}</div>
              {isStructuredExtractedValue(value) ? (
                <pre className="text-foreground/80 mt-1 max-h-40 overflow-auto text-[11px] break-words whitespace-pre-wrap">
                  {formatExtractedValue(value)}
                </pre>
              ) : (
                <div className="text-foreground/80 mt-1 text-[11px] [&_code]:rounded [&_code]:bg-black/10 [&_code]:px-1 [&_code]:py-0.5 [&_code]:text-[10px]">
                  <MarkdownRenderer>{formatExtractedValue(value)}</MarkdownRenderer>
                </div>
              )}
            </div>
          ))}
          {failures.map(failure => (
            <div key={failure.slug} className="rounded border border-red-500/20 bg-red-500/5 p-2 text-red-700">
              <div className="text-[10px] font-medium tracking-wide uppercase">{failure.slug}</div>
              <div className="mt-1 text-[11px]">{failure.error}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

/**
 * Renders an inline badge for OM observation markers.
 * These are converted from data-om-* parts to tool-call format for assistant-ui compatibility.
 *
 * The badge includes a `data-om-badge` attribute with the cycleId so that
 * the BracketOverlay can find it via DOM queries for positioning bracket lines.
 */
export const ObservationMarkerBadge = ({ toolName, args, metadata }: ObservationMarkerBadgeProps) => {
  const omData = (metadata?.omData || args) as OmMarkerData;
  const cycleId = omData.cycleId || '';

  // Use the _state field set during part merging, or fallback to detecting from data
  const state =
    omData._state ||
    (omData.failedAt
      ? 'failed'
      : omData.completedAt
        ? 'complete'
        : (omData as any).disconnectedAt
          ? 'disconnected'
          : 'loading');

  const isStart = state === 'loading';
  const isEnd = state === 'complete';
  const isFailed = state === 'failed';
  const isDisconnected = state === 'disconnected';
  const isBuffering = state === 'buffering';
  const isBufferingComplete = state === 'buffering-complete';
  const isBufferingFailed = state === 'buffering-failed';
  const isActivated = state === 'activated';
  const isReflection = omData.operationType === 'reflection';
  const hasExtractionContent =
    getExtractedValueEntries(omData.extractedValues).length > 0 || (omData.extractionFailures?.length ?? 0) > 0;
  const shouldAutoExpand = (isFailed && isReflection) || hasExtractionContent;

  // Failed reflections and extraction-bearing markers should expand by default to draw attention to new details.
  const [isExpanded, setIsExpanded] = useState(shouldAutoExpand);

  // Auto-expand when completion details arrive after the marker was mounted during loading.
  useEffect(() => {
    if (shouldAutoExpand) {
      setIsExpanded(true);
    }
  }, [shouldAutoExpand]);
  const [isObservationsExpanded, setIsObservationsExpanded] = useState(true);
  const [isTaskExpanded, setIsTaskExpanded] = useState(false);
  const [isResponseExpanded, setIsResponseExpanded] = useState(false);
  const [isExtractedExpanded, setIsExtractedExpanded] = useState(false);

  // Colors - same scheme for both observation and reflection
  const bgColor = 'bg-blue-500/10';
  const textColor = 'text-blue-600';
  const completeBgColor = 'bg-green-500/10';
  const completeTextColor = 'text-green-600';
  const completeHoverBgColor = 'hover:bg-green-500/20';
  // Same colors for expanded state
  const expandedBgColor = 'bg-green-500/5';
  const expandedBorderColor = 'border-green-500/10';
  const labelColor = 'text-green-600';
  const bufferExpandedBgColor = 'bg-surface2';
  const bufferExpandedBorderColor = 'border-border-1';
  const actionLabel = isReflection ? 'Reflecting' : 'Observing';
  const completedLabel = isReflection ? 'Reflected' : 'Observed';

  // Render based on marker type
  if (isStart) {
    const tokensToObserve = omData.tokensToObserve;
    return (
      <div
        className="mb-3"
        data-om-badge={cycleId}
        data-om-state={state}
        data-om-type={isReflection ? 'reflection' : 'observation'}
      >
        <div
          className={`inline-flex items-center gap-1.5 rounded-md px-2 py-1 ${bgColor} ${textColor} my-1 text-xs font-medium`}
        >
          <Loader2 className="h-3 w-3 animate-spin" />
          {isReflection ? <Brain className="h-3 w-3" /> : <ObservationIcon className="h-3 w-3" />}
          <span>
            {actionLabel}
            {tokensToObserve ? ` ~${formatTokens(tokensToObserve)} tokens` : '...'}
          </span>
        </div>
      </div>
    );
  }

  if (isEnd) {
    const tokensObserved = omData.tokensObserved;
    const observationTokens = omData.observationTokens;
    const observations = omData.observations;
    const currentTask = omData.currentTask;
    const suggestedResponse = omData.suggestedResponse;
    const extractedValues = omData.extractedValues;
    const extractionFailures = omData.extractionFailures;
    const durationMs = omData.durationMs;
    const compressionRatio =
      tokensObserved && observationTokens && observationTokens > 0
        ? Math.round(tokensObserved / observationTokens)
        : null;

    const handleToggle = (e: React.MouseEvent) => {
      // Prevent scroll jump by preserving scroll position
      const scrollContainer = e.currentTarget.closest('[data-radix-scroll-area-viewport]') || document.documentElement;
      const scrollTop = scrollContainer.scrollTop;
      setIsExpanded(!isExpanded);
      // Restore scroll position after React updates
      requestAnimationFrame(() => {
        scrollContainer.scrollTop = scrollTop;
      });
    };

    return (
      <div
        className="mb-3"
        data-om-badge={cycleId}
        data-om-state={state}
        data-om-type={isReflection ? 'reflection' : 'observation'}
      >
        <div className="my-1">
          <button
            onClick={handleToggle}
            className={`inline-flex items-center gap-1.5 rounded-md px-2 py-1 ${completeBgColor} ${completeTextColor} text-xs font-medium ${completeHoverBgColor} cursor-pointer transition-colors`}
          >
            {isExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
            {isReflection ? <Brain className="h-3 w-3" /> : <ObservationIcon className="h-3 w-3" />}
            <span>
              {completedLabel} {tokensObserved ? formatTokens(tokensObserved) : '?'}→
              {observationTokens ? formatTokens(observationTokens) : '?'} tokens
              {compressionRatio ? ` (-${compressionRatio}x)` : ''}
            </span>
          </button>
          {isExpanded && (
            <div
              className={`mt-1 ml-6 rounded-md p-2 ${expandedBgColor} space-y-1.5 border text-xs ${expandedBorderColor}`}
            >
              {/* Stats row - all green */}
              <div className={`flex gap-4 text-[11px] ${labelColor}`}>
                {tokensObserved && <span>Input: {formatTokens(tokensObserved)}</span>}
                {observationTokens && <span>Output: {formatTokens(observationTokens)}</span>}
                {compressionRatio && compressionRatio > 1 && <span>Compression: {compressionRatio}x</span>}
                {durationMs && <span>Duration: {(durationMs / 1000).toFixed(2)}s</span>}
              </div>
              {observations && (
                <div className={`mt-1 border-t border-neutral-700 pt-1`}>
                  {/* If there's no currentTask or suggestedResponse, show observations directly without collapsible wrapper */}
                  {!currentTask && !suggestedResponse ? (
                    <ObservationRenderer observations={observations} maxHeight="500px" />
                  ) : (
                    <>
                      <button
                        onClick={() => setIsObservationsExpanded(!isObservationsExpanded)}
                        className="text-foreground flex items-center gap-1 text-[10px] font-medium tracking-wide uppercase transition-opacity hover:opacity-80"
                      >
                        {isObservationsExpanded ? (
                          <ChevronDown className="h-2.5 w-2.5" />
                        ) : (
                          <ChevronRight className="h-2.5 w-2.5" />
                        )}
                        {isReflection ? 'Reflections' : 'Observations'}
                      </button>
                      {isObservationsExpanded && (
                        <div className="mt-1">
                          <ObservationRenderer observations={observations} maxHeight="500px" />
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
              {currentTask && (
                <div className={`mt-2 border-t border-neutral-700 pt-2`}>
                  <button
                    onClick={() => setIsTaskExpanded(!isTaskExpanded)}
                    className="text-foreground flex items-center gap-1 text-[10px] font-medium tracking-wide uppercase transition-opacity hover:opacity-80"
                  >
                    {isTaskExpanded ? (
                      <ChevronDown className="h-2.5 w-2.5" />
                    ) : (
                      <ChevronRight className="h-2.5 w-2.5" />
                    )}
                    Current Task
                  </button>
                  {isTaskExpanded && (
                    <div className="text-foreground mt-1 text-[11px] [&_code]:rounded [&_code]:bg-black/10 [&_code]:px-1 [&_code]:py-0.5 [&_code]:text-[10px]">
                      <MarkdownRenderer>{currentTask}</MarkdownRenderer>
                    </div>
                  )}
                </div>
              )}
              {suggestedResponse && (
                <div className={`mt-2 border-t border-neutral-700 pt-2`}>
                  <button
                    onClick={() => setIsResponseExpanded(!isResponseExpanded)}
                    className="text-foreground flex items-center gap-1 text-[10px] font-medium tracking-wide uppercase transition-opacity hover:opacity-80"
                  >
                    {isResponseExpanded ? (
                      <ChevronDown className="h-2.5 w-2.5" />
                    ) : (
                      <ChevronRight className="h-2.5 w-2.5" />
                    )}
                    Suggested Response
                  </button>
                  {isResponseExpanded && (
                    <div className="text-foreground/80 mt-1 text-[11px] italic [&_code]:rounded [&_code]:bg-black/10 [&_code]:px-1 [&_code]:py-0.5 [&_code]:text-[10px]">
                      <MarkdownRenderer>{suggestedResponse}</MarkdownRenderer>
                    </div>
                  )}
                </div>
              )}
              <ExtractedValuesPanel
                extractedValues={extractedValues}
                extractionFailures={extractionFailures}
                isExpanded={isExtractedExpanded}
                onToggle={() => setIsExtractedExpanded(!isExtractedExpanded)}
              />
            </div>
          )}
        </div>
      </div>
    );
  }

  if (isDisconnected) {
    const disconnectedLabel = isReflection ? 'Reflection interrupted' : 'Observation interrupted';
    const tokensToObserve = omData.tokensToObserve;
    return (
      <div
        className="mb-3"
        data-om-badge={cycleId}
        data-om-state={state}
        data-om-type={isReflection ? 'reflection' : 'observation'}
      >
        <div className="my-1 inline-flex items-center gap-1.5 rounded-md bg-yellow-500/10 px-2 py-1 text-xs font-medium text-yellow-600">
          <Unplug className="h-3 w-3" />
          <span>
            {disconnectedLabel}
            {tokensToObserve ? ` (~${formatTokens(tokensToObserve)} tokens)` : ''}
          </span>
        </div>
      </div>
    );
  }

  if (isFailed) {
    const error = omData.error;
    const failedLabel = isReflection ? 'Reflection failed' : 'Observation failed';
    return (
      <div
        className="mb-3"
        data-om-badge={cycleId}
        data-om-state={state}
        data-om-type={isReflection ? 'reflection' : 'observation'}
      >
        <div className="my-1">
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="inline-flex cursor-pointer items-center gap-1.5 rounded-md bg-red-500/10 px-2 py-1 text-xs font-medium text-red-600 transition-colors hover:bg-red-500/20"
          >
            {isExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
            <XCircle className="h-3 w-3" />
            <span>{failedLabel}</span>
          </button>

          {isExpanded && error && (
            <div className="mt-1 ml-4 rounded-md border border-red-500/10 bg-red-500/5 p-2 text-xs text-red-700">
              <span className="font-medium">Error:</span> {error}
            </div>
          )}
        </div>
      </div>
    );
  }

  // Async buffering states - non-blocking background observation/reflection
  if (isBuffering) {
    const tokensToBuffer = omData.tokensToBuffer;
    const bufferingLabel = isReflection ? 'Buffering reflection' : 'Buffering observations';
    return (
      <div
        className="mt-2 mb-8"
        data-om-badge={cycleId}
        data-om-state={state}
        data-om-type={isReflection ? 'reflection' : 'observation'}
      >
        <MarkerPill icon={<Loader2 className="text-accent6 animate-spin" />}>
          {bufferingLabel}
          {tokensToBuffer ? ` ~${formatTokens(tokensToBuffer)} tokens` : '...'}
        </MarkerPill>
      </div>
    );
  }

  if (isBufferingComplete) {
    const tokensBuffered = omData.tokensBuffered;
    const bufferedTokens = omData.bufferedTokens;
    const { observations, extractedValues, extractionFailures } = omData;
    const bufferedLabel = isReflection ? 'Buffered reflection' : 'Buffered observations';
    const compressionRatio =
      tokensBuffered && bufferedTokens && bufferedTokens > 0 ? Math.round(tokensBuffered / bufferedTokens) : null;

    const handleToggle = (e: React.MouseEvent) => {
      const scrollContainer = e.currentTarget.closest('[data-radix-scroll-area-viewport]') || document.documentElement;
      const scrollTop = scrollContainer.scrollTop;
      setIsExpanded(!isExpanded);
      requestAnimationFrame(() => {
        scrollContainer.scrollTop = scrollTop;
      });
    };

    return (
      <div
        className="mt-2 mb-8"
        data-om-badge={cycleId}
        data-om-state={state}
        data-om-type={isReflection ? 'reflection' : 'observation'}
      >
        <div>
          <MarkerPill expanded={isExpanded} onClick={handleToggle} icon={<ObservationIcon className="text-accent6" />}>
            {bufferedLabel} {tokensBuffered ? formatTokens(tokensBuffered) : '?'}→
            {bufferedTokens ? formatTokens(bufferedTokens) : '?'} tokens
            {compressionRatio ? ` (-${compressionRatio}x)` : ''}
          </MarkerPill>

          {isExpanded && (
            <div
              className={`mt-2 ml-6 rounded-lg ${bufferExpandedBgColor} space-y-2 border p-4 text-xs ${bufferExpandedBorderColor}`}
            >
              {observations && <ObservationRenderer observations={observations} maxHeight="240px" />}
              <ExtractedValuesPanel
                extractedValues={extractedValues}
                extractionFailures={extractionFailures}
                isExpanded={isExtractedExpanded}
                onToggle={() => setIsExtractedExpanded(!isExtractedExpanded)}
              />
            </div>
          )}
        </div>
      </div>
    );
  }

  if (isBufferingFailed) {
    const error = omData.error;
    const failedLabel = isReflection ? 'Buffered reflection failed' : 'Buffered observation failed';
    return (
      <div
        className="mb-3"
        data-om-badge={cycleId}
        data-om-state={state}
        data-om-type={isReflection ? 'reflection' : 'observation'}
      >
        <div className="my-1">
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-dashed border-red-400/40 bg-red-500/10 px-2 py-1 text-xs font-medium text-red-600 transition-colors hover:bg-red-500/20"
          >
            {isExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
            <XCircle className="h-3 w-3" />
            <span>{failedLabel}</span>
          </button>

          {isExpanded && error && (
            <div className="mt-1 ml-4 rounded-md border border-red-500/10 bg-red-500/5 p-2 text-xs text-red-700">
              <span className="font-medium">Error:</span> {error}
            </div>
          )}
        </div>
      </div>
    );
  }

  // Activation state - buffered observations have been activated into active observations
  // Styled to match sync observation/reflection markers (green scheme with Brain icon)
  if (isActivated) {
    const tokensActivated = omData.tokensActivated ?? 0;
    const observationTokens = omData.observationTokens ?? 0;
    const { observations } = omData;
    const activatedLabel = isReflection ? 'Reflected' : 'Observed';
    const compressionRatio =
      tokensActivated && observationTokens && observationTokens > 0
        ? Math.round(tokensActivated / observationTokens)
        : null;

    const handleToggle = (e: React.MouseEvent) => {
      const scrollContainer = e.currentTarget.closest('[data-radix-scroll-area-viewport]') || document.documentElement;
      const scrollTop = scrollContainer.scrollTop;
      setIsExpanded(!isExpanded);
      requestAnimationFrame(() => {
        scrollContainer.scrollTop = scrollTop;
      });
    };

    return (
      <div
        className="mb-3"
        data-om-badge={cycleId}
        data-om-state={state}
        data-om-type={isReflection ? 'reflection' : 'observation'}
        data-om-no-highlight="true"
      >
        <div className="my-1">
          <button
            onClick={handleToggle}
            className={`inline-flex items-center gap-1.5 rounded-md px-2 py-1 ${completeBgColor} ${completeTextColor} text-xs font-medium ${completeHoverBgColor} cursor-pointer transition-colors`}
          >
            {isExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
            {isReflection ? <Brain className="h-3 w-3" /> : <ObservationIcon className="h-3 w-3" />}
            <span>
              {activatedLabel} {tokensActivated ? formatTokens(tokensActivated) : '?'}→
              {observationTokens ? formatTokens(observationTokens) : '?'} tokens
              {compressionRatio ? ` (-${compressionRatio}x)` : ''}
            </span>
          </button>
          {isExpanded && (
            <div
              className={`mt-1 ml-6 rounded-md p-2 ${expandedBgColor} space-y-1.5 border text-xs ${expandedBorderColor}`}
            >
              {/* Stats row */}
              <div className={`flex gap-4 text-[11px] ${labelColor}`}>
                {tokensActivated > 0 && <span>Input: {formatTokens(tokensActivated)}</span>}
                {observationTokens > 0 && <span>Output: {formatTokens(observationTokens)}</span>}
                {compressionRatio && compressionRatio > 1 && <span>Compression: {compressionRatio}x</span>}
              </div>
              {observations && (
                <div className="mt-1 border-t border-neutral-700 pt-1">
                  <ObservationRenderer observations={observations} maxHeight="500px" />
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  // Unknown marker type - render generic
  return (
    <div
      className="mb-3"
      data-om-badge={cycleId}
      data-om-state={state}
      data-om-type={isReflection ? 'reflection' : 'observation'}
    >
      <div className="my-1 inline-flex items-center gap-1.5 rounded-md bg-gray-500/10 px-2 py-1 text-xs font-medium text-gray-600">
        <Brain className="h-3 w-3" />
        <span>{toolName}</span>
      </div>
    </div>
  );
};

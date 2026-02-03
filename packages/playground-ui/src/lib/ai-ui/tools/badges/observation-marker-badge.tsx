import { useState, useEffect } from 'react';
import { Brain, XCircle, Loader2, ChevronDown, ChevronRight, Unplug } from 'lucide-react';
import { ObservationRenderer } from './observation-renderer';
import { MarkdownRenderer } from '@/ds/components/MarkdownRenderer';

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
  durationMs?: number;
  error?: string;
  recordId?: string;
  cycleId?: string;
  threadId?: string;
  threadIds?: string[];
  operationType?: 'observation' | 'reflection';
  _state?: 'loading' | 'complete' | 'failed';
  config?: {
    scope?: string;
    messageTokens?: number;
    observationTokens?: number;
  };
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
  const isReflection = omData.operationType === 'reflection';

  // Failed reflections should be expanded by default to draw attention to the error
  const [isExpanded, setIsExpanded] = useState(isFailed && isReflection);

  // Auto-expand when a reflection fails (handles case where component was mounted during loading)
  useEffect(() => {
    if (isFailed && isReflection) {
      setIsExpanded(true);
    }
  }, [isFailed, isReflection]);
  const [isObservationsExpanded, setIsObservationsExpanded] = useState(true);
  const [isTaskExpanded, setIsTaskExpanded] = useState(false);
  const [isResponseExpanded, setIsResponseExpanded] = useState(false);

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
          className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md ${bgColor} ${textColor} text-xs font-medium my-1`}
        >
          <Loader2 className="w-3 h-3 animate-spin" />
          <Brain className="w-3 h-3" />
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
            className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md ${completeBgColor} ${completeTextColor} text-xs font-medium ${completeHoverBgColor} transition-colors cursor-pointer`}
          >
            {isExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
            <Brain className="w-3 h-3" />
            <span>
              {completedLabel} {tokensObserved ? formatTokens(tokensObserved) : '?'}→
              {observationTokens ? formatTokens(observationTokens) : '?'} tokens
              {compressionRatio ? ` (-${compressionRatio}x)` : ''}
            </span>
          </button>
          {isExpanded && (
            <div
              className={`mt-1 ml-6 p-2 rounded-md ${expandedBgColor} text-xs space-y-1.5 border ${expandedBorderColor}`}
            >
              {/* Stats row - all green */}
              <div className={`flex gap-4 text-[11px] ${labelColor}`}>
                {tokensObserved && <span>Input: {formatTokens(tokensObserved)}</span>}
                {observationTokens && <span>Output: {formatTokens(observationTokens)}</span>}
                {compressionRatio && compressionRatio > 1 && <span>Compression: {compressionRatio}x</span>}
                {durationMs && <span>Duration: {(durationMs / 1000).toFixed(2)}s</span>}
              </div>
              {observations && (
                <div className={`mt-1 pt-1 border-t border-neutral-700`}>
                  {/* If there's no currentTask or suggestedResponse, show observations directly without collapsible wrapper */}
                  {!currentTask && !suggestedResponse ? (
                    <ObservationRenderer observations={observations} maxHeight="500px" />
                  ) : (
                    <>
                      <button
                        onClick={() => setIsObservationsExpanded(!isObservationsExpanded)}
                        className="flex items-center gap-1 text-[10px] font-medium text-foreground uppercase tracking-wide hover:opacity-80 transition-opacity"
                      >
                        {isObservationsExpanded ? (
                          <ChevronDown className="w-2.5 h-2.5" />
                        ) : (
                          <ChevronRight className="w-2.5 h-2.5" />
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
                <div className={`mt-2 pt-2 border-t border-neutral-700`}>
                  <button
                    onClick={() => setIsTaskExpanded(!isTaskExpanded)}
                    className="flex items-center gap-1 text-[10px] font-medium text-foreground uppercase tracking-wide hover:opacity-80 transition-opacity"
                  >
                    {isTaskExpanded ? (
                      <ChevronDown className="w-2.5 h-2.5" />
                    ) : (
                      <ChevronRight className="w-2.5 h-2.5" />
                    )}
                    Current Task
                  </button>
                  {isTaskExpanded && (
                    <div className="mt-1 text-[11px] text-foreground [&_code]:bg-black/10 [&_code]:px-1 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-[10px]">
                      <MarkdownRenderer>{currentTask}</MarkdownRenderer>
                    </div>
                  )}
                </div>
              )}
              {suggestedResponse && (
                <div className={`mt-2 pt-2 border-t border-neutral-700`}>
                  <button
                    onClick={() => setIsResponseExpanded(!isResponseExpanded)}
                    className="flex items-center gap-1 text-[10px] font-medium text-foreground uppercase tracking-wide hover:opacity-80 transition-opacity"
                  >
                    {isResponseExpanded ? (
                      <ChevronDown className="w-2.5 h-2.5" />
                    ) : (
                      <ChevronRight className="w-2.5 h-2.5" />
                    )}
                    Suggested Response
                  </button>
                  {isResponseExpanded && (
                    <div className="mt-1 text-[11px] text-foreground/80 italic [&_code]:bg-black/10 [&_code]:px-1 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-[10px]">
                      <MarkdownRenderer>{suggestedResponse}</MarkdownRenderer>
                    </div>
                  )}
                </div>
              )}
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
        <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-yellow-500/10 text-yellow-600 text-xs font-medium my-1">
          <Unplug className="w-3 h-3" />
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
            className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-red-500/10 text-red-600 text-xs font-medium hover:bg-red-500/20 transition-colors cursor-pointer"
          >
            {isExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
            <XCircle className="w-3 h-3" />
            <span>{failedLabel}</span>
          </button>

          {isExpanded && error && (
            <div className="mt-1 ml-4 p-2 rounded-md bg-red-500/5 text-red-700 text-xs border border-red-500/10">
              <span className="font-medium">Error:</span> {error}
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
      <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-gray-500/10 text-gray-600 text-xs font-medium my-1">
        <Brain className="w-3 h-3" />
        <span>{toolName}</span>
      </div>
    </div>
  );
};

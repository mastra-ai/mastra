import type { GetObservationalMemoryResponse } from '@mastra/client-js';
import { ScrollArea } from '@mastra/playground-ui';
import { Skeleton } from '@mastra/playground-ui/components/Skeleton';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@mastra/playground-ui/components/Tooltip';
import { useCopyToClipboard } from '@mastra/playground-ui/hooks/use-copy-to-clipboard';
import { ChevronRight, ChevronDown, Brain, ExternalLink, Info } from 'lucide-react';
import { useState, useMemo, useEffect, useRef } from 'react';
import { useObservationalMemoryContext } from '@/domains/agents/context';
import type { OmProgressData } from '@/domains/agents/context';
import { useObservationalMemory, useMemoryWithOMStatus, useMemoryConfig } from '@/domains/memory/hooks';
import { ObservationRenderer } from '@/lib/ai-ui/tools/badges/observation-renderer';

// Format tokens helper
const formatTokens = (n: number) => {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 100_000) return `${(n / 1000).toFixed(0)}k`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return Math.round(n).toString();
};

// Get bar color based on percentage: green 0-60%, blue 60%+
const getBarColor = (percentage: number) => {
  if (percentage >= 60) return 'bg-blue-500';
  return 'bg-green-500';
};

const getModelLabel = (model: unknown, modelRouting?: Array<{ upTo: number; model: string }>) => {
  if (typeof model === 'string') return model;
  if (modelRouting?.length) return 'Auto (tiered)';
  return undefined;
};

type ThresholdValue = number | { min: number; max: number };
type ModelRouting = Array<{ upTo: number; model: string }>;
type ObservationalMemoryRecord = NonNullable<GetObservationalMemoryResponse['record']>;
type ObservationalMemoryHistoryRecord = NonNullable<GetObservationalMemoryResponse['history']>[number];

const getThresholdValue = (threshold: ThresholdValue | undefined, defaultValue: number) => {
  if (!threshold) return defaultValue;
  if (typeof threshold === 'number') return threshold;
  return threshold.max;
};

const getBaseThresholdValue = (threshold: ThresholdValue | undefined, defaultValue: number) => {
  if (!threshold) return defaultValue;
  if (typeof threshold === 'number') return threshold;
  return threshold.min;
};

const formatRelativeTime = (date: Date | string | null | undefined) => {
  if (!date) return 'Never';
  const d = new Date(date);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return d.toLocaleDateString();
};

const useElapsedTime = (isActive: boolean) => {
  const [state, setState] = useState({ isActive, elapsed: 0 });
  const startTimeRef = useRef<number | null>(null);

  if (state.isActive !== isActive) {
    startTimeRef.current = isActive ? Date.now() : null;
    setState({ isActive, elapsed: 0 });
  }

  useEffect(() => {
    if (!isActive) return;

    if (!startTimeRef.current) {
      startTimeRef.current = Date.now();
    }

    const interval = setInterval(() => {
      const startTime = startTimeRef.current;
      if (!startTime) return;
      setState(current => ({ ...current, elapsed: (Date.now() - startTime) / 1000 }));
    }, 100);

    return () => clearInterval(interval);
  }, [isActive]);

  return state.isActive === isActive ? state.elapsed : 0;
};

// Progress bar component with percent label inside bar
const ProgressBar = ({
  value,
  max,
  label,
  isActive = false,
  model,
  modelRouting,
  baseThreshold,
  totalBudget,
}: {
  value: number;
  max: number;
  label: string;
  isActive?: boolean;
  model?: string;
  modelRouting?: Array<{ upTo: number; model: string }>;
  baseThreshold?: number; // When adaptive, shows the configured base threshold
  totalBudget?: number; // Total shared budget in adaptive mode
}) => {
  const isAdaptive = baseThreshold !== undefined && totalBudget !== undefined;
  const percentage = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0;
  const barColor = getBarColor(percentage);
  const elapsed = useElapsedTime(isActive && percentage >= 100);
  const isProcessing = isActive && percentage >= 100;
  const activeText = label === 'Messages' ? 'observing' : 'reflecting';

  // Show "adaptive" when at 100% due to adaptive mode but still below configured threshold
  const showAdaptiveLabel = isAdaptive && percentage >= 100 && !isProcessing && baseThreshold && value < baseThreshold;

  // When processing: use blue observing badge style (bg-blue-500/10 text-blue-600)
  const containerBg = isProcessing ? 'bg-transparent' : 'bg-surface4';
  const fillColor = isProcessing ? 'bg-blue-500/10' : barColor;
  const textColor = isProcessing ? 'text-blue-600' : 'text-neutral4';
  const textColorFilled = isProcessing ? 'text-blue-600' : 'text-white';
  const tokenBg = isProcessing ? 'bg-blue-500/10' : 'bg-surface5';
  const tokenTextColor = isProcessing ? 'text-blue-600' : 'text-neutral3';

  return (
    <div className="flex-1 min-w-0">
      {/* Label above bar - fixed height to prevent layout shift */}
      <div className="flex items-center gap-1 mb-1 h-4">
        <span className="text-[9px] text-neutral4 uppercase tracking-wider font-normal">{label}</span>
        <Tooltip>
          <TooltipTrigger asChild>
            <button type="button" className="inline-flex items-center justify-center">
              <Info className="w-2.5 h-2.5 text-neutral4 hover:text-neutral3 cursor-help" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="top" className="max-w-xs bg-surface3 border border-border1 text-foreground">
            <div className="text-xs space-y-1.5">
              <div className="font-medium text-neutral5">
                {label === 'Messages' ? 'Observer' : 'Reflector'} Settings
              </div>
              <div className="space-y-0.5">
                <div>
                  <span className="text-neutral4">Model:</span>{' '}
                  <span className="text-neutral5">{model || 'not configured'}</span>
                </div>
                {modelRouting?.length ? (
                  <div>
                    <span className="text-neutral4">Routing:</span>
                    <div className="mt-0.5 pl-2 space-y-0.5">
                      {modelRouting.map(route => (
                        <div key={`${route.upTo}-${route.model}`} className="text-neutral5">
                          ≤{formatTokens(route.upTo)} → {route.model}
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div>
                    <span className="text-neutral4">Threshold:</span>{' '}
                    <span className="text-neutral5">{formatTokens(baseThreshold ?? max)} tokens</span>
                  </div>
                )}
                {isAdaptive && totalBudget && (
                  <div>
                    <span className="text-neutral4">Mode:</span> <span className="text-amber-400">Adaptive</span>{' '}
                    <span className="text-neutral4">({formatTokens(totalBudget)} shared budget)</span>
                  </div>
                )}
              </div>
            </div>
          </TooltipContent>
        </Tooltip>
      </div>

      <div className="flex items-stretch">
        {/* Progress bar with percentage inside */}
        <div className={`relative flex-1 h-5 ${containerBg} rounded-l overflow-hidden`}>
          <div className={`h-full ${fillColor} transition-all`} style={{ width: `${percentage}%` }} />
          <span
            className={`absolute inset-0 flex items-center ${isProcessing ? 'justify-start pl-2' : 'justify-center'} text-[10px] font-medium ${textColor} pointer-events-none`}
          >
            {isProcessing
              ? `${activeText} ${elapsed.toFixed(1)}s`
              : showAdaptiveLabel
                ? 'adaptive'
                : `${Math.round(percentage)}%`}
          </span>
          <span
            className={`absolute inset-0 flex items-center ${isProcessing ? 'justify-start pl-2' : 'justify-center'} text-[10px] font-medium ${textColorFilled} pointer-events-none`}
            style={{ clipPath: `inset(0 ${100 - percentage}% 0 0)` }}
          >
            {isProcessing
              ? `${activeText} ${elapsed.toFixed(1)}s`
              : showAdaptiveLabel
                ? 'adaptive'
                : `${Math.round(percentage)}%`}
          </span>
        </div>

        {/* Token count connected to bar */}
        <span
          className={`text-[10px] ${tokenTextColor} tabular-nums whitespace-nowrap font-mono ${tokenBg} px-1.5 flex items-center gap-1 rounded-r -ml-px`}
        >
          {formatTokens(value)}
          <span className={isProcessing ? 'text-blue-500' : 'text-neutral4'}>/{formatTokens(max)}</span>
          {isAdaptive && totalBudget && (
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="text-amber-400 cursor-help">({formatTokens(baseThreshold)})</span>
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-xs bg-surface3 border border-border1 text-foreground">
                <div className="text-xs">
                  <span className="text-amber-400">{formatTokens(baseThreshold)}</span>
                  <span className="text-neutral4"> is the configured threshold. </span>
                  <span className="text-neutral5">
                    Adaptive mode shares a {formatTokens(totalBudget)} token budget between messages and observations.
                  </span>
                </div>
              </TooltipContent>
            </Tooltip>
          )}
        </span>
      </div>
    </div>
  );
};

const ObservationalMemoryHeader = () => (
  <div className="flex items-center gap-2 mb-3">
    <Brain className="w-4 h-4 text-purple-400" />
    <h3 className="text-sm font-medium text-neutral5">Observational Memory</h3>
  </div>
);

const ObservationalMemoryDisabled = () => (
  <div className="p-4">
    <div className="flex items-center gap-2 mb-3">
      <Brain className="w-4 h-4 text-neutral3" />
      <h3 className="text-sm font-medium text-neutral5">Observational Memory</h3>
    </div>
    <div className="bg-surface3 border border-border1 rounded-lg p-4">
      <p className="text-sm text-neutral3 mb-3">
        Observational Memory is not enabled for this agent. Enable it to automatically extract and maintain observations
        from conversations.
      </p>
      <a
        href="https://mastra.ai/en/docs/memory/observational-memory"
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-2 text-sm text-blue-400 hover:text-blue-300 transition-colors"
      >
        Learn about Observational Memory
        <ExternalLink className="w-3 h-3" />
      </a>
    </div>
  </div>
);

function ObservationalMemoryProgressBars({
  pendingMessageTokens,
  messageTokensThreshold,
  isObserving,
  observationModel,
  observationModelRouting,
  baseMessageTokens,
  totalBudget,
  observationTokenCount,
  observationTokensThreshold,
  isReflecting,
  baseObservationTokens,
  reflectionModel,
  reflectionModelRouting,
}: {
  pendingMessageTokens: number;
  messageTokensThreshold: number;
  isObserving: boolean;
  observationModel?: string;
  observationModelRouting?: ModelRouting;
  baseMessageTokens?: number;
  totalBudget: number;
  observationTokenCount: number;
  observationTokensThreshold: number;
  isReflecting: boolean;
  baseObservationTokens?: number;
  reflectionModel?: string;
  reflectionModelRouting?: ModelRouting;
}) {
  return (
    <TooltipProvider delayDuration={0}>
      <div className="flex gap-3 mb-3">
        <ProgressBar
          value={pendingMessageTokens}
          max={messageTokensThreshold}
          label="Messages"
          isActive={isObserving}
          model={observationModel}
          modelRouting={observationModelRouting}
          baseThreshold={baseMessageTokens}
          totalBudget={totalBudget}
        />
        <ProgressBar
          value={observationTokenCount}
          max={observationTokensThreshold}
          label="Observations"
          isActive={isReflecting}
          baseThreshold={baseObservationTokens}
          model={reflectionModel}
          modelRouting={reflectionModelRouting}
          totalBudget={totalBudget}
        />
      </div>
    </TooltipProvider>
  );
}

function ObservationsSection({
  observations,
  previousObservations,
  record,
  tokenCount,
  isCopied,
  onCopy,
}: {
  observations: string;
  previousObservations: ObservationalMemoryHistoryRecord[];
  record: ObservationalMemoryRecord | null | undefined;
  tokenCount: number;
  isCopied: boolean;
  onCopy: () => void;
}) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [showHistory, setShowHistory] = useState(false);
  const [expandedReflections, setExpandedReflections] = useState<Set<string>>(new Set());
  const observationsContentRef = useRef<HTMLDivElement>(null);

  const toggleReflection = (id: string) => {
    setExpandedReflections(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  useEffect(() => {
    if (!observations || !observationsContentRef.current || !isExpanded) return;

    const container = observationsContentRef.current;
    const dateHeaders = container.querySelectorAll<HTMLElement>('[class*="sticky"]');
    const lastDateHeader = dateHeaders[dateHeaders.length - 1];
    const scrollContainer = container.closest('[data-radix-scroll-area-viewport]') as HTMLElement;
    if (!scrollContainer || !lastDateHeader) return;

    const containerTop = container.getBoundingClientRect().top;
    const headerTop = lastDateHeader.getBoundingClientRect().top;
    const offsetFromTop = headerTop - containerTop;

    requestAnimationFrame(() => {
      scrollContainer.scrollTo({
        top: offsetFromTop,
        behavior: 'smooth',
      });
    });
  }, [observations, isExpanded]);

  if (!observations) return null;

  const observedAt = record?.lastObservedAt ?? record?.updatedAt;

  return (
    <div className="space-y-3 min-w-0 overflow-hidden w-full">
      <div className="border border-border1 rounded-lg bg-surface3 w-full overflow-hidden">
        <button
          type="button"
          onClick={() => setIsExpanded(value => !value)}
          className="w-full px-3 py-2 flex items-center justify-between hover:bg-surface4 transition-colors rounded-t-lg"
        >
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-neutral5">Observations</span>
            <span className="text-xs text-neutral3">{tokenCount.toLocaleString()} tokens</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-neutral3">{observedAt ? formatRelativeTime(observedAt) : ''}</span>
            {isExpanded ? (
              <ChevronDown className="w-3 h-3 text-neutral3" />
            ) : (
              <ChevronRight className="w-3 h-3 text-neutral3" />
            )}
          </div>
        </button>
        {isExpanded && (
          <div className="border-t border-border1 overflow-hidden w-full" style={{ height: '400px' }}>
            <ScrollArea className="h-full w-full">
              <div
                ref={observationsContentRef}
                className="p-3 cursor-pointer hover:bg-surface4/20 transition-colors relative group text-ui-xs overflow-hidden w-full"
              >
                <button
                  type="button"
                  onClick={onCopy}
                  aria-label="Copy observations"
                  className="absolute inset-0 z-10 rounded-lg focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-accent1"
                />
                <ObservationRenderer
                  observations={observations}
                  maxHeight={undefined}
                  className="wrap-break-word w-full overflow-hidden pointer-events-none"
                />
                {isCopied && (
                  <span className="absolute top-2 right-2 z-20 text-ui-xs px-1.5 py-0.5 rounded-full bg-green-500/20 text-green-500 pointer-events-none">
                    Copied!
                  </span>
                )}
                <span className="absolute top-2 right-2 z-20 text-ui-xs px-1.5 py-0.5 rounded-full bg-surface3 text-neutral4 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                  Click to copy
                </span>
              </div>
            </ScrollArea>
          </div>
        )}
      </div>

      {previousObservations.length > 0 && (
        <ObservationHistory
          previousObservations={previousObservations}
          showHistory={showHistory}
          expandedReflections={expandedReflections}
          onToggleHistory={() => setShowHistory(value => !value)}
          onToggleReflection={toggleReflection}
        />
      )}
    </div>
  );
}

function ObservationHistory({
  previousObservations,
  showHistory,
  expandedReflections,
  onToggleHistory,
  onToggleReflection,
}: {
  previousObservations: ObservationalMemoryHistoryRecord[];
  showHistory: boolean;
  expandedReflections: Set<string>;
  onToggleHistory: () => void;
  onToggleReflection: (id: string) => void;
}) {
  return (
    <div className="border-t border-border1 pt-3">
      <button
        type="button"
        onClick={onToggleHistory}
        className="flex items-center gap-2 text-xs text-neutral3 hover:text-neutral5 transition-colors"
      >
        {showHistory ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
        <span>Previous observations ({previousObservations.length})</span>
      </button>
      {showHistory && (
        <div className="mt-2 space-y-2">
          {previousObservations.map(historyRecord => (
            <ObservationHistoryRecord
              key={historyRecord.id}
              historyRecord={historyRecord}
              isExpanded={expandedReflections.has(historyRecord.id)}
              onToggle={() => onToggleReflection(historyRecord.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function ObservationHistoryRecord({
  historyRecord,
  isExpanded,
  onToggle,
}: {
  historyRecord: ObservationalMemoryHistoryRecord;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="border border-border1 rounded-lg bg-surface2">
      <button
        type="button"
        onClick={onToggle}
        className="w-full px-3 py-2 flex items-center justify-between hover:bg-surface3 transition-colors rounded-lg"
      >
        <div className="flex items-center gap-2">
          {isExpanded ? (
            <ChevronDown className="w-3 h-3 text-neutral3" />
          ) : (
            <ChevronRight className="w-3 h-3 text-neutral3" />
          )}
          <span className="text-xs font-medium text-neutral4">
            {historyRecord.originType === 'reflection' ? 'Reflection' : 'Observation'}
          </span>
          {historyRecord.observationTokenCount !== undefined && (
            <span className="text-xs text-neutral3">{formatTokens(historyRecord.observationTokenCount)} tokens</span>
          )}
        </div>
        <span className="text-xs text-neutral3">{formatRelativeTime(historyRecord.createdAt)}</span>
      </button>
      {isExpanded && (
        <div className="px-3 pb-3 max-h-48 overflow-y-auto border-t border-border1">
          {historyRecord.activeObservations ? (
            <ObservationRenderer observations={historyRecord.activeObservations} maxHeight={undefined} />
          ) : (
            <span className="text-xs text-neutral3 italic">No observations</span>
          )}
        </div>
      )}
    </div>
  );
}

function BackgroundProcessingStatus({ streamProgress }: { streamProgress: OmProgressData | null }) {
  if (!streamProgress) return null;

  const buffered = streamProgress.windows?.buffered;
  const observationChunks = buffered?.observations?.chunks ?? 0;
  const reflectionStatus = buffered?.reflection?.status;
  if (observationChunks === 0 && reflectionStatus !== 'running' && reflectionStatus !== 'complete') return null;

  return (
    <div className="mt-3 border border-border1 rounded-lg bg-surface3 overflow-hidden">
      <div className="px-3 py-2 space-y-1.5">
        <div className="text-[9px] text-neutral4 uppercase tracking-wider font-normal">Background Processing</div>
        {observationChunks > 0 && buffered?.observations && (
          <div className="flex items-center gap-2">
            <span
              className={`inline-block w-1.5 h-1.5 rounded-full shrink-0 ${buffered.observations.status === 'running' ? 'bg-blue-400 animate-pulse' : 'bg-green-500'}`}
            />
            <span className="text-[10px] text-neutral5">
              {observationChunks} buffered chunk{observationChunks !== 1 ? 's' : ''}
            </span>
            <span className="text-[10px] text-neutral3">
              ↓{formatTokens(buffered.observations.projectedMessageRemoval ?? 0)} msg on activate →{' '}
              {formatTokens(buffered.observations.observationTokens)} obs
            </span>
          </div>
        )}
        {reflectionStatus === 'running' && (
          <div className="flex items-center gap-2">
            <span className="inline-block w-1.5 h-1.5 rounded-full shrink-0 bg-purple-400 animate-pulse" />
            <span className="text-[10px] text-neutral5">Buffering reflection…</span>
          </div>
        )}
        {reflectionStatus === 'complete' && buffered?.reflection && (
          <div className="flex items-center gap-2">
            <span className="inline-block w-1.5 h-1.5 rounded-full shrink-0 bg-green-500" />
            <span className="text-[10px] text-neutral5">Reflection buffered</span>
            <span className="text-[10px] text-neutral3">
              {formatTokens(buffered.reflection.inputObservationTokens)} →{' '}
              {formatTokens(buffered.reflection.observationTokens)}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

interface AgentObservationalMemoryProps {
  agentId: string;
  resourceId: string;
  threadId?: string;
}

export const AgentObservationalMemory = ({ agentId, resourceId, threadId }: AgentObservationalMemoryProps) => {
  // Get real-time observation status and progress from streaming context
  const { isObservingFromStream, isReflectingFromStream, streamProgress, clearProgress } =
    useObservationalMemoryContext();

  // Clear progress when thread changes
  useEffect(() => {
    clearProgress();
  }, [threadId, clearProgress]);

  // streamProgress is intentionally retained across thread switches (for reload
  // display), so scope it to the current thread here — otherwise the bars keep
  // showing (and get "stuck" on) the previous thread's streamed token counts.
  const liveProgress = streamProgress?.threadId === threadId ? streamProgress : null;

  // Get OM config to get thresholds
  const { data: configData } = useMemoryConfig(agentId);

  // Get OM status to check if enabled (polls when observing/reflecting)
  const { data: statusData, isLoading: isStatusLoading } = useMemoryWithOMStatus({
    agentId,
    resourceId,
    threadId,
  });

  // Check if OM is actively observing/reflecting
  // The streaming context is the source of truth for active operations.
  // Server flags (isObserving/isReflecting) can be stale if process crashed mid-operation.
  // We only use server flags as a fallback when:
  // 1. lastObservedAt is recent (within 2 minutes), AND
  // 2. We're on a fresh page load (no stream context yet)
  const STALE_OBSERVATION_THRESHOLD_MS = 2 * 60 * 1000; // 2 minutes
  const serverLastObservedAt = statusData?.observationalMemory?.lastObservedAt;
  const isServerStatusStale = serverLastObservedAt
    ? Date.now() - new Date(serverLastObservedAt).getTime() > STALE_OBSERVATION_THRESHOLD_MS
    : true; // If no lastObservedAt, consider it stale

  // Stream context is the primary source of truth
  // Only fall back to server status if not stale AND no stream activity has been detected yet
  const hasHadStreamActivity = isObservingFromStream || isReflectingFromStream;
  const isObservingFromServer =
    !isServerStatusStale && !hasHadStreamActivity && (statusData?.observationalMemory?.isObserving || false);
  const isReflectingFromServer =
    !isServerStatusStale && !hasHadStreamActivity && (statusData?.observationalMemory?.isReflecting || false);
  const isObserving = isObservingFromStream || isObservingFromServer;
  const isReflecting = isReflectingFromStream || isReflectingFromServer;
  const isOMActive = isObserving || isReflecting;

  // Get OM record and history (polls when active)
  const { data: omData, isLoading: isOMLoading } = useObservationalMemory({
    agentId,
    resourceId,
    threadId,
    enabled: Boolean(statusData?.observationalMemory?.enabled),
    isActive: isOMActive,
  });

  const isLoading = isStatusLoading || isOMLoading;
  const isEnabled = statusData?.observationalMemory?.enabled ?? false;
  const record = omData?.record;

  // Extract threshold values - try multiple sources in priority order:
  // 1. Stream progress (real-time during streaming)
  // 2. Record config (from OM processor when added via input/output processors)
  // 3. Agent config endpoint (when OM is configured on agent)
  // 4. Sensible defaults
  const omAgentConfig = (
    configData?.config as {
      observationalMemory?: {
        enabled: boolean;
        model?: unknown;
        scope?: 'thread' | 'resource';
        messageTokens?: number | { min: number; max: number };
        observationTokens?: number | { min: number; max: number };
        observation?: {
          messageTokens?: number | { min: number; max: number };
          model?: string;
          routing?: Array<{ upTo: number; model: string }>;
        };
        reflection?: {
          observationTokens?: number | { min: number; max: number };
          model?: string;
          routing?: Array<{ upTo: number; model: string }>;
        };
        observationModel?: string;
        reflectionModel?: string;
        observationModelRouting?: Array<{ upTo: number; model: string }>;
        reflectionModelRouting?: Array<{ upTo: number; model: string }>;
      };
    }
  )?.observationalMemory;
  const recordConfig = record?.config as
    | {
        observation?: { messageTokens?: number; model?: string; routing?: Array<{ upTo: number; model: string }> };
        reflection?: { observationTokens?: number; model?: string; routing?: Array<{ upTo: number; model: string }> };
        observationModel?: string;
        reflectionModel?: string;
        observationModelRouting?: Array<{ upTo: number; model: string }>;
        reflectionModelRouting?: Array<{ upTo: number; model: string }>;
      }
    | undefined;

  const observationModelRouting =
    recordConfig?.observationModelRouting ??
    recordConfig?.observation?.routing ??
    omAgentConfig?.observationModelRouting ??
    omAgentConfig?.observation?.routing;
  const reflectionModelRouting =
    recordConfig?.reflectionModelRouting ??
    recordConfig?.reflection?.routing ??
    omAgentConfig?.reflectionModelRouting ??
    omAgentConfig?.reflection?.routing;

  // Extract model names from config
  const observationModel = getModelLabel(
    recordConfig?.observationModel ??
      recordConfig?.observation?.model ??
      omAgentConfig?.observationModel ??
      omAgentConfig?.model ??
      omAgentConfig?.observation?.model,
    observationModelRouting,
  );
  const reflectionModel = getModelLabel(
    recordConfig?.reflectionModel ??
      recordConfig?.reflection?.model ??
      omAgentConfig?.reflectionModel ??
      omAgentConfig?.model ??
      omAgentConfig?.reflection?.model,
    reflectionModelRouting,
  );

  // Check if adaptive mode is enabled (threshold is an object with min/max)
  const isAdaptiveMode = omAgentConfig?.messageTokens !== undefined && typeof omAgentConfig.messageTokens !== 'number';

  // Get total budget for adaptive mode (stored as max in message tokens threshold)
  const totalBudget = isAdaptiveMode ? getThresholdValue(omAgentConfig?.messageTokens, 30000) : 0;

  // Base thresholds (configured values, before adaptive adjustment)
  const baseMessageTokens = isAdaptiveMode ? getBaseThresholdValue(omAgentConfig?.messageTokens, 30000) : undefined;
  const baseObservationTokens = isAdaptiveMode
    ? getBaseThresholdValue(omAgentConfig?.observationTokens, 40000)
    : undefined;

  // Priority: streamProgress > recordConfig > agentConfig > defaults
  // For messages bar: use stream threshold (real-time effective) or total budget (max available)
  const messageTokensThreshold =
    liveProgress?.windows?.active?.messages?.threshold ??
    recordConfig?.observation?.messageTokens ??
    getThresholdValue(omAgentConfig?.messageTokens, 30000);

  // For observations bar: use the configured observation tokens threshold (not calculated remaining)
  // The adaptive logic is handled by the backend - UI just shows progress against configured threshold
  const configObservationTokens = getThresholdValue(omAgentConfig?.observationTokens, 40000);
  const observationTokensThreshold =
    liveProgress?.windows?.active?.observations?.threshold ??
    recordConfig?.reflection?.observationTokens ??
    configObservationTokens;

  // Use stream progress token counts when available (real-time), fallback to record
  const pendingMessageTokens = liveProgress?.windows?.active?.messages?.tokens ?? record?.pendingMessageTokens ?? 0;
  const observationTokenCount =
    liveProgress?.windows?.active?.observations?.tokens ?? record?.observationTokenCount ?? 0;

  // Show all previous observation records (exclude current active record), oldest first
  const previousObservations = useMemo(() => {
    return (omData?.history ?? [])
      .filter(h => h.id !== record?.id)
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  }, [omData?.history, record?.id]);

  // Format the observations for display
  const observations = useMemo(() => {
    if (!record?.activeObservations) return '';
    return record.activeObservations;
  }, [record]);

  // Keep the sidebar label aligned with the same live observation window tokens used by the progress bar.
  const tokenCount = observationTokenCount;

  const { isCopied, handleCopy } = useCopyToClipboard({
    text: observations,
    copyMessage: 'Observations copied!',
  });

  if (isLoading) {
    return (
      <div className="p-4">
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (!isEnabled) {
    return <ObservationalMemoryDisabled />;
  }

  return (
    <div className="p-4 overflow-hidden min-w-0 w-full">
      <ObservationalMemoryHeader />
      <ObservationalMemoryProgressBars
        pendingMessageTokens={pendingMessageTokens}
        messageTokensThreshold={messageTokensThreshold}
        isObserving={isObserving}
        observationModel={observationModel}
        observationModelRouting={observationModelRouting}
        baseMessageTokens={baseMessageTokens}
        totalBudget={totalBudget}
        observationTokenCount={observationTokenCount}
        observationTokensThreshold={observationTokensThreshold}
        isReflecting={isReflecting}
        baseObservationTokens={baseObservationTokens}
        reflectionModel={reflectionModel}
        reflectionModelRouting={reflectionModelRouting}
      />
      <ObservationsSection
        observations={observations}
        previousObservations={previousObservations}
        record={record}
        tokenCount={tokenCount}
        isCopied={isCopied}
        onCopy={handleCopy}
      />
      <BackgroundProcessingStatus streamProgress={liveProgress} />
    </div>
  );
};

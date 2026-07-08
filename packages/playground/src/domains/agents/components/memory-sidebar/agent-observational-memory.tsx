import { Button } from '@mastra/playground-ui/components/Button';
import { Skeleton } from '@mastra/playground-ui/components/Skeleton';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@mastra/playground-ui/components/Tooltip';
import { Brain, ExternalLink, Info } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import { getObservationWindowTokens } from './lib/observation-window';
import { useMemoryTimeline, useObservationalMemoryContext } from '@/domains/agents/context';
import { useObservationalMemory, useMemoryWithOMStatus, useMemoryConfig } from '@/domains/memory/hooks';

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

interface AgentObservationalMemoryProps {
  agentId: string;
  resourceId: string;
  threadId?: string;
}

export const AgentObservationalMemory = ({ agentId, resourceId, threadId }: AgentObservationalMemoryProps) => {
  // Get real-time observation status and progress from streaming context
  const { isPanelOpen: isDetailViewOpen, openPanel: openDetailView, closePanel: closeDetailView } = useMemoryTimeline();
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

  // Priority: streamProgress > recordConfig > agentConfig > defaults.
  // Shared with the timeline panel so both UIs derive identical token counts/thresholds.
  const {
    messageTokens: pendingMessageTokens,
    messageThreshold: messageTokensThreshold,
    observationTokens: observationTokenCount,
    observationThreshold: observationTokensThreshold,
  } = getObservationWindowTokens({ record, liveProgress, agentConfig: omAgentConfig });

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
      <Button
        size="sm"
        className="w-full justify-center gap-2"
        onClick={() => (isDetailViewOpen ? closeDetailView() : openDetailView())}
      >
        <Brain className="h-3.5 w-3.5" />
        Analyze Observations
      </Button>
    </div>
  );
};

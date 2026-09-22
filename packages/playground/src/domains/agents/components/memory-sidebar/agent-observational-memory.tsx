import { Button } from '@mastra/playground-ui/components/Button';
import { Skeleton } from '@mastra/playground-ui/components/Skeleton';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@mastra/playground-ui/components/Tooltip';
import { raisedSurfaceStyle } from '@mastra/playground-ui/primitives/raised-surface';
import { controlStateColorTransition } from '@mastra/playground-ui/primitives/transitions';
import { quietTextHover } from '@mastra/playground-ui/primitives/typography';
import { cn } from '@mastra/playground-ui/utils/cn';
import { Brain, ExternalLink, Info } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import { getObservationWindowTokens } from './lib/observation-window';
import { useMemoryTimeline, useObservationalMemoryContext } from '@/domains/agents/context';
import { useObservationalMemory, useMemoryWithOMStatus, useMemoryConfig } from '@/domains/memory/hooks';

const formatTokens = (n: number) => {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 100_000) return `${(n / 1000).toFixed(0)}k`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return Math.round(n).toString();
};

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
  baseThreshold?: number;
  totalBudget?: number;
}) => {
  const isAdaptive = baseThreshold !== undefined && totalBudget !== undefined;
  const percentage = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0;
  const barColor = getBarColor(percentage);
  const elapsed = useElapsedTime(isActive && percentage >= 100);
  const isProcessing = isActive && percentage >= 100;
  const activeText = label === 'Messages' ? 'observing' : 'reflecting';

  const showAdaptiveLabel = isAdaptive && percentage >= 100 && !isProcessing && baseThreshold && value < baseThreshold;

  const containerBg = isProcessing ? 'bg-transparent' : 'bg-muted';
  const fillColor = isProcessing ? 'bg-blue-500/10' : barColor;
  const textColor = isProcessing ? 'text-blue-600' : 'text-muted-foreground';
  const textColorFilled = isProcessing ? 'text-blue-600' : 'text-white';
  const tokenBg = isProcessing ? 'bg-blue-500/10' : 'bg-fill';
  const tokenTextColor = isProcessing ? 'text-blue-600' : 'text-muted-foreground';

  return (
    <div className="min-w-0 flex-1">
      <div className="mb-1 flex h-4 items-center gap-1">
        <span className="text-muted-foreground text-meta tracking-wider uppercase">{label}</span>
        <Tooltip>
          <TooltipTrigger asChild>
            <button type="button" className="inline-flex items-center justify-center">
              <Info className={cn('h-2.5 w-2.5 cursor-help', quietTextHover, controlStateColorTransition)} />
            </button>
          </TooltipTrigger>
          <TooltipContent side="top" className="max-w-xs">
            <div className="text-caption space-y-1.5">
              <div className="text-foreground font-medium">
                {label === 'Messages' ? 'Observer' : 'Reflector'} Settings
              </div>
              <div className="space-y-0.5">
                <div>
                  <span className="text-muted-foreground">Model:</span>{' '}
                  <span className="text-foreground">{model || 'not configured'}</span>
                </div>
                {modelRouting?.length ? (
                  <div>
                    <span className="text-muted-foreground">Routing:</span>
                    <div className="mt-0.5 space-y-0.5 pl-2">
                      {modelRouting.map(route => (
                        <div key={`${route.upTo}-${route.model}`} className="text-foreground">
                          ≤{formatTokens(route.upTo)} → {route.model}
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div>
                    <span className="text-muted-foreground">Threshold:</span>{' '}
                    <span className="text-foreground">{formatTokens(baseThreshold ?? max)} tokens</span>
                  </div>
                )}
                {isAdaptive && totalBudget && (
                  <div>
                    <span className="text-muted-foreground">Mode:</span>{' '}
                    <span className="text-amber-400">Adaptive</span>{' '}
                    <span className="text-muted-foreground">({formatTokens(totalBudget)} shared budget)</span>
                  </div>
                )}
              </div>
            </div>
          </TooltipContent>
        </Tooltip>
      </div>

      <div className="flex items-stretch">
        <div className={`relative h-5 flex-1 ${containerBg} overflow-hidden rounded-l`}>
          <div className={`h-full ${fillColor} transition-all`} style={{ width: `${percentage}%` }} />
          <span
            className={`absolute inset-0 flex items-center ${isProcessing ? 'justify-start pl-2' : 'justify-center'} text-meta ${textColor} pointer-events-none`}
          >
            {isProcessing
              ? `${activeText} ${elapsed.toFixed(1)}s`
              : showAdaptiveLabel
                ? 'adaptive'
                : `${Math.round(percentage)}%`}
          </span>
          <span
            className={`absolute inset-0 flex items-center ${isProcessing ? 'justify-start pl-2' : 'justify-center'} text-meta ${textColorFilled} pointer-events-none`}
            style={{ clipPath: `inset(0 ${100 - percentage}% 0 0)` }}
          >
            {isProcessing
              ? `${activeText} ${elapsed.toFixed(1)}s`
              : showAdaptiveLabel
                ? 'adaptive'
                : `${Math.round(percentage)}%`}
          </span>
        </div>

        <span
          className={`text-meta ${tokenTextColor} font-mono whitespace-nowrap tabular-nums ${tokenBg} -ml-px flex items-center gap-1 rounded-r px-1.5`}
        >
          {formatTokens(value)}
          <span className={isProcessing ? 'text-blue-500' : 'text-muted-foreground'}>/{formatTokens(max)}</span>
          {isAdaptive && totalBudget && (
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="cursor-help text-amber-400">({formatTokens(baseThreshold)})</span>
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-xs">
                <div className="text-caption">
                  <span className="text-amber-400">{formatTokens(baseThreshold)}</span>
                  <span className="text-muted-foreground"> is the configured threshold. </span>
                  <span className="text-foreground">
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
  <div className="mb-3 flex items-center gap-2">
    <Brain className="h-4 w-4 text-purple-400" />
    <h3 className="text-foreground text-subheading">Observational Memory</h3>
  </div>
);

const ObservationalMemoryDisabled = () => (
  <div className="p-4">
    <div className="mb-3 flex items-center gap-2">
      <Brain className="text-muted-foreground h-4 w-4" />
      <h3 className="text-foreground text-subheading">Observational Memory</h3>
    </div>
    <div className={cn(raisedSurfaceStyle, 'rounded-lg p-4')}>
      <p className="text-muted-foreground text-body mb-3">
        Observational Memory is not enabled for this agent. Enable it to automatically extract and maintain observations
        from conversations.
      </p>
      <a
        href="https://mastra.ai/en/docs/memory/observational-memory"
        target="_blank"
        rel="noopener noreferrer"
        className={cn(
          'text-body inline-flex items-center gap-2 text-blue-400 hover:text-blue-300',
          controlStateColorTransition,
        )}
      >
        Learn about Observational Memory
        <ExternalLink className="h-3 w-3" />
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
      <div className="mb-3 flex gap-3">
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
  const { isPanelOpen: isDetailViewOpen, openPanel: openDetailView, closePanel: closeDetailView } = useMemoryTimeline();
  const { isObservingFromStream, isReflectingFromStream, streamProgress, clearProgress } =
    useObservationalMemoryContext();

  useEffect(() => {
    clearProgress();
  }, [threadId, clearProgress]);

  // The provider retains progress across thread switches.
  const liveProgress = streamProgress?.threadId === threadId ? streamProgress : null;

  const { data: configData } = useMemoryConfig(agentId);

  const { data: statusData, isLoading: isStatusLoading } = useMemoryWithOMStatus({
    agentId,
    resourceId,
    threadId,
  });

  // Crashed operations can leave stale server flags.
  const STALE_OBSERVATION_THRESHOLD_MS = 2 * 60 * 1000;
  const serverLastObservedAt = statusData?.observationalMemory?.lastObservedAt;
  const isServerStatusStale = serverLastObservedAt
    ? Date.now() - new Date(serverLastObservedAt).getTime() > STALE_OBSERVATION_THRESHOLD_MS
    : true;

  const hasHadStreamActivity = isObservingFromStream || isReflectingFromStream;
  const isObservingFromServer =
    !isServerStatusStale && !hasHadStreamActivity && (statusData?.observationalMemory?.isObserving || false);
  const isReflectingFromServer =
    !isServerStatusStale && !hasHadStreamActivity && (statusData?.observationalMemory?.isReflecting || false);
  const isObserving = isObservingFromStream || isObservingFromServer;
  const isReflecting = isReflectingFromStream || isReflectingFromServer;
  const isOMActive = isObserving || isReflecting;

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

  const isAdaptiveMode = omAgentConfig?.messageTokens !== undefined && typeof omAgentConfig.messageTokens !== 'number';

  const totalBudget = isAdaptiveMode ? getThresholdValue(omAgentConfig?.messageTokens, 30000) : 0;

  const baseMessageTokens = isAdaptiveMode ? getBaseThresholdValue(omAgentConfig?.messageTokens, 30000) : undefined;
  const baseObservationTokens = isAdaptiveMode
    ? getBaseThresholdValue(omAgentConfig?.observationTokens, 40000)
    : undefined;

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
    <div className="w-full min-w-0 overflow-hidden p-4">
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
        className="w-full justify-center"
        onClick={() => (isDetailViewOpen ? closeDetailView() : openDetailView())}
        icon={<Brain />}
      >
        Analyze Observations
      </Button>
    </div>
  );
};

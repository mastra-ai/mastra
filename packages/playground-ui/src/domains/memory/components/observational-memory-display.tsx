import { Button } from '../../../ds/components/Button';
import { Skeleton } from '../../../ds/components/Skeleton';
import { InfoTooltip, Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../../../ds/components/Tooltip';
import { Txt } from '../../../ds/components/Txt';
import { IconBrain } from '../../../ds/icons/central/IconBrain';
import { IconSquareArrowTopRight } from '../../../ds/icons/central/IconSquareArrowTopRight';
import { raisedSurfaceStyle } from '../../../ds/primitives/raised-surface';
import { controlStateColorTransition } from '../../../ds/primitives/transitions';
import { useElapsedTime } from '../../../hooks/use-elapsed-time';
import { cn } from '../../../utils/cn';
import { formatElapsed } from '../../../utils/duration';

const formatTokens = (n: number) => {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 100_000) return `${(n / 1000).toFixed(0)}k`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return Math.round(n).toString();
};

const getBarColor = (percentage: number) => {
  if (percentage >= 60) return 'bg-info-indicator';
  return 'bg-success-indicator';
};

type ModelRouting = Array<{ upTo: number; model: string }>;

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
  const fillColor = isProcessing ? 'bg-info-subtle' : barColor;
  const textColor = isProcessing ? 'text-info-subtle-foreground' : 'text-muted-foreground';
  const textColorFilled = isProcessing ? 'text-info-subtle-foreground' : 'text-background';
  const tokenBg = isProcessing ? 'bg-info-subtle' : 'bg-fill';
  const tokenTextColor = isProcessing ? 'text-info-subtle-foreground' : 'text-muted-foreground';
  // The observer handles messages and the reflector handles observations.
  const settingsOwner = label === 'Messages' ? 'Observer' : 'Reflector';

  return (
    <div className="min-w-0 flex-1">
      <div className="mb-1 flex h-4 items-center gap-1">
        <Txt as="span" variant="meta" tone="muted" className="uppercase">
          {label}
        </Txt>
        <InfoTooltip aria-label={`${settingsOwner} settings`} contentClassName="max-w-xs">
          <div className="space-y-1.5">
            <Txt as="p" variant="column" tone="ink">
              {settingsOwner} Settings
            </Txt>
            <div className="space-y-0.5">
              <Txt as="p" variant="caption">
                <span className="text-muted-foreground">Model:</span>{' '}
                <span className="text-foreground">{model || 'not configured'}</span>
              </Txt>
              {modelRouting?.length ? (
                <div>
                  <Txt as="span" variant="caption" tone="muted">
                    Routing:
                  </Txt>
                  <div className="mt-0.5 space-y-0.5 pl-2">
                    {modelRouting.map(route => (
                      <Txt as="p" variant="caption" tone="ink" key={`${route.upTo}-${route.model}`}>
                        ≤{formatTokens(route.upTo)} → {route.model}
                      </Txt>
                    ))}
                  </div>
                </div>
              ) : (
                <Txt as="p" variant="caption">
                  <span className="text-muted-foreground">Threshold:</span>{' '}
                  <span className="text-foreground">{formatTokens(baseThreshold ?? max)} tokens</span>
                </Txt>
              )}
              {isAdaptive && totalBudget && (
                <Txt as="p" variant="caption">
                  <span className="text-muted-foreground">Mode:</span>{' '}
                  <span className="text-badge-amber-indicator">Adaptive</span>{' '}
                  <span className="text-muted-foreground">({formatTokens(totalBudget)} shared budget)</span>
                </Txt>
              )}
            </div>
          </div>
        </InfoTooltip>
      </div>

      <div className="flex items-stretch">
        <div className={`relative h-5 flex-1 ${containerBg} overflow-hidden rounded-l`}>
          <div className={`h-full ${fillColor} transition-all`} style={{ width: `${percentage}%` }} />
          <Txt
            as="span"
            variant="meta"
            className={`absolute inset-0 flex items-center ${isProcessing ? 'justify-start pl-2' : 'justify-center'} ${textColor} pointer-events-none`}
          >
            {isProcessing ? (
              <>
                {activeText}{' '}
                <Txt as="span" variant="meta" font="mono">
                  {formatElapsed(elapsed)}
                </Txt>
              </>
            ) : showAdaptiveLabel ? (
              'adaptive'
            ) : (
              `${Math.round(percentage)}%`
            )}
          </Txt>
          <Txt
            as="span"
            variant="meta"
            className={`absolute inset-0 flex items-center ${isProcessing ? 'justify-start pl-2' : 'justify-center'} ${textColorFilled} pointer-events-none`}
            style={{ clipPath: `inset(0 ${100 - percentage}% 0 0)` }}
          >
            {isProcessing ? (
              <>
                {activeText}{' '}
                <Txt as="span" variant="meta" font="mono">
                  {formatElapsed(elapsed)}
                </Txt>
              </>
            ) : showAdaptiveLabel ? (
              'adaptive'
            ) : (
              `${Math.round(percentage)}%`
            )}
          </Txt>
        </div>

        <span
          className={` ${tokenTextColor} whitespace-nowrap tabular-nums ${tokenBg} -ml-px flex items-center gap-1 rounded-r px-1.5`}
        >
          <Txt as="span" variant="meta">
            {formatTokens(value)}
          </Txt>
          <Txt
            as="span"
            variant="meta"
            tone={isProcessing ? undefined : 'muted'}
            className={isProcessing ? 'text-info-indicator' : undefined}
          >
            /{formatTokens(max)}
          </Txt>
          {isAdaptive && totalBudget && (
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="cursor-help text-badge-amber-indicator">
                  <Txt as="span" variant="meta">
                    ({formatTokens(baseThreshold)})
                  </Txt>
                </span>
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-xs">
                <Txt as="p" variant="caption">
                  <span className="text-badge-amber-indicator">{formatTokens(baseThreshold)}</span>
                  <span className="text-muted-foreground"> is the configured threshold. </span>
                  <span className="text-foreground">
                    Adaptive mode shares a {formatTokens(totalBudget)} token budget between messages and observations.
                  </span>
                </Txt>
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
    <IconBrain className="size-icon-md text-badge-purple-indicator" />
    <Txt as="h3" variant="subheading" tone="ink">
      Observational Memory
    </Txt>
  </div>
);

const ObservationalMemoryDisabled = () => (
  <div className="p-4">
    <div className="mb-3 flex items-center gap-2">
      <IconBrain className="size-icon-md text-muted-foreground" />
      <Txt as="h3" variant="subheading" tone="ink">
        Observational Memory
      </Txt>
    </div>
    <div className={cn(raisedSurfaceStyle, 'rounded-lg p-4')}>
      <Txt tone="muted" className="mb-3">
        Observational Memory is not enabled for this agent. Enable it to automatically extract and maintain observations
        from conversations.
      </Txt>
      <a
        href="https://mastra.ai/en/docs/memory/observational-memory"
        target="_blank"
        rel="noopener noreferrer"
        className={cn(
          'inline-flex items-center gap-2 text-info-indicator hover:underline',
          controlStateColorTransition,
        )}
      >
        <Txt as="span" variant="body" className="block">
          Learn about Observational Memory
        </Txt>
        <IconSquareArrowTopRight className="size-icon-xs" />
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

export interface ObservationalMemoryDisplayProps {
  isLoading: boolean;
  isEnabled: boolean;
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
  onAnalyze: () => void;
}

export function ObservationalMemoryDisplay({
  isLoading,
  isEnabled,
  onAnalyze,
  ...progress
}: ObservationalMemoryDisplayProps) {
  if (isLoading)
    return (
      <div className="p-4">
        <Skeleton className="h-32 w-full" />
      </div>
    );
  if (!isEnabled) return <ObservationalMemoryDisabled />;
  return (
    <div className="w-full min-w-0 overflow-hidden p-4">
      <ObservationalMemoryHeader />
      <ObservationalMemoryProgressBars {...progress} />
      <Button size="sm" className="w-full justify-center" onClick={onAnalyze} icon={<IconBrain />}>
        Analyze observations
      </Button>
    </div>
  );
}

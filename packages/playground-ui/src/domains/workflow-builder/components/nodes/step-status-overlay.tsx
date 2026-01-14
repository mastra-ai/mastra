import { Loader2, CheckCircle, XCircle, PauseCircle, SkipForward, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTestRunnerStore, type StepStatus } from '../../store/test-runner-store';

// ============================================================================
// Props
// ============================================================================

export interface StepStatusOverlayProps {
  stepId: string;
  /** Position of the status indicator */
  position?: 'top-right' | 'bottom-right' | 'inline';
  /** Show duration if available */
  showDuration?: boolean;
  /** Show AI metrics if available */
  showAiMetrics?: boolean;
}

// ============================================================================
// Status Config
// ============================================================================

const STATUS_CONFIG: Record<
  StepStatus,
  {
    icon: typeof Loader2;
    color: string;
    bgColor: string;
    label: string;
    animate?: boolean;
  }
> = {
  pending: {
    icon: Clock,
    color: 'text-icon3',
    bgColor: 'bg-surface4',
    label: 'Pending',
  },
  running: {
    icon: Loader2,
    color: 'text-blue-400',
    bgColor: 'bg-blue-500/20',
    label: 'Running',
    animate: true,
  },
  completed: {
    icon: CheckCircle,
    color: 'text-green-400',
    bgColor: 'bg-green-500/20',
    label: 'Completed',
  },
  failed: {
    icon: XCircle,
    color: 'text-red-400',
    bgColor: 'bg-red-500/20',
    label: 'Failed',
  },
  suspended: {
    icon: PauseCircle,
    color: 'text-amber-400',
    bgColor: 'bg-amber-500/20',
    label: 'Waiting',
  },
  skipped: {
    icon: SkipForward,
    color: 'text-icon3',
    bgColor: 'bg-surface4',
    label: 'Skipped',
  },
};

// ============================================================================
// Helper Functions
// ============================================================================

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60000).toFixed(1)}m`;
}

function formatTokens(tokens: number): string {
  if (tokens < 1000) return tokens.toString();
  return `${(tokens / 1000).toFixed(1)}k`;
}

function formatCost(cost: number): string {
  if (cost < 0.01) return `<$0.01`;
  return `$${cost.toFixed(2)}`;
}

// ============================================================================
// Main Component
// ============================================================================

export function StepStatusOverlay({
  stepId,
  position = 'top-right',
  showDuration = true,
  showAiMetrics = true,
}: StepStatusOverlayProps) {
  const currentRun = useTestRunnerStore(state => state.currentRun);
  const stepResult = currentRun?.steps[stepId];

  // Don't show if no run or step hasn't been touched
  if (!currentRun || !stepResult) return null;

  const config = STATUS_CONFIG[stepResult.status];
  const Icon = config.icon;

  // Position styles
  const positionStyles: Record<string, string> = {
    'top-right': 'absolute -top-2 -right-2 z-20',
    'bottom-right': 'absolute -bottom-2 -right-2 z-20',
    inline: 'inline-flex',
  };

  return (
    <div className={cn('flex items-center gap-1', positionStyles[position])}>
      {/* Status Badge */}
      <div
        className={cn(
          'flex items-center gap-1 px-2 py-1 rounded-full',
          config.bgColor,
          'border border-border1 shadow-sm',
        )}
        title={`${config.label}${stepResult.error ? `: ${stepResult.error}` : ''}`}
      >
        <Icon className={cn('w-3.5 h-3.5', config.color, config.animate && 'animate-spin')} />

        {/* Duration */}
        {showDuration && stepResult.durationMs && stepResult.status !== 'running' && (
          <span className="text-[10px] text-icon4 font-mono">{formatDuration(stepResult.durationMs)}</span>
        )}
      </div>

      {/* AI Metrics (separate badge) */}
      {showAiMetrics && stepResult.aiMetrics && stepResult.status === 'completed' && (
        <div
          className={cn(
            'flex items-center gap-1.5 px-2 py-1 rounded-full',
            'bg-purple-500/20 border border-purple-500/30 shadow-sm',
          )}
          title={`Model: ${stepResult.aiMetrics.model || 'Unknown'}`}
        >
          {stepResult.aiMetrics.totalTokens && (
            <span className="text-[10px] text-purple-300 font-mono">
              {formatTokens(stepResult.aiMetrics.totalTokens)} tok
            </span>
          )}
          {stepResult.aiMetrics.cost && (
            <span className="text-[10px] text-purple-300 font-mono">{formatCost(stepResult.aiMetrics.cost)}</span>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Progress Ring (alternative visualization)
// ============================================================================

export interface ProgressRingProps {
  stepId: string;
  size?: number;
  strokeWidth?: number;
}

export function StepProgressRing({ stepId, size = 24, strokeWidth = 2 }: ProgressRingProps) {
  const currentRun = useTestRunnerStore(state => state.currentRun);
  const stepResult = currentRun?.steps[stepId];

  if (!currentRun || !stepResult) return null;

  const config = STATUS_CONFIG[stepResult.status];
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;

  // For running status, show indeterminate animation
  // For completed/failed, show full ring
  const isIndeterminate = stepResult.status === 'running';
  const progress = stepResult.status === 'completed' || stepResult.status === 'failed' ? 100 : 0;
  const offset = circumference - (progress / 100) * circumference;

  const colorMap: Record<StepStatus, string> = {
    pending: '#6b7280',
    running: '#3b82f6',
    completed: '#22c55e',
    failed: '#ef4444',
    suspended: '#f59e0b',
    skipped: '#6b7280',
  };

  return (
    <svg width={size} height={size} className={cn(isIndeterminate && 'animate-spin')}>
      {/* Background circle */}
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        className="text-surface4"
      />
      {/* Progress circle */}
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke={colorMap[stepResult.status]}
        strokeWidth={strokeWidth}
        strokeDasharray={circumference}
        strokeDashoffset={isIndeterminate ? circumference * 0.75 : offset}
        strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        className="transition-all duration-300"
      />
    </svg>
  );
}

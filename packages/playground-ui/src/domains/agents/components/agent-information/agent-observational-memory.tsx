import { useState, useMemo } from 'react';
import { Skeleton } from '@/ds/components/Skeleton';
import { ChevronRight, ChevronDown, Brain, ExternalLink } from 'lucide-react';
import { ScrollArea } from '@/ds/components/ScrollArea';
import { useCopyToClipboard } from '@/hooks/use-copy-to-clipboard';
import { useObservationalMemory, useMemoryWithOMStatus, useMemoryConfig } from '@/domains/memory/hooks';
import { useObservationalMemoryContext } from '@/domains/agents/context';
import { ObservationRenderer } from '@/lib/ai-ui/tools/badges/observation-renderer';

// Progress bar component with improved styling
const ProgressBar = ({ 
  value, 
  max, 
  label, 
  colorClass = 'bg-purple-500',
  glowClass = ''
}: { 
  value: number; 
  max: number; 
  label: string;
  colorClass?: string;
  glowClass?: string;
}) => {
  const percentage = Math.min(100, Math.max(0, (value / max) * 100));
  const formatTokens = (n: number) => {
    if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
    return n.toString();
  };
  
  return (
    <div className="flex items-center gap-3">
      {/* Label on left */}
      <span className="text-xs text-neutral4 whitespace-nowrap min-w-[90px]">{label}</span>
      
      {/* Progress bar in middle */}
      <div className="flex-1 h-2 bg-surface2 rounded-full overflow-hidden">
        <div 
          className={`h-full ${colorClass} ${glowClass} transition-all duration-300 ease-out rounded-full`}
          style={{ width: `${percentage}%` }}
        />
      </div>
      
      {/* Tokens + percentage on right */}
      <span className="text-xs text-neutral3 whitespace-nowrap tabular-nums">
        {formatTokens(value)}/{formatTokens(max)} ({Math.round(percentage)}%)
      </span>
    </div>
  );
};

interface AgentObservationalMemoryProps {
  agentId: string;
  resourceId: string;
  threadId?: string;
}

export const AgentObservationalMemory = ({ agentId, resourceId, threadId }: AgentObservationalMemoryProps) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const [showHistory, setShowHistory] = useState(false);

  // Get real-time observation status and progress from streaming context
  const { isObservingFromStream, streamProgress } = useObservationalMemoryContext();

  // Get OM config to get thresholds
  const { data: configData } = useMemoryConfig(agentId);

  // Get OM status to check if enabled (polls when observing/reflecting)
  const { data: statusData, isLoading: isStatusLoading } = useMemoryWithOMStatus({
    agentId,
    resourceId,
    threadId,
  });

  // Check if OM is actively observing/reflecting (from server status OR streaming)
  const isObservingFromServer = statusData?.observationalMemory?.isObserving || false;
  const isReflecting = statusData?.observationalMemory?.isReflecting || false;
  const isOMActive = isObservingFromStream || isObservingFromServer || isReflecting;

  // Get OM record and history (polls when active)
  const {
    data: omData,
    isLoading: isOMLoading,
  } = useObservationalMemory({
    agentId,
    resourceId,
    threadId,
    enabled: Boolean(statusData?.observationalMemory?.enabled),
    isActive: isOMActive,
  });

  const isLoading = isStatusLoading || isOMLoading;
  const isEnabled = statusData?.observationalMemory?.enabled ?? false;
  const record = omData?.record;
  const history = omData?.history ?? [];

  // Extract threshold values from config (handle both number and {min, max} formats)
  // The config response includes observationalMemory when OM is enabled
  const omConfig = (configData?.config as { observationalMemory?: {
    enabled: boolean;
    scope?: 'thread' | 'resource';
    observationThreshold?: number | { min: number; max: number };
    reflectionThreshold?: number | { min: number; max: number };
  }})?.observationalMemory;
  const getThresholdValue = (threshold: number | { min: number; max: number } | undefined, defaultValue: number) => {
    if (!threshold) return defaultValue;
    if (typeof threshold === 'number') return threshold;
    return threshold.max; // Use max for progress display
  };
  // Use stream progress thresholds when available (real-time), fallback to config
  const observationThreshold = streamProgress?.threshold ?? getThresholdValue(omConfig?.observationThreshold, 10000);
  const reflectionThreshold = streamProgress?.reflectionThreshold ?? getThresholdValue(omConfig?.reflectionThreshold, 30000);

  // Use stream progress token counts when available (real-time), fallback to record
  const pendingMessageTokens = streamProgress?.pendingTokens ?? record?.pendingMessageTokens ?? 0;
  const observationTokenCount = streamProgress?.observationTokens ?? record?.observationTokenCount ?? 0;

  // Only show history if there are reflected records (more than just the current active one)
  const reflectedHistory = useMemo(() => {
    return history.filter(h => h.originType === 'reflection');
  }, [history]);

  // Format the observations for display
  const observations = useMemo(() => {
    if (!record?.activeObservations) return '';
    return record.activeObservations;
  }, [record]);

  const hasObservations = Boolean(observations);
  const tokenCount = statusData?.observationalMemory?.tokenCount;

  const { isCopied, handleCopy } = useCopyToClipboard({
    text: observations,
    copyMessage: 'Observations copied!',
  });

  // Format relative time
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

  if (isLoading) {
    return (
      <div className="p-4">
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (!isEnabled) {
    return (
      <div className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <Brain className="w-4 h-4 text-neutral3" />
          <h3 className="text-sm font-medium text-neutral5">Observational Memory</h3>
        </div>
        <div className="bg-surface3 border border-border1 rounded-lg p-4">
          <p className="text-sm text-neutral3 mb-3">
            Observational Memory is not enabled for this agent. Enable it to automatically extract and maintain
            observations from conversations.
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
  }

  // Determine the status label to show in header
  const isObserving = isObservingFromStream || isObservingFromServer;

  return (
    <div className="p-4">
      {/* Header */}
      <div className="flex items-center gap-2 mb-3">
        <Brain className="w-4 h-4 text-purple-400" />
        <h3 className="text-sm font-medium text-neutral5">Observational Memory</h3>
        {/* Status label in header */}
        {isObserving ? (
          <span className="text-xs font-medium px-2 py-0.5 rounded bg-yellow-500/20 text-yellow-400 animate-pulse">
            memorizing
          </span>
        ) : isReflecting ? (
          <span className="text-xs font-medium px-2 py-0.5 rounded bg-blue-500/20 text-blue-400 animate-pulse">
            reflecting
          </span>
        ) : hasObservations ? (
          <span className="text-xs font-medium px-2 py-0.5 rounded bg-purple-500/20 text-purple-400">
            active
          </span>
        ) : null}
      </div>

      {/* Progress Bars for Thresholds */}
      <div className="space-y-2.5 mb-3">
        <ProgressBar
          value={pendingMessageTokens}
          max={observationThreshold}
          label="Next observation"
          colorClass={isObserving ? 'bg-yellow-500' : 'bg-purple-500'}
          glowClass={isObserving ? 'shadow-[0_0_8px_rgba(234,179,8,0.5)]' : ''}
        />
        {hasObservations && (
          <ProgressBar
            value={observationTokenCount}
            max={reflectionThreshold}
            label="Next reflection"
            colorClass={isReflecting ? 'bg-blue-500' : 'bg-purple-500/60'}
            glowClass={isReflecting ? 'shadow-[0_0_8px_rgba(59,130,246,0.5)]' : ''}
          />
        )}
      </div>

      {/* No observations message - show when no observations exist */}
      {!hasObservations && (
        <p className="text-sm text-neutral3">
          No observations yet, start a conversation to begin building memory.
        </p>
      )}

      {/* Observations Content */}
      {hasObservations && (
        <div className="space-y-3">
          {/* Collapsible Observations Section */}
          <div className="border border-border1 rounded-lg bg-surface3">
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="w-full px-3 py-2 flex items-center justify-between hover:bg-surface4 transition-colors rounded-t-lg"
            >
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-neutral5">Observations</span>
                {tokenCount !== undefined && (
                  <span className="text-xs text-neutral3">
                    {tokenCount.toLocaleString()} tokens
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-neutral3">
                  {record?.lastObservedAt 
                    ? formatRelativeTime(record.lastObservedAt)
                    : record?.updatedAt 
                      ? formatRelativeTime(record.updatedAt)
                      : ''}
                </span>
                {isExpanded ? (
                  <ChevronDown className="w-3 h-3 text-neutral3" />
                ) : (
                  <ChevronRight className="w-3 h-3 text-neutral3" />
                )}
              </div>
            </button>
            {isExpanded && (
              <div className="border-t border-border1 overflow-hidden" style={{ height: '400px' }}>
                <ScrollArea className="h-full" autoScroll>
                  <div
                    className="p-3 cursor-pointer hover:bg-surface4/20 transition-colors relative group text-ui-xs"
                    onClick={handleCopy}
                  >
                    <ObservationRenderer observations={observations} maxHeight={undefined} />
                    {isCopied && (
                      <span className="absolute top-2 right-2 text-ui-xs px-1.5 py-0.5 rounded-full bg-green-500/20 text-green-500">
                        Copied!
                      </span>
                    )}
                    <span className="absolute top-2 right-2 text-ui-xs px-1.5 py-0.5 rounded-full bg-surface3 text-neutral4 opacity-0 group-hover:opacity-100 transition-opacity">
                      Click to copy
                    </span>
                  </div>
                </ScrollArea>
              </div>
            )}
          </div>

          {/* History Toggle - only show if there are reflected records */}
          {reflectedHistory.length > 0 && (
            <div className="border-t border-border1 pt-3">
              <button
                onClick={() => setShowHistory(!showHistory)}
                className="flex items-center gap-2 text-xs text-neutral3 hover:text-neutral5 transition-colors"
              >
                {showHistory ? (
                  <ChevronDown className="w-3 h-3" />
                ) : (
                  <ChevronRight className="w-3 h-3" />
                )}
                <span>Previous reflections ({reflectedHistory.length})</span>
              </button>
              {showHistory && (
                <div className="mt-2 space-y-2">
                  {reflectedHistory.map((historyRecord) => (
                    <div key={historyRecord.id} className="border border-border1 rounded-lg bg-surface2">
                      <div className="px-3 py-2 border-b border-border1 flex items-center justify-between">
                        <span className="text-xs font-medium text-neutral4">Reflection</span>
                        <span className="text-xs text-neutral3">{formatRelativeTime(historyRecord.createdAt)}</span>
                      </div>
                      <div className="p-3 max-h-48 overflow-y-auto">
                        {historyRecord.activeObservations ? (
                          <ObservationRenderer 
                            observations={historyRecord.activeObservations} 
                            maxHeight={undefined}
                            className="text-neutral3"
                          />
                        ) : (
                          <span className="text-xs text-neutral3 italic">No observations</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

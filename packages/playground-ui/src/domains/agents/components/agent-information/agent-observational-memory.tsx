import { useState, useMemo, useEffect, useRef } from 'react';
import { Skeleton } from '@/ds/components/Skeleton';
import { ChevronRight, ChevronDown, Brain, ExternalLink } from 'lucide-react';
import { ScrollArea } from '@/ds/components/ScrollArea';
import { useCopyToClipboard } from '@/hooks/use-copy-to-clipboard';
import { useObservationalMemory, useMemoryWithOMStatus, useMemoryConfig } from '@/domains/memory/hooks';
import { useObservationalMemoryContext } from '@/domains/agents/context';
import { ObservationRenderer } from '@/lib/ai-ui/tools/badges/observation-renderer';

// Format tokens helper
const formatTokens = (n: number) => {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return n.toString();
};

// Get bar color based on percentage: green 0-60%, blue 60%+
const getBarColor = (percentage: number) => {
  if (percentage >= 60) return 'bg-blue-500';
  return 'bg-green-500';
};

// Hook to track elapsed time when active
const useElapsedTime = (isActive: boolean) => {
  const [elapsed, setElapsed] = useState(0);
  const startTimeRef = useRef<number | null>(null);

  useEffect(() => {
    if (isActive) {
      startTimeRef.current = Date.now();
      setElapsed(0);
      const interval = setInterval(() => {
        if (startTimeRef.current) {
          setElapsed((Date.now() - startTimeRef.current) / 1000);
        }
      }, 100);
      return () => clearInterval(interval);
    } else {
      startTimeRef.current = null;
      setElapsed(0);
    }
  }, [isActive]);

  return elapsed;
};

// Progress bar component with percent label inside bar
const ProgressBar = ({ 
  value, 
  max, 
  label,
  isActive = false
}: { 
  value: number; 
  max: number; 
  label: string;
  isActive?: boolean;
}) => {
  const percentage = Math.min(100, Math.max(0, (value / max) * 100));
  const barColor = getBarColor(percentage);
  const elapsed = useElapsedTime(isActive && percentage >= 100);
  const isProcessing = isActive && percentage >= 100;
  const activeText = label === 'Messages' ? 'observing' : 'reflecting';
  
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
      <div className="flex items-center gap-1.5 mb-1 h-4">
        <span className="text-[9px] text-neutral4 uppercase tracking-wider font-normal">{label}</span>
      </div>
      
      <div className="flex items-stretch">
        {/* Progress bar with percentage inside */}
        <div className={`relative flex-1 h-5 ${containerBg} rounded-l overflow-hidden`}>
          <div 
            className={`h-full ${fillColor} transition-all`}
            style={{ width: `${percentage}%` }}
          />
          <span 
            className={`absolute inset-0 flex items-center ${isProcessing ? 'justify-start pl-2' : 'justify-center'} text-[10px] font-medium ${textColor} pointer-events-none`}
          >
            {isProcessing ? `${activeText} ${elapsed.toFixed(1)}s` : `${Math.round(percentage)}%`}
          </span>
          <span 
            className={`absolute inset-0 flex items-center ${isProcessing ? 'justify-start pl-2' : 'justify-center'} text-[10px] font-medium ${textColorFilled} pointer-events-none`}
            style={{ clipPath: `inset(0 ${100 - percentage}% 0 0)` }}
          >
            {isProcessing ? `${activeText} ${elapsed.toFixed(1)}s` : `${Math.round(percentage)}%`}
          </span>
        </div>
        
        {/* Token count connected to bar */}
        <span className={`text-[10px] ${tokenTextColor} tabular-nums whitespace-nowrap font-mono ${tokenBg} px-1.5 flex items-center rounded-r -ml-px`}>
          {formatTokens(value)}<span className={isProcessing ? 'text-blue-500' : 'text-neutral4'}>/{formatTokens(max)}</span>
        </span>
      </div>
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
  const { isObservingFromStream, streamProgress, clearProgress } = useObservationalMemoryContext();

  // Clear progress when thread changes
  useEffect(() => {
    clearProgress();
  }, [threadId, clearProgress]);

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

      </div>

      {/* Progress Bars for Thresholds - Side by side */}
      <div className="flex gap-3 mb-3">
        <ProgressBar
          value={pendingMessageTokens}
          max={observationThreshold}
          label="Messages"
          isActive={isObserving}
        />
        <ProgressBar
          value={observationTokenCount}
          max={reflectionThreshold}
          label="Observations"
          isActive={isReflecting}
        />
      </div>

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

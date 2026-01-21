import { useState, useMemo } from 'react';
import { Skeleton } from '@/ds/components/Skeleton';
import { ChevronRight, ChevronDown, Brain, Clock, RefreshCcw, ExternalLink } from 'lucide-react';
import { ScrollArea } from '@/ds/components/ScrollArea';
import { MarkdownRenderer } from '@/ds/components/MarkdownRenderer';
import { useCopyToClipboard } from '@/hooks/use-copy-to-clipboard';
import { useObservationalMemory, useMemoryWithOMStatus } from '@/domains/memory/hooks';
import { Button } from '@/ds/components/Button/Button';
import { useQueryClient } from '@tanstack/react-query';

interface AgentObservationalMemoryProps {
  agentId: string;
  resourceId: string;
  threadId?: string;
}

export const AgentObservationalMemory = ({ agentId, resourceId, threadId }: AgentObservationalMemoryProps) => {
  const queryClient = useQueryClient();
  const [isExpanded, setIsExpanded] = useState(true);
  const [showHistory, setShowHistory] = useState(false);

  // Get OM status to check if enabled (polls when observing/reflecting)
  const { data: statusData, isLoading: isStatusLoading } = useMemoryWithOMStatus({
    agentId,
    resourceId,
    threadId,
  });

  // Check if OM is actively observing/reflecting
  const isOMActive = statusData?.observationalMemory?.isObserving || statusData?.observationalMemory?.isReflecting || false;

  // Get OM record and history (polls when active)
  const {
    data: omData,
    isLoading: isOMLoading,
    refetch,
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

  // Format the observations for display
  const observations = useMemo(() => {
    if (!record?.activeObservations) return '';
    return record.activeObservations;
  }, [record]);

  const { isCopied, handleCopy } = useCopyToClipboard({
    text: observations,
    copyMessage: 'Observations copied!',
  });

  // Format dates for display
  const formatDate = (date: Date | string | null | undefined) => {
    if (!date) return 'Never';
    const d = new Date(date);
    return d.toLocaleString();
  };

  // Handle refresh
  const handleRefresh = () => {
    refetch();
    queryClient.invalidateQueries({ queryKey: ['memory-status', agentId, resourceId, threadId] });
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

  return (
    <div className="p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Brain className="w-4 h-4 text-purple-400" />
          <h3 className="text-sm font-medium text-neutral5">Observational Memory</h3>
          {record && (
            <span className="text-xs font-medium px-2 py-0.5 rounded bg-purple-500/20 text-purple-400">
              {record.originType === 'reflection' ? 'Reflected' : 'Active'}
            </span>
          )}
        </div>
        <Button variant="ghost" size="sm" onClick={handleRefresh} className="h-7 px-2">
          <RefreshCcw className="w-3 h-3" />
        </Button>
      </div>

      {/* Status Info */}
      {statusData?.observationalMemory && (
        <div className="flex flex-wrap gap-2 mb-3">
          {statusData.observationalMemory.isObserving && (
            <span className="text-xs font-medium px-2 py-0.5 rounded bg-yellow-500/20 text-yellow-400 animate-pulse">
              Observing...
            </span>
          )}
          {statusData.observationalMemory.isReflecting && (
            <span className="text-xs font-medium px-2 py-0.5 rounded bg-blue-500/20 text-blue-400 animate-pulse">
              Reflecting...
            </span>
          )}
          {statusData.observationalMemory.tokenCount !== undefined && (
            <span className="text-xs text-neutral3">
              {statusData.observationalMemory.tokenCount.toLocaleString()} tokens
            </span>
          )}
        </div>
      )}

      {/* Observations Content */}
      {record ? (
        <div className="space-y-3">
          {/* Collapsible Observations Section */}
          <div className="border border-border1 rounded-lg bg-surface3">
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="w-full px-3 py-2 flex items-center justify-between hover:bg-surface4 transition-colors rounded-t-lg"
            >
              <span className="text-xs font-medium text-neutral5">Active Observations</span>
              {isExpanded ? (
                <ChevronDown className="w-3 h-3 text-neutral3" />
              ) : (
                <ChevronRight className="w-3 h-3 text-neutral3" />
              )}
            </button>
            {isExpanded && (
              <div className="border-t border-border1" style={{ height: '300px' }}>
                <ScrollArea className="h-full">
                  <div
                    className="p-3 cursor-pointer hover:bg-surface4/20 transition-colors relative group text-ui-xs"
                    onClick={handleCopy}
                  >
                    {observations ? (
                      <MarkdownRenderer>{observations}</MarkdownRenderer>
                    ) : (
                      <p className="text-neutral3 italic">No observations yet</p>
                    )}
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

          {/* Timestamps */}
          <div className="flex flex-col gap-1 text-xs text-neutral3">
            <div className="flex items-center gap-2">
              <Clock className="w-3 h-3" />
              <span>Last observed: {formatDate(record.lastObservedAt)}</span>
            </div>
            <div className="flex items-center gap-2 ml-5">
              <span>Created: {formatDate(record.createdAt)}</span>
            </div>
          </div>

          {/* History Toggle */}
          {history.length > 0 && (
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
                <span>View history ({history.length} previous generations)</span>
              </button>
              {showHistory && (
                <div className="mt-2 space-y-2">
                  {history.map((historyRecord) => (
                    <div key={historyRecord.id} className="border border-border1 rounded-lg bg-surface2 p-3">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-medium text-neutral4">
                          {historyRecord.originType === 'reflection' ? 'Reflected' : 'Observed'}
                        </span>
                        <span className="text-xs text-neutral3">{formatDate(historyRecord.createdAt)}</span>
                      </div>
                      <div className="text-xs text-neutral3 max-h-24 overflow-hidden">
                        {historyRecord.activeObservations?.substring(0, 200)}
                        {(historyRecord.activeObservations?.length ?? 0) > 200 && '...'}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      ) : (
        <div className="bg-surface3 border border-border1 rounded-lg p-4">
          <p className="text-sm text-neutral3">
            No observations yet. Start a conversation to begin building observational memory.
          </p>
        </div>
      )}
    </div>
  );
};

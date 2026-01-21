import { useState } from 'react';
import { Brain, XCircle, Loader2, ChevronDown, ChevronRight } from 'lucide-react';
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
  durationMs?: number;
  error?: string;
  recordId?: string;
  cycleId?: string;
  threadId?: string;
  threadIds?: string[];
  _state?: 'loading' | 'complete' | 'failed';
  config?: {
    scope?: string;
    observationThreshold?: number;
    reflectionThreshold?: number;
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
  return String(tokens);
};

/**
 * Renders an inline badge for OM observation markers.
 * These are converted from data-om-* parts to tool-call format for assistant-ui compatibility.
 */
export const ObservationMarkerBadge = ({ 
  toolName, 
  args,
  metadata,
}: ObservationMarkerBadgeProps) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const omData = (metadata?.omData || args) as OmMarkerData;
  
  // Use the _state field set during part merging, or fallback to detecting from data
  const state = omData._state || (
    omData.failedAt ? 'failed' : 
    omData.completedAt ? 'complete' : 
    'loading'
  );
  
  const isStart = state === 'loading';
  const isEnd = state === 'complete';
  const isFailed = state === 'failed';

  // Render based on marker type
  if (isStart) {
    const tokensToObserve = omData.tokensToObserve;
    return (
      <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-blue-500/10 text-blue-600 text-xs font-medium my-1">
        <Loader2 className="w-3 h-3 animate-spin" />
        <Brain className="w-3 h-3" />
        <span>Observing{tokensToObserve ? ` ~${formatTokens(tokensToObserve)} tokens` : '...'}</span>
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
    const compressionRatio = tokensObserved && observationTokens && observationTokens > 0 
      ? Math.round(tokensObserved / observationTokens) 
      : null;
    
    return (
      <div className="my-1">
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-green-500/10 text-green-600 text-xs font-medium hover:bg-green-500/20 transition-colors cursor-pointer"
        >
          {isExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
          <Brain className="w-3 h-3" />
          <span>
            Observed {tokensObserved ? formatTokens(tokensObserved) : '?'}→{observationTokens ? formatTokens(observationTokens) : '?'} tokens
            {compressionRatio ? ` (-${compressionRatio}x)` : ''}
          </span>
        </button>
        {isExpanded && (
          <div className="mt-1 ml-6 p-2 rounded-md bg-green-500/5 text-green-700 text-xs space-y-1.5 border border-green-500/10 max-w-md">
            <div className="flex gap-4 text-[11px]">
              {tokensObserved && (
                <span><span className="text-green-600">Input:</span> {formatTokens(tokensObserved)}</span>
              )}
              {observationTokens && (
                <span><span className="text-green-600">Output:</span> {formatTokens(observationTokens)}</span>
              )}
              {compressionRatio && compressionRatio > 1 && (
                <span><span className="text-green-600">Compression:</span> {compressionRatio}x</span>
              )}
              {durationMs && (
                <span><span className="text-green-600">Duration:</span> {(durationMs / 1000).toFixed(2)}s</span>
              )}
            </div>
            {observations && (
              <div className="mt-1 pt-1 border-t border-green-500/10">
                <ObservationRenderer 
                  observations={observations} 
                  maxHeight="200px"
                  className="text-green-800"
                />
              </div>
            )}
            {currentTask && (
              <div className="mt-2 pt-2 border-t border-green-500/10">
                <div className="text-[10px] font-medium text-green-600 uppercase tracking-wide mb-1">
                  Current Task
                </div>
                <div className="text-[11px] text-green-800 whitespace-pre-wrap">
                  {currentTask}
                </div>
              </div>
            )}
            {suggestedResponse && (
              <div className="mt-2 pt-2 border-t border-green-500/10">
                <div className="text-[10px] font-medium text-green-600 uppercase tracking-wide mb-1">
                  Suggested Response
                </div>
                <div className="text-[11px] text-green-800/80 italic whitespace-pre-wrap">
                  {suggestedResponse}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  if (isFailed) {
    const error = omData.error;
    return (
      <div className="my-1">
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-red-500/10 text-red-600 text-xs font-medium hover:bg-red-500/20 transition-colors cursor-pointer"
        >
          {isExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
          <XCircle className="w-3 h-3" />
          <span>Observation failed</span>
        </button>
        
        {isExpanded && error && (
          <div className="mt-1 ml-4 p-2 rounded-md bg-red-500/5 text-red-700 text-xs border border-red-500/10">
            <span className="font-medium">Error:</span> {error}
          </div>
        )}
      </div>
    );
  }

  // Unknown marker type - render generic
  return (
    <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-gray-500/10 text-gray-600 text-xs font-medium my-1">
      <Brain className="w-3 h-3" />
      <span>{toolName}</span>
    </div>
  );
};

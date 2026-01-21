import { Brain, CheckCircle, XCircle, Loader2 } from 'lucide-react';

export interface OmMarkerData {
  observedAt?: string;
  completedAt?: string;
  failedAt?: string;
  startedAt?: string;
  tokensObserved?: number;
  tokensToObserve?: number;
  observationTokens?: number;
  durationMs?: number;
  error?: string;
  recordId?: string;
  threadId?: string;
  threadIds?: string[];
  _state?: 'loading' | 'complete' | 'failed';
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
 * Renders an inline badge for OM observation markers.
 * These are converted from data-om-* parts to tool-call format for assistant-ui compatibility.
 */
export const ObservationMarkerBadge = ({ 
  toolName, 
  args,
  metadata,
}: ObservationMarkerBadgeProps) => {
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
    const tokensToObserve = (omData as any)?.tokensToObserve;
    return (
      <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-blue-500/10 text-blue-600 text-xs font-medium my-1">
        <Loader2 className="w-3 h-3 animate-spin" />
        <span>Observing{tokensToObserve ? ` ~${Math.round(tokensToObserve / 1000)}k tokens` : ''}...</span>
      </div>
    );
  }

  if (isEnd) {
    const tokensObserved = (omData as any)?.tokensObserved;
    const observationTokens = (omData as any)?.observationTokens;
    const durationMs = (omData as any)?.durationMs;
    
    return (
      <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-green-500/10 text-green-600 text-xs font-medium my-1">
        <CheckCircle className="w-3 h-3" />
        <span>
          Observed
          {tokensObserved ? ` ${Math.round(tokensObserved / 1000)}k` : ''}
          {observationTokens ? ` → ${observationTokens} tokens` : ''}
          {durationMs ? ` (${(durationMs / 1000).toFixed(1)}s)` : ''}
        </span>
      </div>
    );
  }

  if (isFailed) {
    const error = (omData as any)?.error;
    return (
      <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-red-500/10 text-red-600 text-xs font-medium my-1">
        <XCircle className="w-3 h-3" />
        <span>Observation failed{error ? `: ${error}` : ''}</span>
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

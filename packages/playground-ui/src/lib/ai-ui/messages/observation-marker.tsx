import { Brain, CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Types for OM observation markers streamed from the agent.
 * These match the types defined in @mastra/memory.
 */
export interface ObservationMarkerConfig {
  observationThreshold: number;
  reflectionThreshold: number;
  scope: 'thread' | 'resource';
}

export interface DataOmObservationStartPart {
  type: 'data-om-observation-start';
  data: {
    startedAt: string;
    tokensToObserve: number;
    recordId: string;
    threadId: string;
    threadIds: string[];
    config: ObservationMarkerConfig;
  };
}

export interface DataOmObservationEndPart {
  type: 'data-om-observation-end';
  data: {
    completedAt: string;
    durationMs: number;
    tokensObserved: number;
    observationTokens: number;
    recordId: string;
    threadId: string;
  };
}

export interface DataOmObservationFailedPart {
  type: 'data-om-observation-failed';
  data: {
    failedAt: string;
    durationMs: number;
    tokensAttempted: number;
    error: string;
    recordId: string;
    threadId: string;
  };
}

export type DataOmObservationPart =
  | DataOmObservationStartPart
  | DataOmObservationEndPart
  | DataOmObservationFailedPart;

/**
 * Check if a part is an OM observation marker.
 */
export function isObservationMarker(part: { type: string }): part is DataOmObservationPart {
  return (
    part.type === 'data-om-observation-start' ||
    part.type === 'data-om-observation-end' ||
    part.type === 'data-om-observation-failed'
  );
}

interface ObservationMarkerProps {
  part: DataOmObservationPart;
  /** Callback when observation completes (for triggering sidebar refresh) */
  onObservationComplete?: (data: DataOmObservationEndPart['data']) => void;
  /** Callback when observation fails */
  onObservationFailed?: (data: DataOmObservationFailedPart['data']) => void;
}

/**
 * Renders an inline observation marker in the chat history.
 * Shows different states: in-progress, completed, or failed.
 */
export const ObservationMarker = ({ part, onObservationComplete, onObservationFailed }: ObservationMarkerProps) => {
  // Trigger callbacks when appropriate
  if (part.type === 'data-om-observation-end' && onObservationComplete) {
    // Use setTimeout to avoid calling during render
    setTimeout(() => onObservationComplete(part.data), 0);
  }
  if (part.type === 'data-om-observation-failed' && onObservationFailed) {
    setTimeout(() => onObservationFailed(part.data), 0);
  }

  if (part.type === 'data-om-observation-start') {
    return <ObservationStartMarker data={part.data} />;
  }

  if (part.type === 'data-om-observation-end') {
    return <ObservationEndMarker data={part.data} />;
  }

  if (part.type === 'data-om-observation-failed') {
    return <ObservationFailedMarker data={part.data} />;
  }

  return null;
};

/**
 * Shows observation in progress.
 */
const ObservationStartMarker = ({ data }: { data: DataOmObservationStartPart['data'] }) => {
  const tokensK = (data.tokensToObserve / 1000).toFixed(1);

  return (
    <div
      className={cn(
        'inline-flex items-center gap-1.5 px-2 py-1 my-1 rounded-md',
        'bg-accent1/10 border border-accent1/20 text-accent1',
        'text-ui-xs leading-ui-xs'
      )}
      data-testid="om-observation-start"
    >
      <Loader2 className="h-3 w-3 animate-spin" />
      <span>Observing {tokensK}k tokens...</span>
    </div>
  );
};

/**
 * Shows observation completed successfully.
 */
const ObservationEndMarker = ({ data }: { data: DataOmObservationEndPart['data'] }) => {
  const tokensK = (data.tokensObserved / 1000).toFixed(1);
  const compressionRatio = data.tokensObserved > 0 
    ? ((1 - data.observationTokens / data.tokensObserved) * 100).toFixed(0)
    : 0;
  const durationSec = (data.durationMs / 1000).toFixed(1);

  return (
    <div
      className={cn(
        'inline-flex items-center gap-1.5 px-2 py-1 my-1 rounded-md',
        'bg-green-500/10 border border-green-500/20 text-green-600 dark:text-green-400',
        'text-ui-xs leading-ui-xs'
      )}
      data-testid="om-observation-end"
    >
      <CheckCircle2 className="h-3 w-3" />
      <span>
        Observed {tokensK}k tokens → {compressionRatio}% compression ({durationSec}s)
      </span>
    </div>
  );
};

/**
 * Shows observation failed.
 */
const ObservationFailedMarker = ({ data }: { data: DataOmObservationFailedPart['data'] }) => {
  const tokensK = (data.tokensAttempted / 1000).toFixed(1);

  return (
    <div
      className={cn(
        'inline-flex items-center gap-1.5 px-2 py-1 my-1 rounded-md',
        'bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400',
        'text-ui-xs leading-ui-xs'
      )}
      data-testid="om-observation-failed"
      title={data.error}
    >
      <XCircle className="h-3 w-3" />
      <span>Observation failed ({tokensK}k tokens)</span>
    </div>
  );
};

/**
 * Compact inline indicator for observation (alternative display).
 * Can be used when space is limited.
 */
export const ObservationIndicator = ({ part }: { part: DataOmObservationPart }) => {
  if (part.type === 'data-om-observation-start') {
    return (
      <span className="inline-flex items-center gap-1 text-accent1" title="Observing...">
        <Brain className="h-3 w-3" />
        <Loader2 className="h-2.5 w-2.5 animate-spin" />
      </span>
    );
  }

  if (part.type === 'data-om-observation-end') {
    return (
      <span className="inline-flex items-center text-green-500" title="Observation complete">
        <Brain className="h-3 w-3" />
      </span>
    );
  }

  if (part.type === 'data-om-observation-failed') {
    return (
      <span className="inline-flex items-center text-red-500" title={`Observation failed: ${part.data.error}`}>
        <Brain className="h-3 w-3" />
      </span>
    );
  }

  return null;
};

import { Brain, CheckCircle2, XCircle, Loader2, CloudCog } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useEffect } from 'react';

/**
 * Types for OM observation markers streamed from the agent.
 * These match the types defined in @mastra/memory.
 */
export interface ObservationMarkerConfig {
  messageTokens: number;
  observationTokens: number;
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

/**
 * Async buffering marker types - non-blocking background observation/reflection.
 */
export interface DataOmBufferingStartPart {
  type: 'data-om-buffering-start';
  data: {
    startedAt: string;
    tokensToObserve: number;
    recordId: string;
    cycleId: string;
    threadId?: string;
    resourceId?: string;
    operationType: 'observation' | 'reflection';
  };
}

export interface DataOmBufferingEndPart {
  type: 'data-om-buffering-end';
  data: {
    completedAt: string;
    durationMs: number;
    tokensObserved: number;
    observationTokens: number;
    recordId: string;
    cycleId: string;
  };
}

export interface DataOmBufferingFailedPart {
  type: 'data-om-buffering-failed';
  data: {
    failedAt: string;
    durationMs: number;
    error: string;
    recordId: string;
    cycleId: string;
  };
}

export type DataOmBufferingPart = DataOmBufferingStartPart | DataOmBufferingEndPart | DataOmBufferingFailedPart;

export type DataOmObservationPart =
  | DataOmObservationStartPart
  | DataOmObservationEndPart
  | DataOmObservationFailedPart
  | DataOmBufferingPart;

/**
 * Check if a part is an OM observation marker.
 */
export function isObservationMarker(part: { type: string }): part is DataOmObservationPart {
  return (
    part.type === 'data-om-observation-start' ||
    part.type === 'data-om-observation-end' ||
    part.type === 'data-om-observation-failed' ||
    part.type === 'data-om-buffering-start' ||
    part.type === 'data-om-buffering-end' ||
    part.type === 'data-om-buffering-failed'
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
  // Trigger callbacks in useEffect to avoid calling during render
  useEffect(() => {
    if (part.type === 'data-om-observation-end' && onObservationComplete) {
      onObservationComplete(part.data);
    }
    if (part.type === 'data-om-observation-failed' && onObservationFailed) {
      onObservationFailed(part.data);
    }
  }, [part, onObservationComplete, onObservationFailed]);

  if (part.type === 'data-om-observation-start') {
    return <ObservationStartMarker data={part.data} />;
  }

  if (part.type === 'data-om-observation-end') {
    return <ObservationEndMarker data={part.data} />;
  }

  if (part.type === 'data-om-observation-failed') {
    return <ObservationFailedMarker data={part.data} />;
  }

  // Buffering markers
  if (part.type === 'data-om-buffering-start') {
    return <BufferingStartMarker data={part.data} />;
  }

  if (part.type === 'data-om-buffering-end') {
    return <BufferingEndMarker data={part.data} />;
  }

  if (part.type === 'data-om-buffering-failed') {
    return <BufferingFailedMarker data={part.data} />;
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
        'text-ui-xs leading-ui-xs',
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
  const compressionRatio =
    data.tokensObserved > 0 ? ((1 - data.observationTokens / data.tokensObserved) * 100).toFixed(0) : 0;
  const durationSec = (data.durationMs / 1000).toFixed(1);

  return (
    <div
      className={cn(
        'inline-flex items-center gap-1.5 px-2 py-1 my-1 rounded-md',
        'bg-green-500/10 border border-green-500/20 text-green-600 dark:text-green-400',
        'text-ui-xs leading-ui-xs',
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
        'text-ui-xs leading-ui-xs',
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
 * Shows async buffering in progress.
 */
const BufferingStartMarker = ({ data }: { data: DataOmBufferingStartPart['data'] }) => {
  const tokensK = (data.tokensToObserve / 1000).toFixed(1);
  const label = data.operationType === 'reflection' ? 'Buffering reflection' : 'Buffering observations';

  return (
    <div
      className={cn(
        'inline-flex items-center gap-1.5 px-2 py-1 my-1 rounded-md',
        'bg-purple-500/10 border border-dashed border-purple-500/40 text-purple-600 dark:text-purple-400',
        'text-ui-xs leading-ui-xs',
      )}
      data-testid="om-buffering-start"
    >
      <Loader2 className="h-3 w-3 animate-spin" />
      <CloudCog className="h-3 w-3" />
      <span>
        {label} ~{tokensK}k tokens...
      </span>
    </div>
  );
};

/**
 * Shows async buffering completed.
 */
const BufferingEndMarker = ({ data }: { data: DataOmBufferingEndPart['data'] }) => {
  const tokensK = (data.tokensObserved / 1000).toFixed(1);
  const compressionRatio =
    data.tokensObserved > 0 ? ((1 - data.observationTokens / data.tokensObserved) * 100).toFixed(0) : 0;
  const durationSec = (data.durationMs / 1000).toFixed(1);

  return (
    <div
      className={cn(
        'inline-flex items-center gap-1.5 px-2 py-1 my-1 rounded-md',
        'bg-purple-500/10 border border-dashed border-purple-500/40 text-purple-600 dark:text-purple-400',
        'text-ui-xs leading-ui-xs',
      )}
      data-testid="om-buffering-end"
    >
      <CloudCog className="h-3 w-3" />
      <span>
        Buffered {tokensK}k tokens → {compressionRatio}% compression ({durationSec}s)
      </span>
    </div>
  );
};

/**
 * Shows async buffering failed.
 */
const BufferingFailedMarker = ({ data }: { data: DataOmBufferingFailedPart['data'] }) => {
  return (
    <div
      className={cn(
        'inline-flex items-center gap-1.5 px-2 py-1 my-1 rounded-md',
        'bg-red-500/10 border border-dashed border-red-500/40 text-red-600 dark:text-red-400',
        'text-ui-xs leading-ui-xs',
      )}
      data-testid="om-buffering-failed"
      title={data.error}
    >
      <XCircle className="h-3 w-3" />
      <span>Buffering failed</span>
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

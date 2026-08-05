import type {
  DataOmObservationStartPart,
  DataOmObservationEndPart,
  DataOmObservationFailedPart,
  DataOmBufferingStartPart,
  DataOmBufferingEndPart,
  DataOmBufferingFailedPart,
} from '@mastra/memory/processors';
import { cn } from '@mastra/playground-ui/utils/cn';
import { Brain, CheckCircle2, XCircle, Loader2, CloudCog } from 'lucide-react';
import { useEffect } from 'react';

import type { OmMarkerPart, OmObservationMarkerPart } from '../../../services/om-types';

interface ObservationMarkerProps {
  part: OmMarkerPart;
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
const hasExtractedValue = (value: unknown) => value !== undefined && value !== null && value !== '';

const ObservationEndMarker = ({ data }: { data: DataOmObservationEndPart['data'] }) => {
  const tokensK = (data.tokensObserved / 1000).toFixed(1);
  const compressionRatio =
    data.tokensObserved > 0 ? ((1 - data.observationTokens / data.tokensObserved) * 100).toFixed(0) : 0;
  const durationSec = (data.durationMs / 1000).toFixed(1);
  const extractedCount = Object.values(data.extractedValues ?? {}).filter(hasExtractedValue).length;
  const extractionFailureCount = data.extractionFailures?.length ?? 0;

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
        {extractedCount > 0 ? ` · ${extractedCount} extracted` : ''}
        {extractionFailureCount > 0 ? ` · ${extractionFailureCount} failed` : ''}
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
  const tokensK = (data.tokensToBuffer / 1000).toFixed(1);
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
  const tokensK = (data.tokensBuffered / 1000).toFixed(1);
  const compressionRatio =
    data.tokensBuffered > 0 ? ((1 - data.bufferedTokens / data.tokensBuffered) * 100).toFixed(0) : 0;
  const durationSec = (data.durationMs / 1000).toFixed(1);
  const extractedCount = Object.values(data.extractedValues ?? {}).filter(hasExtractedValue).length;
  const extractionFailureCount = data.extractionFailures?.length ?? 0;

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
        {extractedCount > 0 ? ` · ${extractedCount} extracted` : ''}
        {extractionFailureCount > 0 ? ` · ${extractionFailureCount} failed` : ''}
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
export const ObservationIndicator = ({ part }: { part: OmObservationMarkerPart }) => {
  if (part.type === 'data-om-observation-start') {
    return (
      <span className="text-accent1 inline-flex items-center gap-1" title="Observing...">
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

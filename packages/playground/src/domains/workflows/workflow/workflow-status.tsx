import { CodeEditor } from '@mastra/playground-ui';
import { ChevronDown, ChevronRight, RefreshCw, Tag, ShieldAlert } from 'lucide-react';
import { useState } from 'react';

export interface TripwireInfo {
  reason?: string;
  retry?: boolean;
  metadata?: unknown;
  processorId?: string;
}

export interface StepDetailProps {
  status: string;
  result: Record<string, unknown>;
  tripwire?: TripwireInfo;
}

export const StepDetail = ({ status, result, tripwire }: StepDetailProps) => {
  const [isTripwireExpanded, setIsTripwireExpanded] = useState(false);

  const isTripwire = status === 'tripwire';
  const hasTripwireMetadata = Boolean(
    tripwire && (tripwire.retry !== undefined || tripwire.metadata !== undefined || tripwire.processorId !== undefined),
  );

  if (isTripwire && tripwire) {
    return (
      <TripwireDetails
        tripwire={tripwire}
        isExpanded={isTripwireExpanded}
        onToggleExpand={() => setIsTripwireExpanded(!isTripwireExpanded)}
        hasMetadata={hasTripwireMetadata}
      />
    );
  }

  return <CodeEditor data={result} />;
};

interface TripwireDetailsProps {
  tripwire: TripwireInfo;
  isExpanded: boolean;
  onToggleExpand: () => void;
  hasMetadata?: boolean;
}

const TripwireDetails = ({ tripwire, isExpanded, onToggleExpand, hasMetadata }: TripwireDetailsProps) => {
  return (
    <div className="rounded-lg border border-amber-500/30 bg-amber-950/20 overflow-hidden">
      {/* Header */}
      <div className="flex items-start gap-3 p-4">
        <ShieldAlert className="w-5 h-5 text-amber-400 mt-0.5 shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-amber-200 mb-1">Content Blocked</p>
          <p className="text-sm text-amber-300/90">{tripwire.reason || 'Tripwire triggered'}</p>
        </div>
      </div>

      {/* Expandable metadata section */}
      {hasMetadata && (
        <>
          <button
            type="button"
            onClick={onToggleExpand}
            className="w-full flex items-center gap-2 px-4 py-2 text-xs text-amber-400/70 hover:text-amber-400 hover:bg-amber-900/20 transition-colors border-t border-amber-500/20"
          >
            {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
            <span>Details</span>
          </button>

          {isExpanded && (
            <div className="px-4 pb-4 space-y-3 border-t border-amber-500/20 bg-amber-950/10">
              {/* Retry indicator */}
              {tripwire.retry !== undefined && (
                <div className="flex items-center gap-2 pt-3">
                  <RefreshCw className="w-3.5 h-3.5 text-amber-400/60" />
                  <span className="text-xs text-amber-300/70">
                    Retry:{' '}
                    {tripwire.retry ? (
                      <span className="text-green-400">Allowed</span>
                    ) : (
                      <span className="text-red-400">Not allowed</span>
                    )}
                  </span>
                </div>
              )}

              {/* Processor ID */}
              {tripwire.processorId && (
                <div className="flex items-center gap-2">
                  <Tag className="w-3.5 h-3.5 text-amber-400/60" />
                  <span className="text-xs text-amber-300/70">
                    Processor:{' '}
                    <code className="px-1.5 py-0.5 rounded bg-amber-900/30 text-amber-200 font-mono">
                      {tripwire.processorId}
                    </code>
                  </span>
                </div>
              )}

              {/* Custom metadata */}
              {tripwire.metadata !== undefined && tripwire.metadata !== null && (
                <div className="pt-1">
                  <p className="text-xs text-amber-400/60 mb-1.5">Metadata:</p>
                  <pre className="text-xs text-amber-200/80 bg-amber-900/30 rounded p-2 overflow-x-auto font-mono">
                    {String(JSON.stringify(tripwire.metadata, null, 2))}
                  </pre>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
};

import { useState } from 'react';
import { ChevronDown, ChevronRight, ShieldAlert, RefreshCw, Tag } from 'lucide-react';
import { TripwireMetadata } from '@mastra/react';

export interface TripwireNoticeProps {
  reason: string;
  tripwire?: TripwireMetadata;
}

export const TripwireNotice = ({ reason, tripwire }: TripwireNoticeProps) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const hasMetadata = tripwire && (tripwire.retry !== undefined || tripwire.tripwirePayload || tripwire.processorId);

  return (
    <div className="rounded-lg border border-amber-500/30 bg-amber-950/20 overflow-hidden">
      {/* Header */}
      <div className="flex items-start gap-3 p-4">
        <ShieldAlert className="w-5 h-5 text-amber-400 mt-0.5 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-amber-200 mb-1">Content Blocked</p>
          <p className="text-sm text-amber-300/90">{reason}</p>
        </div>
      </div>

      {/* Expandable metadata section */}
      {hasMetadata && (
        <>
          <button
            onClick={() => setIsExpanded(!isExpanded)}
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
              {tripwire.tripwirePayload !== undefined && tripwire.tripwirePayload !== null && (
                <div className="pt-1">
                  <p className="text-xs text-amber-400/60 mb-1.5">Metadata:</p>
                  <pre className="text-xs text-amber-200/80 bg-amber-900/30 rounded p-2 overflow-x-auto font-mono">
                    {String(JSON.stringify(tripwire.tripwirePayload, null, 2))}
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

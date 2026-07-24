import type { TripwireMetadata } from '@mastra/react';
import { ChevronDown, ChevronRight, ShieldAlert, RefreshCw, Tag } from 'lucide-react';
import { useState } from 'react';

export interface TripwireNoticeProps {
  reason: string;
  tripwire?: TripwireMetadata;
}

export const TripwireNotice = ({ reason, tripwire }: TripwireNoticeProps) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const hasMetadata = tripwire && (tripwire.retry !== undefined || tripwire.metadata || tripwire.processorId);

  return (
    <div className="overflow-hidden rounded-lg border border-amber-500/30 bg-amber-950/20">
      {/* Header */}
      <div className="flex items-start gap-3 p-4">
        <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-amber-400" />
        <div className="min-w-0 flex-1">
          <p className="mb-1 text-sm font-medium text-amber-200">Content Blocked</p>
          <p className="text-sm text-amber-300/90">{reason}</p>
        </div>
      </div>

      {/* Expandable metadata section */}
      {hasMetadata && (
        <>
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="flex w-full items-center gap-2 border-t border-amber-500/20 px-4 py-2 text-xs text-amber-400/70 transition-colors hover:bg-amber-900/20 hover:text-amber-400"
          >
            {isExpanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
            <span>Details</span>
          </button>

          {isExpanded && (
            <div className="space-y-3 border-t border-amber-500/20 bg-amber-950/10 px-4 pb-4">
              {/* Retry indicator */}
              {tripwire.retry !== undefined && (
                <div className="flex items-center gap-2 pt-3">
                  <RefreshCw className="h-3.5 w-3.5 text-amber-400/60" />
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
                  <Tag className="h-3.5 w-3.5 text-amber-400/60" />
                  <span className="text-xs text-amber-300/70">
                    Processor:{' '}
                    <code className="rounded bg-amber-900/30 px-1.5 py-0.5 font-mono text-amber-200">
                      {tripwire.processorId}
                    </code>
                  </span>
                </div>
              )}

              {/* Custom metadata */}
              {tripwire.metadata !== undefined && tripwire.metadata !== null && (
                <div className="pt-1">
                  <p className="mb-1.5 text-xs text-amber-400/60">Metadata:</p>
                  <pre className="overflow-x-auto rounded bg-amber-900/30 p-2 font-mono text-xs text-amber-200/80">
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

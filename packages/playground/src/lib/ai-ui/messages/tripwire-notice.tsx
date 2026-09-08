import { Badge } from '@mastra/playground-ui/components/Badge';
import { Notice } from '@mastra/playground-ui/components/Notice';
import type { TripwireMetadata } from '@mastra/react';
import { ChevronDown, ChevronRight, RefreshCw, ShieldAlert, Tag } from 'lucide-react';
import { useState } from 'react';

export interface TripwireNoticeProps {
  reason: string;
  tripwire?: Partial<TripwireMetadata>;
}

export const TripwireNotice = ({ reason, tripwire }: TripwireNoticeProps) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const hasMetadata = Boolean(
    tripwire && (tripwire.retry !== undefined || tripwire.metadata !== undefined || tripwire.processorId !== undefined),
  );

  return (
    <Notice variant="warning" title="Content Blocked" icon={<ShieldAlert />}>
      <div className="flex flex-col gap-3">
        <Notice.Message className="break-words whitespace-pre-wrap">{reason}</Notice.Message>

        {hasMetadata && tripwire && (
          <div className="flex flex-col gap-3">
            <button
              type="button"
              onClick={() => setIsExpanded(!isExpanded)}
              className="text-ui-sm flex w-fit items-center gap-1.5 opacity-70 transition-opacity hover:opacity-100"
            >
              {isExpanded ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
              <span>Details</span>
            </button>

            {isExpanded && (
              <div className="text-ui-sm flex flex-col gap-2">
                {tripwire.retry !== undefined && (
                  <div className="flex items-center gap-2">
                    <RefreshCw className="size-3.5 shrink-0 opacity-70" />
                    <span>Retry</span>
                    <Badge size="xs" variant={tripwire.retry ? 'green' : 'red'}>
                      {tripwire.retry ? 'Allowed' : 'Not allowed'}
                    </Badge>
                  </div>
                )}

                {tripwire.processorId && (
                  <div className="flex items-center gap-2">
                    <Tag className="size-3.5 shrink-0 opacity-70" />
                    <span>Processor</span>
                    <Badge size="xs" variant="yellow">
                      {tripwire.processorId}
                    </Badge>
                  </div>
                )}

                {tripwire.metadata !== undefined && tripwire.metadata !== null && (
                  <div className="flex flex-col gap-1.5">
                    <span className="opacity-70">Metadata</span>
                    <pre className="overflow-x-auto rounded-lg bg-current/10 p-2 font-mono">
                      {JSON.stringify(tripwire.metadata, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </Notice>
  );
};

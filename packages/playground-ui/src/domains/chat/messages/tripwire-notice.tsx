import type { TripwireMetadata } from '@mastra/react';
import { ChevronDown, ChevronRight, RefreshCw, ShieldAlert, Tag } from 'lucide-react';
import { useState } from 'react';
import { Badge } from '@/ds/components/Badge';
import { Code } from '@/ds/components/Code';
import { Notice } from '@/ds/components/Notice';
import { Txt } from '@/ds/components/Txt';

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
              className="flex w-fit items-center gap-1.5 opacity-70 transition-opacity hover:opacity-100"
            >
              {isExpanded ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
              <Txt as="span" variant="caption">
                Details
              </Txt>
            </button>

            {isExpanded && (
              <div className="flex flex-col gap-2">
                {tripwire.retry !== undefined && (
                  <div className="flex items-center gap-2">
                    <RefreshCw className="size-3.5 shrink-0 opacity-70" />
                    <Txt as="span" variant="caption">
                      Retry
                    </Txt>
                    <Badge size="xs" variant={tripwire.retry ? 'success' : 'destructive'}>
                      {tripwire.retry ? 'Allowed' : 'Not allowed'}
                    </Badge>
                  </div>
                )}

                {tripwire.processorId && (
                  <div className="flex items-center gap-2">
                    <Tag className="size-3.5 shrink-0 opacity-70" />
                    <Txt as="span" variant="caption">
                      Processor
                    </Txt>
                    <Badge size="xs" variant="warning">
                      {tripwire.processorId}
                    </Badge>
                  </div>
                )}

                {tripwire.metadata !== undefined && tripwire.metadata !== null && (
                  <div className="flex flex-col gap-1.5">
                    <Txt as="span" variant="caption" className="opacity-70">
                      Metadata
                    </Txt>
                    <Code
                      variant="caption"
                      className="overflow-x-auto rounded-lg bg-current/10 p-2"
                      code={JSON.stringify(tripwire.metadata, null, 2)}
                    />
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

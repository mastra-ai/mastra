import type { TripwireMetadata } from '@mastra/react';
import { ShieldAlert } from 'lucide-react';
import { useState } from 'react';
import { Badge } from '@/ds/components/Badge';
import { Code } from '@/ds/components/Code';
import { Notice } from '@/ds/components/Notice';
import { Txt } from '@/ds/components/Txt';
import { IconArrowRotateClockwise } from '@/ds/icons/central/IconArrowRotateClockwise';
import { IconChevronBottom } from '@/ds/icons/central/IconChevronBottom';
import { IconChevronRight } from '@/ds/icons/central/IconChevronRight';
import { IconTag } from '@/ds/icons/central/IconTag';

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
              {isExpanded ? <IconChevronBottom className="size-3.5" /> : <IconChevronRight className="size-3.5" />}
              <Txt as="span" variant="caption">
                Details
              </Txt>
            </button>

            {isExpanded && (
              <div className="flex flex-col gap-2">
                {tripwire.retry !== undefined && (
                  <div className="flex items-center gap-2">
                    <IconArrowRotateClockwise className="size-3.5 shrink-0 opacity-70" />
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
                    <IconTag className="size-3.5 shrink-0 opacity-70" />
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
                      code={JSON.stringify(tripwire.metadata, null, 2)}
                      lang="json"
                      className="rounded-lg bg-current/10 p-2 text-caption break-words whitespace-pre-wrap"
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

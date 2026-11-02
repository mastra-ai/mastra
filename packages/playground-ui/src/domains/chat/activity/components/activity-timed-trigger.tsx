import type { ReactNode } from 'react';

import { ActivityTrigger } from '@/ds/components/ai/activity';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/ds/components/Tooltip';
import { formatMoment, toDate } from '@/utils/date-format';

export interface ActivityTimedTriggerProps {
  /** When the work began, in epoch milliseconds. */
  at?: number;
  className?: string;
  children: ReactNode;
}

/** A line's trigger that names when its work began, on hover and to screen readers. */
export function ActivityTimedTrigger({ at, className, children }: ActivityTimedTriggerProps) {
  const time = toDate(at);
  if (!time) return <ActivityTrigger className={className}>{children}</ActivityTrigger>;
  const moment = formatMoment(time);

  return (
    <Tooltip>
      <TooltipTrigger render={<ActivityTrigger className={className} />}>
        <time className="sr-only" dateTime={time.toISOString()}>
          {moment}
        </time>
        {children}
      </TooltipTrigger>
      <TooltipContent side="left">{moment}</TooltipContent>
    </Tooltip>
  );
}

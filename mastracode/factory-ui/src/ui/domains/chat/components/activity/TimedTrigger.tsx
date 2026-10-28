import { ActivityTrigger } from '@mastra/playground-ui/components/ai/activity';
import { Tooltip, TooltipContent, TooltipTrigger } from '@mastra/playground-ui/components/Tooltip';
import { cn } from '@mastra/playground-ui/utils/cn';
import { toDate } from '@mastra/playground-ui/utils/date-format';
import type { ReactNode } from 'react';

import { toolMoment } from '../tool-moment';
import { rowStyle } from './row-style';

/** A row trigger that names when its work began on hover, beside the row where there is room. */
export function TimedTrigger({ at, className, children }: { at?: number; className?: string; children: ReactNode }) {
  const time = toDate(at);
  const style = cn(rowStyle.trigger, className);
  if (!time) return <ActivityTrigger className={style}>{children}</ActivityTrigger>;
  const moment = toolMoment(time);

  return (
    <Tooltip>
      <TooltipTrigger render={<ActivityTrigger className={style} />}>
        <time className="sr-only" dateTime={time.toISOString()}>
          {moment}
        </time>
        {children}
      </TooltipTrigger>
      <TooltipContent side="left">{moment}</TooltipContent>
    </Tooltip>
  );
}

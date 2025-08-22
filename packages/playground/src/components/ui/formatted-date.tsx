import { format, formatDistanceToNow } from 'date-fns';

import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './tooltip';

export function FormattedDate({ date }: { date: string }) {
  const formattedDate = {
    relativeTime: formatDistanceToNow(new Date(date), { addSuffix: true }),
    fullDate: format(new Date(date), 'PPpp'),
  };

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger className="text-left text-sm text-mastra-el-4">{formattedDate.relativeTime}</TooltipTrigger>
        <TooltipContent className="bg-mastra-bg-1 text-mastra-el-1">
          <p className="text-sm">{formattedDate.fullDate}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

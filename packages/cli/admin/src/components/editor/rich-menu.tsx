import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

import { cn } from '@/lib/utils';

import IconButton from '../ui/icon-button';

import { BubbleMenuItem } from './types';

export function RichMenu({ items, headingLevel }: { items: BubbleMenuItem[]; headingLevel: BubbleMenuItem[] }) {
  return (
    <TooltipProvider>
      <div className="flex flex-wrap items-center gap-1 pb-2">
        {items.map((item, index) => (
          <Tooltip key={index}>
            <TooltipTrigger>
              <IconButton
                icon={item.icon}
                iconClassname={cn(
                  'h-3 w-3 transition-colors text-mastra-el-6',
                  item.isActive ? item.isActive() && 'text-mastra-border-5' : '',
                )}
                onClick={() => {
                  item?.command();
                }}
                size="sm"
              />
            </TooltipTrigger>
            <TooltipContent className="text-xs">{item.name}</TooltipContent>
          </Tooltip>
        ))}
        {headingLevel.map((item, index) => (
          <Tooltip key={index}>
            <TooltipTrigger>
              <IconButton
                icon={item.icon}
                iconClassname={cn(
                  'h-3 w-3 transition-colors text-mastra-el-6',
                  item.isActive ? item.isActive() && 'text-mastra-border-5' : '',
                )}
                onClick={() => {
                  item?.command();
                }}
                size="sm"
              />
            </TooltipTrigger>
            <TooltipContent className="text-xs">{item.name}</TooltipContent>
          </Tooltip>
        ))}
      </div>
    </TooltipProvider>
  );
}

import type { ArrayWrapperProps } from '@autoform/react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@mastra/playground-ui/components/Tooltip';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { Icon } from '@mastra/playground-ui/icons/Icon';
import { Brackets, PlusIcon } from 'lucide-react';
import React from 'react';

export const ArrayWrapper: React.FC<ArrayWrapperProps> = ({ label, children, onAddItem }) => {
  return (
    <div>
      <div className="flex gap-2 justify-between">
        <Txt as="h3" variant="ui-sm" className="text-neutral3 pb-2 flex items-center gap-1">
          <Icon size="sm">
            <Brackets />
          </Icon>

          {label}
        </Txt>

        <TooltipProvider delayDuration={0}>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={onAddItem}
                type="button"
                className="text-neutral3 bg-surface3 rounded-md p-1 hover:bg-surface4 hover:text-neutral6 h-icon-sm w-icon-sm"
              >
                <Icon size="sm">
                  <PlusIcon />
                </Icon>
              </button>
            </TooltipTrigger>
            <TooltipContent>Add item</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      <div className="flex flex-col gap-1">{children}</div>
    </div>
  );
};

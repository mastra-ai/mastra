import React from 'react';

import { Brackets, PlusIcon } from 'lucide-react';
import { ArrayWrapperProps } from '@autoform/react';
import { Txt } from '@/ds/components/Txt';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../../tooltip';
import { Icon } from '@/ds/icons';

export const ArrayWrapper: React.FC<ArrayWrapperProps> = ({ label, children, onAddItem }) => {
  return (
    <div>
      <div className="flex gap-2 justify-between">
        <Txt as="h3" variant="ui-sm" className="text-icon3 pb-2 flex items-center gap-1">
          <Icon size="sm">
            <Brackets />
          </Icon>

          {label}
        </Txt>

        <TooltipProvider>
          <Tooltip delayDuration={0}>
            <TooltipTrigger asChild>
              <button
                onClick={onAddItem}
                type="button"
                className="text-icon3 bg-surface3 rounded-md p-1 hover:bg-surface4 hover:text-icon6 h-icon-sm w-icon-sm"
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

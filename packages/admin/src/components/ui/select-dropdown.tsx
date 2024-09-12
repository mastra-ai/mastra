import { ComponentProps } from 'react';

import { cn } from '@/lib/utils';

import { Button } from './button';
import { MultiSelect, MultiSelectProps } from './multi-select';
import { Popover, PopoverContent, PopoverTrigger } from './popover';

type SelectDropDownProps<T extends {}> = {
  className?: string;
  onActionButtonClick?: () => void;
  actionButtonLabel?: string;
  actionButtonIcon?: React.ReactNode;
} & MultiSelectProps<T> &
  ComponentProps<typeof Popover>;

const SelectDropDown = <T extends {}>({
  children,
  className,
  onOpenChange,
  open,
  actionButtonIcon,
  actionButtonLabel,
  onActionButtonClick,
  ...props
}: SelectDropDownProps<T>) => {
  return (
    <Popover onOpenChange={onOpenChange} open={open}>
      <PopoverTrigger asChild>{children ? children : ''}</PopoverTrigger>
      <PopoverContent
        side="bottom"
        collisionPadding={8}
        onKeyDown={e => {
          e.stopPropagation();
          if (e.key == 'Escape') {
            if (onOpenChange) onOpenChange(false);
          }
        }}
        className={cn(
          'popover-background popover-backdrop-filter popover-shadow popover-border w-fit max-w-[300px] p-0',
          className,
        )}
        align="start"
      >
        <MultiSelect {...props} />
        {onActionButtonClick ? (
          <div className="p-1">
            <Button
              variant="outline"
              className="inline-flex w-full space-x-0.5 text-sm"
              onClick={() => onActionButtonClick()}
            >
              {actionButtonIcon}
              <span>{actionButtonLabel}</span>
            </Button>
          </div>
        ) : null}
      </PopoverContent>
    </Popover>
  );
};

export default SelectDropDown;

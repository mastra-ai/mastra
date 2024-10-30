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
  isDisabled?: boolean;
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
  isDisabled,
  onSelectItem,
  ...props
}: SelectDropDownProps<T>) => {
  return (
    <Popover onOpenChange={onOpenChange} open={open}>
      <PopoverTrigger disabled={isDisabled} asChild>
        {children ? children : ''}
      </PopoverTrigger>
      <PopoverContent
        avoidCollisions
        side="bottom"
        collisionPadding={8}
        onKeyDown={e => {
          e.stopPropagation();
          if (e.key == 'Escape') {
            if (onOpenChange) onOpenChange(false);
          }
        }}
        className={cn(
          'popover-background popover-backdrop-filter popover-shadow popover-border p-0 w-[var(--radix-popover-trigger-width)]',
          className,
        )}
        align="start"
      >
        <MultiSelect
          onSelectItem={value => {
            onSelectItem?.(value);
            if (props.isSingleSelect && onOpenChange) {
              onOpenChange(false);
            }
          }}
          {...props}
        />
        {onActionButtonClick ? (
          <div className="p-1">
            <Button
              variant="default"
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

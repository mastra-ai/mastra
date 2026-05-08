import * as SelectPrimitive from '@radix-ui/react-select';
import { Check, ChevronDown } from 'lucide-react';
import * as React from 'react';

import type { ButtonProps } from '../Button';
import { formElementSizes } from '@/ds/primitives/form-element';
import type { FormElementSize } from '@/ds/primitives/form-element';
import { transitions } from '@/ds/primitives/transitions';
import { cn } from '@/lib/utils';

const Select = SelectPrimitive.Root;

const SelectGroup = SelectPrimitive.Group;

const SelectValue = SelectPrimitive.Value;

export type SelectTriggerProps = React.ComponentPropsWithoutRef<typeof SelectPrimitive.Trigger> & {
  size?: FormElementSize;
  /** Kept for API compatibility; styling is now intrinsic to the trigger. */
  variant?: ButtonProps['variant'];
};

const SelectTrigger = React.forwardRef<React.ElementRef<typeof SelectPrimitive.Trigger>, SelectTriggerProps>(
  ({ className, children, size = 'default', ...props }, ref) => {
    return (
      <SelectPrimitive.Trigger
        ref={ref}
        className={cn(
          'inline-flex w-full cursor-pointer select-none items-center justify-between gap-1.5 whitespace-nowrap',
          formElementSizes[size],
          'rounded-lg border border-border1 bg-transparent px-2.5 text-ui-smd leading-ui-sm text-neutral4',
          'outline-none transition-colors duration-normal ease-out-custom',
          'hover:bg-surface3 hover:text-neutral6 hover:border-border2 active:bg-surface4',
          'focus:outline-none focus-visible:outline-none focus-visible:border-border2',
          'data-[state=open]:bg-surface3 data-[state=open]:text-neutral6 data-[state=open]:border-border2',
          'data-[placeholder]:text-neutral3',
          'disabled:cursor-not-allowed disabled:opacity-50',
          '[&>span]:truncate',
          className,
        )}
        {...props}
      >
        {children}
        <SelectPrimitive.Icon asChild>
          <ChevronDown className={cn('h-4 w-4 shrink-0 text-neutral3 opacity-70', transitions.colors)} />
        </SelectPrimitive.Icon>
      </SelectPrimitive.Trigger>
    );
  },
);
SelectTrigger.displayName = SelectPrimitive.Trigger.displayName;

const SelectContent = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Content>
>(({ className, children, position = 'popper', ...props }, ref) => (
  <SelectPrimitive.Portal>
    <SelectPrimitive.Content
      ref={ref}
      className={cn(
        'relative z-50 min-w-32 max-h-dropdown-max-height overflow-y-auto overflow-x-hidden rounded-xl border border-border1 bg-surface3 text-neutral4 shadow-dialog data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-1 data-[side=left]:slide-in-from-right-1 data-[side=right]:slide-in-from-left-1 data-[side=top]:slide-in-from-bottom-1',
        position === 'popper' &&
          'data-[side=bottom]:translate-y-1 data-[side=left]:-translate-x-1 data-[side=right]:translate-x-1 data-[side=top]:-translate-y-1',
        className,
      )}
      position={position}
      {...props}
    >
      <SelectPrimitive.Viewport
        className={cn(
          'p-1',
          position === 'popper' && 'h-(--radix-select-trigger-height) w-full min-w-(--radix-select-trigger-width)',
        )}
      >
        {children}
      </SelectPrimitive.Viewport>
    </SelectPrimitive.Content>
  </SelectPrimitive.Portal>
));
SelectContent.displayName = SelectPrimitive.Content.displayName;

const SelectItem = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Item>
>(({ className, children, ...props }, ref) => (
  <SelectPrimitive.Item
    ref={ref}
    className={cn(
      'relative flex w-full cursor-pointer select-none items-center gap-2.5 rounded-lg py-1.5 pl-2 pr-8 text-neutral4 text-ui-smd leading-ui-sm',
      'outline-none focus:outline-none focus-visible:outline-none',
      transitions.colors,
      'hover:bg-surface4 hover:text-neutral6',
      'focus:bg-surface4 focus:text-neutral6',
      'data-[highlighted]:bg-surface4 data-[highlighted]:text-neutral6',
      'data-[state=checked]:text-neutral6',
      'data-disabled:pointer-events-none data-disabled:opacity-50',
      className,
    )}
    {...props}
  >
    <span className="absolute right-2 flex h-3.5 w-3.5 items-center justify-center">
      <SelectPrimitive.ItemIndicator>
        <Check className="h-4 w-4 text-neutral6" />
      </SelectPrimitive.ItemIndicator>
    </span>
    <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
  </SelectPrimitive.Item>
));
SelectItem.displayName = SelectPrimitive.Item.displayName;

export { Select, SelectGroup, SelectValue, SelectTrigger, SelectContent, SelectItem };

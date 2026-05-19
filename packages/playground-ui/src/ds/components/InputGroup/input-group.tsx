import { cva } from 'class-variance-authority';
import type { VariantProps } from 'class-variance-authority';
import * as React from 'react';

import { Button } from '@/ds/components/Button';
import type { ButtonProps } from '@/ds/components/Button/Button';
import { formElementSizes, formElementFocusWithin, formElementRadius } from '@/ds/primitives/form-element';
import type { FormElementSize } from '@/ds/primitives/form-element';
import { transitions } from '@/ds/primitives/transitions';
import { cn } from '@/lib/utils';

const InputGroupSizeContext = React.createContext<FormElementSize>('md');

const inputGroupClassName = cn(
  'group/input-group relative flex w-full min-w-0 items-stretch',
  'bg-surface2 border border-border1 text-neutral6',
  'hover:border-border2',
  formElementRadius,
  formElementFocusWithin,
  transitions.all,
  'has-[:disabled]:opacity-50 has-[:disabled]:cursor-not-allowed',
  'has-[[aria-invalid=true]]:border-error has-[[aria-invalid=true]]:focus-within:ring-error has-[[aria-invalid=true]]:focus-within:shadow-glow-accent2',
  'has-[>[data-align=block-start]]:flex-col',
  'has-[>[data-align=block-end]]:flex-col',
  'has-[>[data-align=inline-start]]:[&>[data-slot=input-group-control]]:pl-0',
  'has-[>[data-align=inline-end]]:[&>[data-slot=input-group-control]]:pr-0',
  // In flex-col, flex-1 collapses the input to basis-0. Force flex-none so `h-form-*` applies.
  'has-[>[data-align=block-start]]:[&>[data-slot=input-group-control]]:flex-none has-[>[data-align=block-start]]:[&>[data-slot=input-group-control]]:w-full',
  'has-[>[data-align=block-end]]:[&>[data-slot=input-group-control]]:flex-none has-[>[data-align=block-end]]:[&>[data-slot=input-group-control]]:w-full',
);

export type InputGroupProps = React.ComponentPropsWithoutRef<'div'> & {
  size?: FormElementSize;
};

const InputGroup = React.forwardRef<HTMLDivElement, InputGroupProps>(({ className, size = 'md', ...props }, ref) => {
  return (
    <InputGroupSizeContext.Provider value={size}>
      <div ref={ref} role="group" data-slot="input-group" className={cn(inputGroupClassName, className)} {...props} />
    </InputGroupSizeContext.Provider>
  );
});
InputGroup.displayName = 'InputGroup';

const inputGroupAddonVariants = cva(
  cn(
    'flex items-center justify-center gap-2 text-neutral3 select-none',
    'group-has-[:disabled]/input-group:opacity-50',
    "[&>svg:not([class*='size-'])]:size-4",
  ),
  {
    variants: {
      align: {
        'inline-start': 'order-first pl-3 pr-1 has-[>button]:pl-1',
        'inline-end': 'order-last pr-3 pl-1 has-[>button]:pr-1',
        'block-start': 'order-first w-full justify-start px-3 pt-2 pb-1 border-b border-border1',
        'block-end': 'order-last w-full justify-start px-3 pb-2 pt-1 border-t border-border1',
      },
    },
    defaultVariants: {
      align: 'inline-start',
    },
  },
);

export type InputGroupAddonProps = React.ComponentPropsWithoutRef<'div'> & VariantProps<typeof inputGroupAddonVariants>;

const InputGroupAddon = React.forwardRef<HTMLDivElement, InputGroupAddonProps>(
  ({ className, align = 'inline-start', onClick, ...props }, ref) => {
    return (
      <div
        ref={ref}
        role="group"
        data-slot="input-group-addon"
        data-align={align}
        className={cn(inputGroupAddonVariants({ align }), className)}
        onClick={event => {
          // Click on non-interactive addon area focuses the control inside the group.
          // Skip when a button/input handled the click itself.
          const target = event.target as HTMLElement;
          if (!target.closest('button, input, textarea, [role="button"]')) {
            event.currentTarget.parentElement
              ?.querySelector<HTMLInputElement | HTMLTextAreaElement>('[data-slot=input-group-control]')
              ?.focus();
          }
          onClick?.(event);
        }}
        {...props}
      />
    );
  },
);
InputGroupAddon.displayName = 'InputGroupAddon';

const inputGroupControlTextSize: Record<FormElementSize, string> = {
  sm: 'text-ui-sm',
  md: 'text-ui-md',
  default: 'text-ui-md',
  lg: 'text-ui-lg',
};

export type InputGroupInputProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'> & {
  testId?: string;
  error?: boolean;
};

const InputGroupInput = React.forwardRef<HTMLInputElement, InputGroupInputProps>(
  ({ className, testId, error, type = 'text', ...props }, ref) => {
    const size = React.useContext(InputGroupSizeContext);
    return (
      <input
        ref={ref}
        type={type}
        data-slot="input-group-control"
        data-testid={testId}
        aria-invalid={error}
        className={cn(
          'flex-1 min-w-0 bg-transparent text-neutral6 px-3 outline-hidden',
          formElementSizes[size],
          inputGroupControlTextSize[size],
          'placeholder:text-neutral2 placeholder:transition-opacity placeholder:duration-normal',
          'focus:placeholder:opacity-70',
          'disabled:cursor-not-allowed',
          className,
        )}
        {...props}
      />
    );
  },
);
InputGroupInput.displayName = 'InputGroupInput';

export type InputGroupTextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement> & {
  testId?: string;
  error?: boolean;
};

const InputGroupTextarea = React.forwardRef<HTMLTextAreaElement, InputGroupTextareaProps>(
  ({ className, testId, error, ...props }, ref) => {
    const size = React.useContext(InputGroupSizeContext);
    return (
      <textarea
        ref={ref}
        data-slot="input-group-control"
        data-testid={testId}
        aria-invalid={error}
        className={cn(
          'flex-1 min-w-0 min-h-[60px] resize-y bg-transparent text-neutral6 px-3 py-2 outline-hidden',
          inputGroupControlTextSize[size],
          'placeholder:text-neutral2 placeholder:transition-opacity placeholder:duration-normal',
          'focus:placeholder:opacity-70',
          'disabled:cursor-not-allowed',
          className,
        )}
        {...props}
      />
    );
  },
);
InputGroupTextarea.displayName = 'InputGroupTextarea';

export type InputGroupTextProps = React.ComponentPropsWithoutRef<'span'>;

const InputGroupText = React.forwardRef<HTMLSpanElement, InputGroupTextProps>(({ className, ...props }, ref) => {
  return (
    <span
      ref={ref}
      className={cn(
        'flex items-center gap-2 text-ui-sm text-neutral3 [&_svg]:pointer-events-none',
        "[&_svg:not([class*='size-'])]:size-4",
        className,
      )}
      {...props}
    />
  );
});
InputGroupText.displayName = 'InputGroupText';

export type InputGroupButtonProps = Omit<ButtonProps, 'size' | 'variant'> & {
  size?: ButtonProps['size'];
  variant?: ButtonProps['variant'];
};

const InputGroupButton = React.forwardRef<HTMLButtonElement, InputGroupButtonProps>(
  ({ size = 'icon-sm', variant = 'ghost', type = 'button', ...props }, ref) => {
    return <Button ref={ref} type={type} size={size} variant={variant} {...props} />;
  },
);
InputGroupButton.displayName = 'InputGroupButton';

export { InputGroup, InputGroupAddon, InputGroupInput, InputGroupTextarea, InputGroupText, InputGroupButton };

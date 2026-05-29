import { cva } from 'class-variance-authority';
import type { VariantProps } from 'class-variance-authority';
import * as React from 'react';

import { Button } from '@/ds/components/Button';
import type { ButtonProps } from '@/ds/components/Button/Button';
import { formElementSizes, inputFocusBorderWithin, inputHoverBorderWithin } from '@/ds/primitives/form-element';
import type { FormElementSize } from '@/ds/primitives/form-element';
import { transitions } from '@/ds/primitives/transitions';
import { cn } from '@/lib/utils';

// No React context: size flows via `data-size` on the named group root
// (`group/input-group`) and is read by the control through `group-data-[size=…]`
// variants — mirrors shadcn's data-slot/data-* convention and removes prop drilling.

const inputGroupBaseClassName = cn(
  // `flex-1` (not `min-w-0`) lets the root fill a flex row while keeping its content-floor
  // so it never collapses to 0. `items-center` centres the control: it carries its own
  // h-form-* (2px taller than the root's content box), so stretch would push its text low
  // / overflow the bottom border, while centring overlaps the (transparent) borders cleanly.
  'group/input-group relative flex w-full flex-1 items-center',
  'border border-border1 text-neutral6',
  transitions.all,
  'has-[:disabled]:opacity-50 has-[:disabled]:cursor-not-allowed',
  'has-[[aria-invalid=true]]:border-error',
  // Height is on the root (border-box) so the group matches a same-size sibling control.
  // Auto height when vertical (block-* addon) or wrapping a textarea.
  'has-[>[data-align=block-start]]:flex-col has-[>[data-align=block-start]]:h-auto',
  'has-[>[data-align=block-end]]:flex-col has-[>[data-align=block-end]]:h-auto',
  'has-[textarea]:h-auto',
  'has-[>[data-align=inline-start]]:[&>[data-slot=input-group-control]]:pl-0',
  'has-[>[data-align=inline-end]]:[&>[data-slot=input-group-control]]:pr-0',
  // In flex-col, flex-1 zeroes the control's height; force flex-none + w-full instead.
  'has-[>[data-align=block-start]]:[&>[data-slot=input-group-control]]:flex-none has-[>[data-align=block-start]]:[&>[data-slot=input-group-control]]:w-full',
  'has-[>[data-align=block-end]]:[&>[data-slot=input-group-control]]:flex-none has-[>[data-align=block-end]]:[&>[data-slot=input-group-control]]:w-full',
);

const inputGroupRoundedTextareaClassName = cn(
  // Pill (rounded-full) only fits single-line inline shapes. Fall back to rounded-xl
  // whenever the group goes vertical (block-* addon) or wraps a textarea.
  'has-[>[data-align=block-start]]:rounded-xl',
  'has-[>[data-align=block-end]]:rounded-xl',
  'has-[textarea]:rounded-xl',
);

// `default` and `filled` are the same filled surface on purpose (the default look IS
// the filled treatment; `filled` is an explicit alias). Share the string so they can't
// drift. Focus brightens the border (inputFocusBorderWithin) for WCAG-visible focus.
const inputGroupFilledVariant = cn(
  'bg-surface-overlay-soft rounded-full',
  'hover:bg-surface-overlay-strong',
  inputHoverBorderWithin,
  'outline-hidden focus-within:outline-hidden focus-within:bg-surface-overlay-strong',
  inputFocusBorderWithin,
  inputGroupRoundedTextareaClassName,
);

const inputGroupVariants = cva(inputGroupBaseClassName, {
  variants: {
    variant: {
      default: inputGroupFilledVariant,
      filled: inputGroupFilledVariant,
      outline: cn(
        'bg-transparent rounded-full',
        inputHoverBorderWithin,
        'outline-hidden focus-within:outline-hidden',
        inputFocusBorderWithin,
        inputGroupRoundedTextareaClassName,
      ),
    },
  },
  defaultVariants: {
    variant: 'default',
  },
});

export type InputGroupProps = React.ComponentPropsWithoutRef<'div'> & {
  size?: FormElementSize;
} & VariantProps<typeof inputGroupVariants>;

const InputGroup = React.forwardRef<HTMLDivElement, InputGroupProps>(
  ({ className, size = 'md', variant, ...props }, ref) => {
    return (
      <div
        ref={ref}
        role="group"
        data-slot="input-group"
        data-size={size}
        className={cn(inputGroupVariants({ variant }), formElementSizes[size], className)}
        {...props}
      />
    );
  },
);
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

// Size flows from the parent group's `data-size` (no React context). All four sizes are
// written out so Tailwind's scanner emits them. The control mirrors the root height so it
// doesn't collapse to the line-height in block mode (flex-col + flex-none); the root's
// explicit border-box height means this never makes the group grow.
const inputGroupControlHeightBySize = cn(
  'group-data-[size=sm]/input-group:h-form-sm',
  'group-data-[size=md]/input-group:h-form-md',
  'group-data-[size=default]/input-group:h-form-default',
  'group-data-[size=lg]/input-group:h-form-lg',
);
const inputGroupControlTextBySize = cn(
  'group-data-[size=sm]/input-group:text-ui-sm',
  'group-data-[size=md]/input-group:text-ui-md',
  'group-data-[size=default]/input-group:text-ui-md',
  'group-data-[size=lg]/input-group:text-ui-lg',
);

export type InputGroupInputProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'> & {
  testId?: string;
  error?: boolean;
};

const InputGroupInput = React.forwardRef<HTMLInputElement, InputGroupInputProps>(
  ({ className, testId, error, type = 'text', ...props }, ref) => {
    return (
      <input
        ref={ref}
        type={type}
        data-slot="input-group-control"
        data-testid={testId}
        aria-invalid={error}
        className={cn(
          // Height matches the root box (which is fixed/border-box, so it doesn't grow);
          // this also keeps the control from collapsing in block mode (flex-col).
          'flex-1 min-w-0 bg-transparent text-neutral6 px-3 outline-hidden',
          inputGroupControlHeightBySize,
          inputGroupControlTextBySize,
          'placeholder:text-neutral2 placeholder:transition-opacity placeholder:duration-normal',
          'focus:placeholder:opacity-70',
          'disabled:cursor-not-allowed',
          // Hide native number-spinner arrows so consumers can compose their own
          // stepper (see the NumberWithStepper story). WebKit uses the spin-button
          // pseudo-elements; Firefox needs `appearance: textfield` on the input.
          '[&::-webkit-outer-spin-button]:appearance-none [&::-webkit-outer-spin-button]:m-0',
          '[&::-webkit-inner-spin-button]:appearance-none [&::-webkit-inner-spin-button]:m-0',
          '[&[type=number]]:[appearance:textfield]',
          // type="search": drop WebKit's native clear button so it doesn't double up with a
          // custom clear control (e.g. the scorers toolbar's InputGroupButton).
          '[&::-webkit-search-cancel-button]:appearance-none',
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
    return (
      <textarea
        ref={ref}
        data-slot="input-group-control"
        data-testid={testId}
        aria-invalid={error}
        className={cn(
          'flex-1 min-w-0 min-h-[60px] resize-y bg-transparent text-neutral6 px-3 py-2 outline-hidden',
          inputGroupControlTextBySize,
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

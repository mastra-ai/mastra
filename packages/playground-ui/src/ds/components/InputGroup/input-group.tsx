import { cva } from 'class-variance-authority';
import type { VariantProps } from 'class-variance-authority';
import * as React from 'react';

import { Button } from '@/ds/components/Button';
import type { ButtonProps } from '@/ds/components/Button/Button';
import { controlHeight } from '@/ds/primitives/control-size';
import type { ControlSize } from '@/ds/primitives/control-size';
import { inputSurfaceAndFocusWithinStyle } from '@/ds/primitives/form-element';
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
  // The wrapper owns its control's width — a bare control has no width of its own,
  // so the group is the one that decides the input fills the remaining space.
  '[&>[data-slot=input-group-control]]:min-w-0 [&>[data-slot=input-group-control]]:flex-1',
  'text-foreground',
  'has-[:disabled]:cursor-not-allowed has-[:disabled]:text-muted-foreground',
  // Height is on the root (border-box) so the group matches a same-size sibling control.
  // Auto height when vertical (block-* addon) or wrapping a textarea.
  'has-[>[data-align=block-start]]:h-auto has-[>[data-align=block-start]]:flex-col',
  'has-[>[data-align=block-end]]:h-auto has-[>[data-align=block-end]]:flex-col',
  'has-[textarea]:h-auto',
  'has-[>[data-align=inline-start]]:[&>[data-slot=input-group-control]]:pl-0',
  'has-[>[data-align=inline-end]]:[&>[data-slot=input-group-control]]:pr-0',
  // In flex-col, flex-1 zeroes the control's height; force flex-none + w-full instead.
  'has-[>[data-align=block-start]]:[&>[data-slot=input-group-control]]:w-full has-[>[data-align=block-start]]:[&>[data-slot=input-group-control]]:flex-none',
  'has-[>[data-align=block-end]]:[&>[data-slot=input-group-control]]:w-full has-[>[data-align=block-end]]:[&>[data-slot=input-group-control]]:flex-none',
);

const inputGroupRoundedTextareaClassName = cn(
  // Pill (rounded-full) only fits single-line inline shapes. Fall back to rounded-xl
  // whenever the group goes vertical (block-* addon) or wraps a textarea.
  'has-[>[data-align=block-start]]:rounded-xl',
  'has-[>[data-align=block-end]]:rounded-xl',
  'has-[textarea]:rounded-xl',
);

// A group wears the field material — the same `bg-card` plus rim an Input wears — so a
// group and a bare field beside it are one surface. Its states move the rim, and they
// read the nested control's focus (`focus-within`) because the wrapper never takes focus
// itself. There is no second look: a transparent `outline` group existed alongside this
// one and only ever produced two boundary languages for the same control, which is why
// four of its call sites had wrapped it in a hand-made `bg-card rounded-full` div to get
// the material back.
const inputGroupClassName = cn(
  inputGroupBaseClassName,
  'rounded-full',
  inputSurfaceAndFocusWithinStyle,
  'has-[[aria-invalid=true]]:[--surface-rim:var(--destructive)]',
  inputGroupRoundedTextareaClassName,
);

export type InputGroupProps = React.ComponentPropsWithoutRef<'div'> & {
  size?: ControlSize;
};

const InputGroup = React.forwardRef<HTMLDivElement, InputGroupProps>(({ className, size = 'md', ...props }, ref) => {
  return (
    <div
      ref={ref}
      role="group"
      data-slot="input-group"
      data-size={size}
      className={cn(inputGroupClassName, controlHeight[size], className)}
      {...props}
    />
  );
});
InputGroup.displayName = 'InputGroup';

const inputGroupControlTextBySize = cn(
  'group-data-[size=sm]/input-group:text-caption',
  'group-data-[size=md]/input-group:text-body-sm',
  'group-data-[size=lg]/input-group:text-body',
);

const inputGroupAddonVariants = cva(
  cn(
    'flex items-center justify-center gap-2 text-muted-foreground select-none',
    inputGroupControlTextBySize,
    'group-has-[:disabled]/input-group:text-muted-foreground',
    "[&>svg:not([class*='size-'])]:size-4",
  ),
  {
    variants: {
      align: {
        'inline-start': 'order-first pr-1 pl-3 has-[>button]:pl-1',
        'inline-end': 'order-last pr-3 pl-1 has-[>button]:pr-1',
        'block-start': 'order-first w-full justify-start border-b border-border px-3 pt-2 pb-1',
        'block-end': 'order-last w-full justify-start border-t border-border px-3 pt-1 pb-2',
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
// written out so Tailwind's scanner emits them. The control is sized to the root's
// content box (token height minus the 1px border on each side) so it never overflows the
// root — otherwise, in a flex-column parent, the root's content-based minimum would win
// over its explicit height and the group would render 2px taller than a sibling control.
// The explicit height also keeps the control from collapsing to the line-height in block
// mode (flex-col + flex-none).
const inputGroupControlHeightBySize = cn(
  'group-data-[size=sm]/input-group:h-[calc(var(--spacing-control-sm)-2px)]',
  'group-data-[size=md]/input-group:h-[calc(var(--spacing-control-md)-2px)]',
  'group-data-[size=lg]/input-group:h-[calc(var(--spacing-control-lg)-2px)]',
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
          // Height fits the root's content box (see inputGroupControlHeightBySize).
          'min-w-0 flex-1 bg-transparent px-3 text-foreground outline-hidden',
          inputGroupControlHeightBySize,
          inputGroupControlTextBySize,
          'placeholder:text-muted-foreground placeholder:transition-opacity placeholder:duration-normal',
          'focus:placeholder:opacity-70',
          'disabled:cursor-not-allowed',
          // Hide native number-spinner arrows so consumers can compose their own
          // stepper (see the NumberWithStepper story). WebKit uses the spin-button
          // pseudo-elements; Firefox needs `appearance: textfield` on the input.
          '[&::-webkit-outer-spin-button]:m-0 [&::-webkit-outer-spin-button]:appearance-none',
          '[&::-webkit-inner-spin-button]:m-0 [&::-webkit-inner-spin-button]:appearance-none',
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
          'min-h-15 min-w-0 flex-1 resize-y bg-transparent px-3 py-2 text-foreground outline-hidden',
          inputGroupControlTextBySize,
          'placeholder:text-muted-foreground placeholder:transition-opacity placeholder:duration-normal',
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
        'flex items-center gap-2 text-caption text-muted-foreground [&_svg]:pointer-events-none',
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

import * as React from 'react';
import { controlTriggerOpenStateFor } from './control-size';
import { Button } from '@/ds/components/Button';
import type { ButtonProps } from '@/ds/components/Button';
import { cn } from '@/lib/utils';

/**
 * Props shared by every click-to-open trigger (DropdownMenu, Popover, …) that is
 * a button. A trigger IS a Button, so it accepts the Button's public look props
 * and renders a design-system `<Button>` by default — no more
 * `render={<Button />}` / `asChild` boilerplate at every call site.
 */
export type TriggerButtonProps = Pick<ButtonProps, 'variant' | 'size' | 'tooltip'> & {
  className?: string;
  /** @deprecated Use Base UI's native `render` prop instead for stronger composition typing. */
  asChild?: boolean;
};

/**
 * Decides what a Base UI trigger renders:
 * - `render` provided → the call site owns the look; `variant`/`size`/`tooltip` are ignored.
 * - `asChild` + element child → that child is rendered (legacy Radix-style shim).
 * - otherwise → a `<Button>` with the given look, plus the shared `data-[popup-open]`
 *   state for the form-style variants so it reads "active" like Select/Combobox.
 */
export function resolveTriggerRender<Render>({
  render,
  asChild,
  children,
  variant = 'default',
  size,
  tooltip,
  className,
}: {
  render?: Render;
  children?: React.ReactNode;
} & TriggerButtonProps): {
  render: Render | React.ReactElement;
  children?: React.ReactNode;
  /** `className` to put on the Base UI trigger — only when the call site owns the look. */
  className?: string;
} {
  if (render) {
    return { render, children, className };
  }

  if (asChild && React.isValidElement(children)) {
    return { render: children as React.ReactElement, className };
  }

  return {
    render: (
      <Button
        variant={variant}
        size={size}
        tooltip={tooltip}
        className={cn(controlTriggerOpenStateFor(variant), className)}
      >
        {children}
      </Button>
    ),
  };
}

import { Collapsible } from '@base-ui/react/collapsible';
import type { ComponentProps } from 'react';

import { cn } from '@/lib/utils';

import './composer-header.css';

export interface ComposerHeaderProps extends ComponentProps<'div'> {
  /** Animate visibility while retaining content through the closing transition. */
  open?: boolean;
  /**
   * `stacked` takes space above the composer. `overlay` floats over the content above it so
   * opening the header never moves the transcript; the parent must be positioned.
   */
  placement?: 'stacked' | 'overlay';
}

/** Optional context above ComposerRing or ComposerBox. Empty rendered content occupies no space. */
export function ComposerHeader({
  className,
  children,
  open = true,
  placement = 'stacked',
  ...props
}: ComposerHeaderProps) {
  return (
    <Collapsible.Root
      open={open}
      data-slot="composer-header"
      data-placement={placement}
      className={cn('composer-header relative isolate mx-auto w-full max-w-3xl', className)}
      {...props}
    >
      <Collapsible.Panel className="composer-header-panel">
        <div
          data-slot="composer-header-surface"
          className="flex flex-col gap-3 overflow-hidden rounded-t-[23px] border border-b-0 border-surface-rim bg-card px-3 pt-3 pb-8 text-body-sm text-muted-foreground empty:hidden"
        >
          {children}
        </div>
      </Collapsible.Panel>
    </Collapsible.Root>
  );
}

export interface ComposerHeaderRowProps extends ComponentProps<'div'> {
  tone?: 'default' | 'destructive' | 'success';
}

export function ComposerHeaderRow({ className, tone = 'default', ...props }: ComposerHeaderRowProps) {
  return (
    <div
      data-slot="composer-header-row"
      className={cn(
        'flex min-w-0 flex-wrap items-center gap-2 [&>svg]:size-icon-sm [&>svg]:shrink-0',
        tone === 'destructive' && 'text-destructive-foreground',
        tone === 'success' && 'text-success-indicator',
        className,
      )}
      {...props}
    />
  );
}

export type ComposerHeaderContentProps = ComponentProps<'div'>;

export function ComposerHeaderContent({ className, ...props }: ComposerHeaderContentProps) {
  return (
    <div data-slot="composer-header-content" className={cn('min-w-0 flex-1 wrap-anywhere', className)} {...props} />
  );
}

export type ComposerHeaderActionsProps = ComponentProps<'div'>;

export function ComposerHeaderActions({ className, ...props }: ComposerHeaderActionsProps) {
  return (
    <div
      data-slot="composer-header-actions"
      className={cn('ml-auto flex max-w-full shrink-0 flex-wrap items-center gap-2', className)}
      {...props}
    />
  );
}

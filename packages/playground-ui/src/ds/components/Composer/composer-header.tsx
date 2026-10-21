import type { ComponentPropsWithoutRef } from 'react';
import { forwardRef } from 'react';

import { cn } from '@/lib/utils';

import './composer-header.css';

export type ComposerHeaderProps = ComponentPropsWithoutRef<'div'>;

/** Optional context above ComposerRing or ComposerBox. Empty rendered content occupies no space. */
export const ComposerHeader = forwardRef<HTMLDivElement, ComposerHeaderProps>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    data-slot="composer-header"
    className={cn(
      'composer-header relative isolate mx-auto -mb-6 flex w-full max-w-3xl flex-col gap-3 overflow-hidden rounded-t-[23px] border border-b-0 border-surface-rim bg-card px-3 pt-3 pb-8 text-body-sm text-muted-foreground empty:hidden',
      className,
    )}
    {...props}
  />
));
ComposerHeader.displayName = 'ComposerHeader';

export interface ComposerHeaderRowProps extends ComponentPropsWithoutRef<'div'> {
  tone?: 'default' | 'destructive';
}

export const ComposerHeaderRow = forwardRef<HTMLDivElement, ComposerHeaderRowProps>(
  ({ className, tone = 'default', ...props }, ref) => (
    <div
      ref={ref}
      data-slot="composer-header-row"
      className={cn(
        'flex min-w-0 flex-wrap items-center gap-2 [&>svg]:size-icon-sm [&>svg]:shrink-0',
        tone === 'destructive' && 'text-destructive-foreground',
        className,
      )}
      {...props}
    />
  ),
);
ComposerHeaderRow.displayName = 'ComposerHeaderRow';

export type ComposerHeaderContentProps = ComponentPropsWithoutRef<'div'>;

export const ComposerHeaderContent = forwardRef<HTMLDivElement, ComposerHeaderContentProps>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      data-slot="composer-header-content"
      className={cn('min-w-0 flex-1 wrap-anywhere', className)}
      {...props}
    />
  ),
);
ComposerHeaderContent.displayName = 'ComposerHeaderContent';

export type ComposerHeaderActionsProps = ComponentPropsWithoutRef<'div'>;

export const ComposerHeaderActions = forwardRef<HTMLDivElement, ComposerHeaderActionsProps>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      data-slot="composer-header-actions"
      className={cn('ml-auto flex max-w-full shrink-0 flex-wrap items-center gap-2', className)}
      {...props}
    />
  ),
);
ComposerHeaderActions.displayName = 'ComposerHeaderActions';

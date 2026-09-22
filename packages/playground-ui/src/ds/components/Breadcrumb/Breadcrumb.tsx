import React from 'react';

import { Icon } from '../../icons/Icon';
import { SlashIcon } from '../../icons/SlashIcon';
import { Skeleton } from '@/ds/components/Skeleton';
import { controlSizeClasses } from '@/ds/primitives/control-size';
import { controlStateColorTransition } from '@/ds/primitives/transitions';
import { quietTextHover } from '@/ds/primitives/typography';
import { cn } from '@/lib/utils';

export interface BreadcrumbProps {
  children?: React.ReactNode;
  label?: string;
  className?: string;
  listClassName?: string;
}

export const Breadcrumb = ({ children, label, className, listClassName }: BreadcrumbProps) => {
  return (
    <nav aria-label={label} className={className}>
      <ol className={cn('flex items-center gap-0.5', listClassName)}>{children}</ol>
    </nav>
  );
};

export interface CrumbProps {
  isCurrent?: boolean;
  as: React.ElementType;
  className?: string;
  to?: string;
  prefetch?: boolean | null;
  children?: React.ReactNode;
  /** Prefix icon (bare SVG). The crumb wraps it in `<Icon>` and aligns it like a Button adornment. */
  icon?: React.ReactNode;
  /** Renders `CrumbSkeleton` in place of the label. */
  isLoading?: boolean;
  /**
   * Sibling control rendered next to the label (never inside it). Expected to be a
   * `size="icon-sm"` ghost control: an icon-only Combobox switcher, a CopyButton, …
   */
  action?: React.ReactNode;
  'data-testid'?: string;
}

export const CrumbSkeleton = (props: { 'data-testid'?: string }) => <Skeleton className="h-3 w-24" {...props} />;

export const Crumb = ({ className, as, isCurrent, action, icon, isLoading, children, ...props }: CrumbProps) => {
  const Root = as || 'span';

  return (
    <>
      <li className={cn('group flex h-control-sm min-w-0 items-center', isCurrent ? 'shrink' : 'shrink-0')}>
        <Root
          aria-current={isCurrent ? 'page' : undefined}
          className={cn(
            // Same box as `buttonVariants({ variant: 'ghost', size: 'sm' })` so a label and an
            // icon-sm control sitting next to it share height, radius, padding and colors.
            'inline-flex min-w-0 items-center gap-2 overflow-hidden rounded-full px-[.9em]',
            controlSizeClasses.sm,
            controlStateColorTransition,
            // Long labels truncate: the current crumb gets more room than nav crumbs.
            isCurrent
              ? 'max-w-xs cursor-default text-foreground'
              : cn(quietTextHover, 'max-w-48 cursor-pointer hover:bg-fill-subtle active:bg-fill'),
            className,
          )}
          {...props}
        >
          {icon && (
            <Icon
              className={cn(
                '-ml-[.3em] shrink-0 opacity-50 group-hover:opacity-100',
                'transition-opacity duration-normal ease-out-custom',
              )}
            >
              {icon}
            </Icon>
          )}
          {isLoading ? (
            <CrumbSkeleton />
          ) : (
            // `text-overflow` needs a block container, so the label truncates in its
            // own box rather than on the flex Root. Works for plain strings and for
            // components that resolve to a string (route-header `Component` crumbs).
            <span className="min-w-0 flex-1 truncate">{children}</span>
          )}
        </Root>
        {action && <span className="h-control-sm -ml-1 flex shrink-0 items-center">{action}</span>}
      </li>
      {!isCurrent && (
        <li role="separator" className="flex h-full items-center">
          <Icon className="text-placeholder">
            <SlashIcon />
          </Icon>
        </li>
      )}
    </>
  );
};

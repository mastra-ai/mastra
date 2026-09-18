import type { ElementType, ReactNode } from 'react';

import { useBreadcrumbSeparator } from './breadcrumb-context';
import type { BreadcrumbSeparator } from './breadcrumb-context';
import { Skeleton } from '@/ds/components/Skeleton';
import { ChevronIcon } from '@/ds/icons/ChevronIcon';
import { Icon } from '@/ds/icons/Icon';
import { SlashIcon } from '@/ds/icons/SlashIcon';
import { controlSizeClasses } from '@/ds/primitives/control-size';
import { transitions } from '@/ds/primitives/transitions';
import { cn } from '@/lib/utils';

export interface CrumbProps {
  isCurrent?: boolean;
  as: ElementType;
  className?: string;
  to?: string;
  prefetch?: boolean | null;
  children?: ReactNode;
  icon?: ReactNode;
  isLoading?: boolean;
  action?: ReactNode;
  separator?: BreadcrumbSeparator;
  'data-testid'?: string;
}

export function CrumbSkeleton(props: { 'data-testid'?: string }) {
  return <Skeleton className="h-3 w-24" {...props} />;
}

export function Crumb({
  className,
  as,
  isCurrent,
  action,
  icon,
  isLoading,
  children,
  separator,
  ...props
}: CrumbProps) {
  const contextSeparator = useBreadcrumbSeparator();
  const Root = as || 'span';
  const separatorIcon = separator ?? contextSeparator;

  return (
    <>
      <li className={cn('group flex h-form-sm min-w-0 items-center', isCurrent ? 'shrink' : 'shrink-0')}>
        <Root
          aria-current={isCurrent ? 'page' : undefined}
          className={cn(
            'inline-flex min-w-0 items-center gap-2 overflow-hidden rounded-full px-[.9em]',
            controlSizeClasses.sm,
            transitions.colors,
            isCurrent
              ? cn(
                  'max-w-xs cursor-default',
                  action ? 'text-muted-foreground group-hover:text-foreground' : 'text-foreground',
                )
              : cn(
                  'max-w-48 cursor-pointer text-muted-foreground hover:text-foreground',
                  !action && 'hover:bg-foreground/4 active:bg-foreground/10',
                ),
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
            <span className="flex min-w-0 flex-1 items-center truncate">{children}</span>
          )}
        </Root>
        {action && <span className="h-form-sm -ml-1 flex shrink-0 items-center">{action}</span>}
      </li>
      {!isCurrent && (
        <li aria-hidden="true" className="flex h-full items-center">
          <Icon className={cn('text-muted-foreground/50', transitions.colors)}>
            {separatorIcon === 'chevron' ? <ChevronIcon className="-rotate-90" /> : <SlashIcon />}
          </Icon>
        </li>
      )}
    </>
  );
}

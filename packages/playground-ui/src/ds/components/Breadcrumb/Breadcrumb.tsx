import React from 'react';

import { Icon } from '../../icons/Icon';
import { SlashIcon } from '../../icons/SlashIcon';
import { cn } from '@/lib/utils';

export interface BreadcrumbProps {
  children?: React.ReactNode;
  label?: string;
}

export const Breadcrumb = ({ children, label }: BreadcrumbProps) => {
  return (
    <nav aria-label={label}>
      <ol className="gap-0.5 flex items-center">{children}</ol>
    </nav>
  );
};

export interface CrumbProps {
  isCurrent?: boolean;
  as: React.ElementType;
  className?: string;
  to: string;
  prefetch?: boolean | null;
  children: React.ReactNode;
  action?: React.ReactNode;
}

export const Crumb = ({ className, as, isCurrent, action, ...props }: CrumbProps) => {
  const Root = as || 'span';

  return (
    <>
      <li className="flex h-full shrink-0 items-center gap-1">
        <Root
          aria-current={isCurrent ? 'page' : undefined}
          className={cn(
            'text-ui-md leading-ui-md flex items-center gap-2',
            isCurrent ? 'text-white' : 'text-neutral3',
            className,
          )}
          {...props}
        />
        {action}
      </li>
      {!isCurrent && (
        <li role="separator" className="flex h-full items-center">
          <Icon className="text-neutral3">
            <SlashIcon />
          </Icon>
        </li>
      )}
    </>
  );
};

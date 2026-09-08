import React from 'react';

import { Icon } from '../../icons/Icon';
import { SlashIcon } from '../../icons/SlashIcon';
import { transitions } from '@/ds/primitives/transitions';
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
  children: React.ReactNode;
  action?: React.ReactNode;
  'data-testid'?: string;
}

// `text-overflow` needs a block container, so the label truncates in its own
// box rather than on the flex Root. Icons stay siblings to keep `gap-2`.
const crumbTextTruncateStyles = 'min-w-0 flex-1 truncate';

const truncateTextChildren = (children: React.ReactNode) =>
  React.Children.map(children, child =>
    typeof child === 'string' || typeof child === 'number' ? (
      <span className={crumbTextTruncateStyles}>{child}</span>
    ) : (
      child
    ),
  );

export const Crumb = ({ className, as, isCurrent, action, children, ...props }: CrumbProps) => {
  const Root = as || 'span';

  return (
    <>
      <li className={cn('flex h-full min-w-0 items-center gap-1', isCurrent ? 'shrink' : 'shrink-0')}>
        <Root
          aria-current={isCurrent ? 'page' : undefined}
          className={cn(
            'flex min-w-0 items-center gap-2 overflow-hidden rounded-md px-1 py-0.5 text-ui-sm leading-ui-sm',
            transitions.colors,
            isCurrent
              ? 'font-medium text-neutral6'
              : 'cursor-pointer text-neutral3 hover:bg-neutral6/5 hover:text-neutral5 active:bg-neutral6/10',
            className,
          )}
          {...props}
        >
          {truncateTextChildren(children)}
        </Root>
        {action}
      </li>
      {!isCurrent && (
        <li role="separator" className="flex h-full items-center">
          <Icon className={cn('text-neutral2', transitions.colors)}>
            <SlashIcon />
          </Icon>
        </li>
      )}
    </>
  );
};

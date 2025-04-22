import clsx from 'clsx';
import React from 'react';

import { Icon } from '../../icons/Icon';
import { SlashIcon } from '../../icons/SlashIcon';
import { PolymorphicComponentProps } from '../types';

export interface BreadcrumbProps {
  children?: React.ReactNode;
  label?: string;
}

export const Breadcrumb = ({ children, label }: BreadcrumbProps) => {
  return (
    <nav aria-label={label}>
      <ol className="gap-sm flex items-center">{children}</ol>
    </nav>
  );
};

export interface CrumbProps {
  isCurrent?: boolean;
  as: React.ElementType;
  className?: string;
  href: string;
  prefetch?: boolean | null;
  children: React.ReactNode;
}

export const Crumb = ({ className, as, isCurrent, ...props }: CrumbProps) => {
  const Root = as || 'span';

  return (
    <>
      <li className="flex h-full items-center">
        <Root
          aria-current={isCurrent ? 'page' : undefined}
          className={clsx('text-ui-lg leading-ui-lg font-medium', isCurrent ? 'text-white' : 'text-icon3', className)}
          {...props}
        />
      </li>
      {!isCurrent && (
        <li role="separator" className="flex h-full items-center">
          <Icon className="text-icon3">
            <SlashIcon />
          </Icon>
        </li>
      )}
    </>
  );
};

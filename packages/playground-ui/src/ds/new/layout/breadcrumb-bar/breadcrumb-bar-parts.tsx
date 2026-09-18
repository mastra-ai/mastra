import type { ReactNode } from 'react';

import { useBreadcrumbBarCrumb } from './breadcrumb-bar-context';
import { BreadcrumbBarCrumb } from './breadcrumb-bar-crumb';
import { cn } from '@/lib/utils';

export interface BreadcrumbBarItemProps {
  children: ReactNode;
  pathname?: string;
}

export interface BreadcrumbBarSwitcherCrumbProps {
  children: ReactNode;
  className?: string;
}

export interface BreadcrumbBarSwitcherPartProps {
  children: ReactNode;
}

export function BreadcrumbBarItem({ children }: BreadcrumbBarItemProps) {
  return children;
}

export function BreadcrumbBarSwitcherCrumb({ children, className }: BreadcrumbBarSwitcherCrumbProps) {
  const crumb = useBreadcrumbBarCrumb();

  return (
    <BreadcrumbBarCrumb
      as="span"
      isCurrent={crumb?.isLeaf}
      className={cn('group/switcher has-[button:active]:bg-neutral6/15 has-[button:hover]:bg-neutral6/10', className)}
    >
      {children}
    </BreadcrumbBarCrumb>
  );
}

export function BreadcrumbBarSwitcherTrigger({ children }: BreadcrumbBarSwitcherPartProps) {
  return (
    <span className="contents [&_button:active]:!bg-transparent [&_button:hover]:!bg-transparent">{children}</span>
  );
}

export function BreadcrumbBarSwitcherIndicator({ children }: BreadcrumbBarSwitcherPartProps) {
  return (
    <span
      className={cn(
        'flex max-w-0 shrink-0 items-center overflow-hidden opacity-0',
        'transition-[max-width,opacity] duration-normal ease-in-out motion-reduce:transition-none',
        'group-focus-within/switcher:max-w-5 group-focus-within/switcher:opacity-100 group-hover/switcher:max-w-5 group-hover/switcher:opacity-100 pointer-coarse:max-w-5 pointer-coarse:opacity-100',
      )}
    >
      {children}
    </span>
  );
}

export function BreadcrumbBarSwitcherAction({ children }: BreadcrumbBarSwitcherPartProps) {
  return (
    <span
      className={cn(
        'flex max-w-0 shrink-0 items-center overflow-hidden opacity-0',
        'transition-[max-width,opacity] duration-normal ease-in-out motion-reduce:transition-none',
        'group-focus-within/switcher:max-w-7 group-focus-within/switcher:opacity-100 group-hover/switcher:max-w-7 group-hover/switcher:opacity-100 pointer-coarse:max-w-7 pointer-coarse:opacity-100',
      )}
    >
      {children}
    </span>
  );
}

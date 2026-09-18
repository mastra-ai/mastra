import type { ReactNode } from 'react';

import {
  BreadcrumbBarCrumb as Crumb,
  BreadcrumbBarCrumbSkeleton as CrumbSkeleton,
} from '@/ds/new/layout/breadcrumb-bar/breadcrumb-bar-crumb';
import type { BreadcrumbBarCrumbProps as CrumbProps } from '@/ds/new/layout/breadcrumb-bar/breadcrumb-bar-crumb';
import { cn } from '@/lib/utils';

export interface BreadcrumbProps {
  children?: ReactNode;
  label?: string;
  className?: string;
  listClassName?: string;
}

export function Breadcrumb({ children, label, className, listClassName }: BreadcrumbProps) {
  return (
    <nav aria-label={label} className={className}>
      <ol className={cn('flex items-center gap-0.5', listClassName)}>{children}</ol>
    </nav>
  );
}

export { Crumb, CrumbSkeleton };
export type { CrumbProps };

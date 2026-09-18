import type { ReactNode } from 'react';

import { BreadcrumbSeparatorContext } from './breadcrumb-context';
import type { BreadcrumbSeparator } from './breadcrumb-context';
import { cn } from '@/lib/utils';

export interface BreadcrumbRootProps {
  children?: ReactNode;
  label?: string;
  className?: string;
  listClassName?: string;
  separator?: BreadcrumbSeparator;
}

export function BreadcrumbRoot({
  children,
  label,
  className,
  listClassName,
  separator = 'slash',
}: BreadcrumbRootProps) {
  return (
    <BreadcrumbSeparatorContext.Provider value={separator}>
      <nav aria-label={label} className={cn('new-theme', className)}>
        <ol className={cn('flex items-center gap-0.5', listClassName)}>{children}</ol>
      </nav>
    </BreadcrumbSeparatorContext.Provider>
  );
}

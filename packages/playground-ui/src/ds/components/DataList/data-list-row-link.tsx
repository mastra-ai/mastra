import type { CSSProperties, ReactNode } from 'react';
import { useDataListRowWrapperContext } from './data-list-row-wrapper-context';
import { dataListRowInteractiveStyles, dataListRowStyles } from './shared';
import type { DataListRowSharedProps } from './shared';
import type { LinkComponent } from '@/ds/types/link-component';
import { cn } from '@/lib/utils';

export type DataListRowLinkProps = DataListRowSharedProps & {
  children: ReactNode;
  to: string;
  className?: string;
  style?: CSSProperties;
  LinkComponent: LinkComponent;
};

export function DataListRowLink({
  children,
  to,
  className,
  style,
  LinkComponent: Link,
  flushLeft,
  flushRight,
  colStart,
  colEnd,
  featured,
}: DataListRowLinkProps) {
  const isWrapped = useDataListRowWrapperContext();
  const hasColumnOverride = colStart !== undefined || colEnd !== undefined;
  const resolvedStyle = hasColumnOverride ? { ...style, gridColumn: `${colStart ?? 1} / ${colEnd ?? -1}` } : style;
  return (
    <Link
      href={to}
      className={cn(
        ...(isWrapped ? dataListRowInteractiveStyles : dataListRowStyles),
        !isWrapped && flushLeft && 'ml-0!',
        !isWrapped && flushRight && 'mr-0!',
        featured && 'bg-surface4',
        className,
      )}
      style={resolvedStyle}
    >
      {children}
    </Link>
  );
}

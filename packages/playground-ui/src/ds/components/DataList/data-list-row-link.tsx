import type { CSSProperties, ComponentPropsWithoutRef, ReactNode } from 'react';
import { useDataListRowWrapperContext } from './data-list-row-wrapper-context';
import { dataListRowInteractiveStyles, dataListRowStyles, dataListRowVariants } from './shared';
import type { DataListRowSharedProps } from './shared';
import type { LinkComponent } from '@/ds/types/link-component';
import { cn } from '@/lib/utils';

export type DataListRowLinkProps = DataListRowSharedProps & {
  children: ReactNode;
  to: string;
  className?: string;
  style?: CSSProperties;
  LinkComponent?: LinkComponent;
} & Omit<ComponentPropsWithoutRef<'a'>, 'href' | 'children' | 'className' | 'style'>;

export function DataListRowLink({
  children,
  to,
  className,
  style,
  LinkComponent: Link = 'a',
  colStart,
  colEnd,
  featured,
  variant,
  ...rest
}: DataListRowLinkProps) {
  const isWrapped = useDataListRowWrapperContext();
  const hasColumnOverride = colStart !== undefined || colEnd !== undefined;
  const resolvedStyle = hasColumnOverride ? { ...style, gridColumn: `${colStart ?? 1} / ${colEnd ?? -1}` } : style;
  return (
    <Link
      href={to}
      className={cn(
        ...(isWrapped ? dataListRowInteractiveStyles : dataListRowStyles),
        // `!` so the selection fill wins over borderless table root styling
        // (higher-specificity descendant rules); same color in `default`.
        featured && 'bg-surface-row-featured!',
        dataListRowVariants({ variant }),
        className,
      )}
      style={resolvedStyle}
      {...rest}
    >
      {children}
    </Link>
  );
}

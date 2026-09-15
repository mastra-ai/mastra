import { forwardRef } from 'react';
import type { CSSProperties, ComponentPropsWithoutRef, ReactNode } from 'react';
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
  LinkComponent?: LinkComponent;
} & Omit<ComponentPropsWithoutRef<'a'>, 'href' | 'children' | 'className' | 'style'>;

export const DataListRowLink = forwardRef<HTMLAnchorElement, DataListRowLinkProps>(
  (
    { children, to, className, style, LinkComponent: Link = 'a', colStart, colEnd, featured, variant, ...rest },
    ref,
  ) => {
    const isWrapped = useDataListRowWrapperContext();
    const hasColumnOverride = colStart !== undefined || colEnd !== undefined;
    const resolvedStyle = hasColumnOverride ? { ...style, gridColumn: `${colStart ?? 1} / ${colEnd ?? -1}` } : style;
    return (
      <Link
        ref={ref}
        href={to}
        className={cn(...(isWrapped ? dataListRowInteractiveStyles : dataListRowStyles), className)}
        style={resolvedStyle}
        data-featured={featured || undefined}
        data-variant={variant ?? 'default'}
        {...rest}
      >
        {children}
      </Link>
    );
  },
);

DataListRowLink.displayName = 'DataListRowLink';

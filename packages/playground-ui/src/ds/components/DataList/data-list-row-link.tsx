import type { ReactNode } from 'react';
import { dataListRowStyles } from './shared';
import type { LinkComponent } from '@/ds/types/link-component';
import { cn } from '@/lib/utils';

export type DataListRowLinkProps = {
  children: ReactNode;
  to: string;
  className?: string;
  LinkComponent: LinkComponent;
};

export function DataListRowLink({ children, to, className, LinkComponent: Link }: DataListRowLinkProps) {
  return (
    <Link href={to} className={cn(...dataListRowStyles, className)}>
      {children}
    </Link>
  );
}

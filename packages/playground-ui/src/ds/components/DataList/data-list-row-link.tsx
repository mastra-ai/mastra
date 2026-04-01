import type { ReactNode } from 'react';
import { dataListRowStyles } from './shared';
import { useLinkComponent } from '@/lib/framework';
import { cn } from '@/lib/utils';

export type DataListRowLinkProps = {
  children: ReactNode;
  to: string;
  className?: string;
};

export function DataListRowLink({ children, to, className }: DataListRowLinkProps) {
  const { Link } = useLinkComponent();

  return (
    <Link href={to} className={cn(...dataListRowStyles, className)}>
      {children}
    </Link>
  );
}

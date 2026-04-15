import type { ReactNode } from 'react';
import type { LinkComponent } from '@/ds/types/link-component';
import { cn } from '@/lib/utils';

export type EntityListRowLinkProps = {
  children: ReactNode;
  to: string;
  className?: string;
  LinkComponent: LinkComponent;
};

export function EntityListRowLink({ children, to, className, LinkComponent: Link }: EntityListRowLinkProps) {
  return (
    <Link
      href={to}
      className={cn(
        'entity-list-row grid grid-cols-subgrid gap-6 lg:gap-8 xl:gap-10 2xl:gap-12 3xl:gap-14 col-span-full px-5 outline-hidden cursor-pointer border-y border-b-border1 border-t-transparent',
        'hover:bg-surface4 hover:border-transparent focus-within:bg-surface4 focus-within:border-transparent focus-within:ring-1 focus-within:ring-inset focus-within:ring-accent1',
        '[.entity-list-row:hover+&]:border-t-transparent [.entity-list-row:focus-within+&]:border-t-transparent',
        'transition-colors duration-200 rounded-lg',
        className,
      )}
    >
      {children}
    </Link>
  );
}

import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export type EntityListRowProps = {
  children: ReactNode;
  className?: string;
  onClick?: () => void;
  selected?: boolean;
};

export function EntityListRow({ children, className, onClick, selected }: EntityListRowProps) {
  return (
    <div
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      onKeyDown={
        onClick
          ? e => {
              if (e.currentTarget !== e.target) return;
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onClick();
              }
            }
          : undefined
      }
      className={cn(
        'entity-list-row grid grid-cols-subgrid gap-6 lg:gap-8 xl:gap-10 2xl:gap-12 3xl:gap-14 col-span-full cursor-pointer border-y border-b-border1 border-t-transparent px-5',
        'hover:bg-surface4 hover:border-transparent focus-within:bg-surface4 focus-within:border-transparent focus-within:ring-1 focus-within:ring-inset focus-within:ring-accent1',
        '[.entity-list-row:hover+&]:border-t-transparent [.entity-list-row:focus-within+&]:border-t-transparent',
        'transition-colors duration-200 rounded-lg',
        selected && 'bg-surface4 border-transparent',
        className,
      )}
    >
      {children}
    </div>
  );
}

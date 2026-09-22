import * as React from 'react';
import { cn } from '@/lib/utils';

export type EmptyStateProps = {
  iconSlot: React.ReactNode;
  titleSlot: React.ReactNode;
  descriptionSlot?: React.ReactNode;
  actionSlot?: React.ReactNode;
  className?: string;
  as?: 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6';
};

export function EmptyState({
  iconSlot,
  titleSlot,
  descriptionSlot,
  actionSlot,
  className,
  as: HeadingTag = 'h3',
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center px-4 py-6 text-center',
        'transition-opacity duration-normal ease-out-custom',
        className,
      )}
    >
      {iconSlot && <div className="mb-3">{iconSlot}</div>}
      <HeadingTag className="text-subheading text-foreground">{titleSlot}</HeadingTag>
      {descriptionSlot && <p className="mt-1.5 max-w-md text-caption text-muted-foreground">{descriptionSlot}</p>}
      {actionSlot && <div className="mt-4">{actionSlot}</div>}
    </div>
  );
}

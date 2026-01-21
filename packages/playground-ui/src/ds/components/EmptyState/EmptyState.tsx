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
        'flex flex-col items-center justify-center text-center py-10 px-6',
        'transition-opacity duration-normal ease-out-custom',
        className,
      )}
    >
      {iconSlot && <div className="mb-4">{iconSlot}</div>}
      <HeadingTag className="font-medium text-neutral5 text-ui-md">{titleSlot}</HeadingTag>
      {descriptionSlot && <p className="mt-1.5 text-neutral3 text-ui-sm max-w-md">{descriptionSlot}</p>}
      {actionSlot && <div className="mt-5">{actionSlot}</div>}
    </div>
  );
}

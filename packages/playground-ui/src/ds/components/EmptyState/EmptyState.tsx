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
        'flex flex-col items-center justify-center px-6 py-10 text-center',
        'duration-normal transition-opacity ease-out-custom',
        className,
      )}
    >
      {iconSlot && <div className="mb-4">{iconSlot}</div>}
      <HeadingTag className="text-ui-md text-neutral5 font-medium">{titleSlot}</HeadingTag>
      {descriptionSlot && <p className="text-ui-sm text-neutral3 mt-1.5 max-w-md">{descriptionSlot}</p>}
      {actionSlot && <div className="mt-5">{actionSlot}</div>}
    </div>
  );
}

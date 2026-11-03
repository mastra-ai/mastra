import type { ComponentProps } from 'react';
import { cn } from '@/lib/utils';

export function Metadata({ className, ...props }: ComponentProps<'span'>) {
  return (
    <span
      role="list"
      {...props}
      className={cn('inline-flex max-w-full min-w-0 flex-wrap items-center gap-x-2 gap-y-1', className)}
    />
  );
}

function MetadataItem({ className, ...props }: ComponentProps<'span'>) {
  return (
    <span
      role="listitem"
      {...props}
      className={cn('inline-flex max-w-full min-w-0 items-center gap-1 wrap-anywhere whitespace-normal', className)}
    />
  );
}

Metadata.Item = MetadataItem;

import { Fragment } from 'react';
import type { ReactNode } from 'react';

import { Skeleton, SkeletonText } from '@/ds/components/Skeleton';
import { cn } from '@/utils/cn';

/** A `role="status"` region repeating one placeholder row; rows mark themselves `aria-hidden`. */
export function KnowledgeSkeletonRows({
  label,
  rows,
  className,
  children,
}: {
  label: string;
  rows: number;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div role="status" aria-label={label} className={cn('flex flex-col gap-1.5', className)}>
      {Array.from({ length: rows }, (_, i) => (
        <Fragment key={i}>{children}</Fragment>
      ))}
    </div>
  );
}

export function KnowledgeFlyoutHeaderSkeleton() {
  return (
    <div aria-hidden className="min-w-0 flex-1">
      <SkeletonText line="text-subheading" className="w-40 max-w-full motion-reduce:before:animate-none" />
      <Skeleton className="mt-1 h-5 w-20 motion-reduce:before:animate-none" />
    </div>
  );
}

export function KnowledgeFlyoutSkeleton() {
  return (
    <div role="status" aria-label="Loading knowledge node" className="flex min-h-0 flex-col">
      <div aria-hidden className="px-4 pb-3">
        <SkeletonText line="text-body-sm" className="w-full motion-reduce:before:animate-none" />
        <SkeletonText line="text-body-sm" className="w-4/5 motion-reduce:before:animate-none" />
      </div>
      <KnowledgeSkeletonRows label="Loading knowledge properties" rows={4} className="gap-1 px-4 pb-4">
        <div aria-hidden className="flex items-center justify-between gap-4">
          <SkeletonText line="text-caption" className="w-16 motion-reduce:before:animate-none" />
          <SkeletonText line="text-caption" className="w-28 motion-reduce:before:animate-none" />
        </div>
      </KnowledgeSkeletonRows>
    </div>
  );
}

export function KnowledgeActivitySkeleton() {
  return (
    <KnowledgeSkeletonRows label="Loading recent activity" rows={3} className="mt-2 gap-2">
      <div aria-hidden className="border-l border-border pl-2">
        <SkeletonText line="text-meta" className="w-4/5 motion-reduce:before:animate-none" />
        <SkeletonText line="text-meta" className="w-1/2 motion-reduce:before:animate-none" />
      </div>
    </KnowledgeSkeletonRows>
  );
}

import { Skeleton, SkeletonText } from '@mastra/playground-ui/components/Skeleton';

import { SkeletonRows } from '../../../../ui/SkeletonRows';

export function KnowledgeLoadingSkeleton({ label, layout }: { label: string; layout: 'graph' | 'list' }) {
  if (layout === 'list') {
    return (
      <SkeletonRows label={label} rows={6} className="min-h-0 flex-1 gap-0.5 overflow-hidden pb-16">
        <div aria-hidden className="flex min-h-11 items-center justify-between gap-2 rounded-md px-3 py-2">
          <SkeletonText line="text-body-sm" className="w-40 max-w-full motion-reduce:before:animate-none" />
          <SkeletonText line="text-meta" className="w-16 motion-reduce:before:animate-none" />
        </div>
      </SkeletonRows>
    );
  }

  return (
    <div
      role="status"
      aria-label={label}
      className="border-border relative min-h-64 flex-1 overflow-hidden rounded-lg border"
    >
      <div aria-hidden className="absolute inset-0 flex items-center justify-center gap-8">
        <div className="flex flex-col items-center gap-16">
          <Skeleton className="size-5 rounded-full motion-reduce:before:animate-none" />
          <Skeleton className="size-8 rounded-full motion-reduce:before:animate-none" />
        </div>
        <div className="flex items-center gap-4">
          <Skeleton className="h-px w-8 motion-reduce:before:animate-none" />
          <Skeleton className="size-12 rounded-full motion-reduce:before:animate-none" />
          <Skeleton className="h-px w-8 motion-reduce:before:animate-none" />
        </div>
        <div className="flex flex-col items-center gap-16">
          <Skeleton className="size-8 rounded-full motion-reduce:before:animate-none" />
          <Skeleton className="size-5 rounded-full motion-reduce:before:animate-none" />
        </div>
      </div>
    </div>
  );
}

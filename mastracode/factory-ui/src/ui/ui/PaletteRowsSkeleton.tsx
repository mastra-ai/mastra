import { Skeleton, SkeletonText } from '@mastra/playground-ui/components/Skeleton';

import { SkeletonRows } from './SkeletonRows';

/** Match CommandPaletteItem's icon, two text lines, inset and row radius. */
export function PaletteRowsSkeleton({ label, rows = 3 }: { label: string; rows?: number }) {
  return (
    <SkeletonRows label={label} rows={rows} className="gap-0 p-1">
      <div aria-hidden className="flex items-start gap-3 rounded-lg border border-transparent px-3 py-2.5">
        <Skeleton className="mt-0.5 size-4 shrink-0 motion-reduce:before:animate-none" />
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <SkeletonText line="text-label" className="w-3/5 max-w-48 motion-reduce:before:animate-none" />
          <SkeletonText line="text-meta" className="w-4/5 max-w-64 motion-reduce:before:animate-none" />
        </div>
      </div>
    </SkeletonRows>
  );
}

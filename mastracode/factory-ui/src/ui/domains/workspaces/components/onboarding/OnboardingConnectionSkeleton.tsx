import { Skeleton, SkeletonText } from '@mastra/playground-ui/components/Skeleton';

export function OnboardingConnectionSkeleton({ label }: { label: string }) {
  return (
    <div role="status" aria-label={label}>
      <div aria-hidden className="-mx-3 flex min-h-22 min-w-0 items-center gap-3 rounded-lg px-3 py-3">
        <Skeleton className="size-4 shrink-0 motion-reduce:before:animate-none" />
        <div className="min-w-0 flex-1 basis-40">
          <SkeletonText line="text-caption" className="w-24 max-w-full motion-reduce:before:animate-none" />
          <SkeletonText line="text-meta" className="mt-1 w-4/5 motion-reduce:before:animate-none" />
        </div>
        <Skeleton className="h-control-sm w-20 shrink-0 rounded-full motion-reduce:before:animate-none" />
      </div>
    </div>
  );
}

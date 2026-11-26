import { Skeleton, SkeletonText } from '@mastra/playground-ui/components/Skeleton';

export function OnboardingConnectionSkeleton({ label, rows = 1 }: { label: string; rows?: number }) {
  return (
    <div role="status" aria-label={label}>
      <div aria-hidden className="flex flex-col gap-0.5">
        {Array.from({ length: rows }, (_, index) => (
          <div key={index} className="flex min-h-15 min-w-0 items-center gap-3 rounded-lg px-3 py-2.5">
            <Skeleton className="size-icon-md shrink-0 motion-reduce:before:animate-none" />
            <div className="min-w-0 flex-1 basis-40">
              <SkeletonText line="text-caption" className="w-24 max-w-full motion-reduce:before:animate-none" />
              <SkeletonText line="text-meta" className="mt-1 w-4/5 motion-reduce:before:animate-none" />
            </div>
            <Skeleton className="h-control-md w-20 shrink-0 rounded-full motion-reduce:before:animate-none" />
          </div>
        ))}
      </div>
    </div>
  );
}

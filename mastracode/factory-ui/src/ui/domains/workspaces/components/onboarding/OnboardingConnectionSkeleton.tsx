import { Skeleton, SkeletonText } from '@mastra/playground-ui/components/Skeleton';

import { ONBOARDING_CONNECTION_ROW } from './OnboardingConnectionRow';

export function OnboardingConnectionSkeleton({ label }: { label: string }) {
  return (
    <div role="status" aria-label={label}>
      <OnboardingConnectionRowSkeleton />
    </div>
  );
}

export function OnboardingConnectionRowSkeleton() {
  return (
    <div aria-hidden className={ONBOARDING_CONNECTION_ROW}>
      <Skeleton className="size-icon-md shrink-0 rounded-full motion-reduce:before:animate-none" />
      <div className="min-w-0 flex-1">
        <SkeletonText line="text-caption" className="w-24 max-w-full motion-reduce:before:animate-none" />
        <SkeletonText line="text-meta" className="mt-1 w-4/5 motion-reduce:before:animate-none" />
      </div>
      <Skeleton className="h-control-sm w-20 shrink-0 rounded-full motion-reduce:before:animate-none" />
    </div>
  );
}

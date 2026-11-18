import { Skeleton, SkeletonText } from '@mastra/playground-ui/components/Skeleton';

import { SkeletonRows } from '../../../../ui/SkeletonRows';
import { ONBOARDING_REPOSITORY_ROW } from './onboardingLayout';

export function OnboardingRepositoryRowsSkeleton({ label }: { label: string }) {
  return (
    <SkeletonRows label={label} rows={3} className="gap-0.5">
      <div aria-hidden className={ONBOARDING_REPOSITORY_ROW}>
        <Skeleton className="size-4 shrink-0 rounded-full motion-reduce:before:animate-none" />
        <span className="min-w-0 flex-1">
          <SkeletonText line="text-caption" className="w-2/5 motion-reduce:before:animate-none" />
          <SkeletonText line="text-meta" className="mt-0.5 w-16 motion-reduce:before:animate-none" />
        </span>
      </div>
    </SkeletonRows>
  );
}

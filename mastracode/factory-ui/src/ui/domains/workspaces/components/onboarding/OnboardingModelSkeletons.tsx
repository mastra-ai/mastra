import { Skeleton, SkeletonText } from '@mastra/playground-ui/components/Skeleton';
import { cn } from '@mastra/playground-ui/utils/cn';

import { ONBOARDING_CHOICE_ROW, OnboardingChoiceIcon } from './OnboardingChoiceRow';
import { OnboardingInset } from './OnboardingInset';

const bar = 'motion-reduce:before:animate-none';
const SCOPES = 3;

export function OnboardingScopeChoiceSkeleton() {
  return (
    <OnboardingInset role="status" aria-label="Loading account options">
      {Array.from({ length: SCOPES }, (_, index) => (
        <div key={index} aria-hidden className={ONBOARDING_CHOICE_ROW}>
          <OnboardingChoiceIcon>
            <Skeleton className={cn('size-icon-md', bar)} />
          </OnboardingChoiceIcon>
          <SkeletonText line="text-label min-h-5" className={cn('w-44', bar)} />
        </div>
      ))}
    </OnboardingInset>
  );
}

export function OnboardingLaneSkeleton() {
  return (
    <OnboardingInset role="status" aria-label="Loading model providers" className="gap-0 p-3">
      <div aria-hidden className="flex min-w-0 flex-col gap-3">
        <Skeleton className={cn('h-control-sm w-full rounded-full', bar)} />
        <div className="flex min-w-0 items-start gap-3">
          <OnboardingChoiceIcon>
            <Skeleton className={cn('size-icon-md', bar)} />
          </OnboardingChoiceIcon>
          <span className="flex min-w-0 flex-1 flex-col gap-0.5">
            <SkeletonText line="text-label min-h-5" className={cn('w-28', bar)} />
            <SkeletonText line="text-meta" className={cn('w-52', bar)} />
          </span>
        </div>
      </div>
    </OnboardingInset>
  );
}

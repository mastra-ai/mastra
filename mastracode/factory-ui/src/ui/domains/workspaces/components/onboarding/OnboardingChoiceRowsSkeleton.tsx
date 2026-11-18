import { Skeleton, SkeletonText } from '@mastra/playground-ui/components/Skeleton';

import { SkeletonRows } from '../../../../ui/SkeletonRows';
import { OnboardingInset } from './OnboardingInset';
import { ONBOARDING_CHOICE_ROW } from './onboardingLayout';

export function OnboardingChoiceRowsSkeleton({ label, rows }: { label: string; rows: number }) {
  return (
    <OnboardingInset>
      <SkeletonRows label={label} rows={rows} className="gap-0.5">
        <div aria-hidden className={ONBOARDING_CHOICE_ROW}>
          <Skeleton className="size-5 shrink-0 rounded-full motion-reduce:before:animate-none" />
          <span className="flex min-h-5 min-w-0 flex-1 items-center">
            <SkeletonText line="text-label" className="w-2/5 motion-reduce:before:animate-none" />
          </span>
        </div>
      </SkeletonRows>
    </OnboardingInset>
  );
}

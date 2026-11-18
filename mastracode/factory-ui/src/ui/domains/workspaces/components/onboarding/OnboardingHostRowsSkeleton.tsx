import { SkeletonRows } from '../../../../ui/SkeletonRows';
import { OnboardingConnectionRowSkeleton } from './OnboardingConnectionSkeleton';
import { OnboardingInset } from './OnboardingInset';

export function OnboardingHostRowsSkeleton({ label }: { label: string }) {
  return (
    <OnboardingInset>
      <SkeletonRows label={label} rows={2} className="gap-0.5">
        <OnboardingConnectionRowSkeleton />
      </SkeletonRows>
    </OnboardingInset>
  );
}

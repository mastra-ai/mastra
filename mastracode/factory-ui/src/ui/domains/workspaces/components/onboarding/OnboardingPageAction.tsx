import { cn } from '@mastra/playground-ui/utils/cn';
import type { ReactNode } from 'react';
import { ONBOARDING_PINNED_PRIMARY } from './onboardingLayout';

/**
 * The action that finishes the whole setup, under the cards rather than in one: it commits every section,
 * not just the last. `notice` (a create failure, or why Create is off) sits right above it, inside the
 * mobile pinned bar so it is seen where the button was tapped.
 */
export function OnboardingPageAction({ notice, children }: { notice?: ReactNode; children: ReactNode }) {
  return (
    <div className={cn('flex flex-col items-end gap-2 pt-2', ONBOARDING_PINNED_PRIMARY)}>
      {notice && <div className="w-full">{notice}</div>}
      {children}
    </div>
  );
}

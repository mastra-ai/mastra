import type { ReactNode } from 'react';

/** Labels follow a morphing illustration; hidden annotations stay out of the accessibility tree. */
export function OnboardingScene({ active, children }: { active: boolean; children: ReactNode }) {
  return (
    <div className="onboarding-scene absolute inset-0" data-active={active} aria-hidden={!active} inert={!active}>
      {children}
    </div>
  );
}

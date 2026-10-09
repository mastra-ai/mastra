import { useState, type ReactNode } from 'react';

/** Labels follow a morphing illustration; hidden annotations stay out of the accessibility tree. */
export function OnboardingScene({ active, children }: { active: boolean; children: ReactNode }) {
  const [visited, setVisited] = useState(active);
  if (active && !visited) setVisited(true);

  return (
    <div className="onboarding-scene absolute inset-0" data-active={active} aria-hidden={!active} inert={!active}>
      {visited || active ? children : undefined}
    </div>
  );
}

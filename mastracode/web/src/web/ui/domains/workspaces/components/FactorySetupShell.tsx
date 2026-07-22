import type { ReactNode } from 'react';

/**
 * Full-screen chrome shared by the onboarding flow and the `/factories/create`
 * wizard: radial-gradient background, centered section, and slots for the
 * progress dots and animated step content. Steps stay independent components
 * composed by each flow, so future step variants slot in without mode flags.
 */
export function FactorySetupShell({ topLeft, children }: { topLeft?: ReactNode; children: ReactNode }) {
  return (
    <main className="relative min-h-dvh overflow-hidden bg-surface1 text-neutral6">
      <div className="pointer-events-none absolute inset-0" aria-hidden="true">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_42%,color-mix(in_oklab,var(--accent1)_15%,transparent),transparent_34%)]" />
      </div>
      {topLeft && <div className="absolute top-6 left-6 z-10 sm:top-8 sm:left-8">{topLeft}</div>}
      <div className="relative mx-auto flex min-h-dvh w-full max-w-7xl items-center px-6 py-10 sm:px-10 lg:px-16">
        <section className="mx-auto w-full max-w-3xl text-center">{children}</section>
      </div>
    </main>
  );
}

function Progress({ steps, current }: { steps: string[]; current: string }) {
  const currentIndex = steps.indexOf(current);
  return (
    <ol className="mb-8 flex justify-center gap-2" aria-label="Factory setup progress">
      {steps.map((item, index) => (
        <li
          key={item}
          aria-current={current === item ? 'step' : undefined}
          className={`h-1.5 w-14 rounded-full ${index <= currentIndex ? 'bg-accent1' : 'bg-surface4'}`}
        >
          <span className="sr-only">Step {index + 1}</span>
        </li>
      ))}
    </ol>
  );
}

/** Animated container for the current step; re-keys on step change to replay the entrance. */
function Step({ stepKey, children }: { stepKey: string; children: ReactNode }) {
  return (
    <div key={stepKey} className="animate-in fade-in slide-in-from-bottom-2 duration-300 motion-reduce:animate-none">
      {children}
    </div>
  );
}

FactorySetupShell.Progress = Progress;
FactorySetupShell.Step = Step;

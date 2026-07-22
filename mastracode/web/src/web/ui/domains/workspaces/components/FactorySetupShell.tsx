import type { ReactNode } from 'react';

import { Txt } from '@mastra/playground-ui/components/Txt';

import { FactoryHalftoneField } from '../../auth/components/FactoryHalftoneField';

/**
 * Full-screen chrome shared by the onboarding flow and the `/factories/create`
 * wizard: halftone backdrop, centered column, and slots for the progress dots,
 * step heading, and animated step content. Steps stay independent components
 * composed by each flow, so future step variants slot in without mode flags.
 */
export function FactorySetupShell({ topLeft, children }: { topLeft?: ReactNode; children: ReactNode }) {
  return (
    <main className="relative min-h-dvh overflow-hidden bg-surface1 text-neutral6">
      <FactoryHalftoneField variant="backdrop" />
      {topLeft && <div className="absolute top-6 left-6 z-10 sm:top-8 sm:left-8">{topLeft}</div>}
      <div className="relative mx-auto flex min-h-dvh w-full max-w-7xl flex-col px-6 py-8 sm:px-10 lg:px-16">
        <section className="mx-auto flex w-full max-w-3xl flex-1 flex-col text-center">{children}</section>
      </div>
    </main>
  );
}

/** Step header: progress dots (as children) followed by the step title and optional subcopy. */
function Header({ title, description, children }: { title: ReactNode; description?: ReactNode; children?: ReactNode }) {
  return (
    <div className="pt-2 sm:pt-4">
      {children}
      <h1 className="mx-auto max-w-2xl text-3xl leading-tight font-semibold tracking-[-0.035em] text-balance sm:text-4xl lg:text-5xl">
        {title}
      </h1>
      {description && (
        <Txt as="p" variant="ui-lg" className="mx-auto mt-6 max-w-2xl leading-7 text-neutral3 sm:text-lg">
          {description}
        </Txt>
      )}
    </div>
  );
}

function Progress({ steps, current }: { steps: string[]; current: string }) {
  const currentIndex = steps.indexOf(current);
  return (
    <ol className="mb-6 flex justify-center gap-2" aria-label="Factory setup progress">
      {steps.map((item, index) => (
        <li
          key={item}
          aria-current={current === item ? 'step' : undefined}
          className={`h-1 w-14 rounded-full ${index <= currentIndex ? 'bg-accent1' : 'bg-surface4'}`}
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
    <div className="flex flex-1 items-start justify-center pt-16">
      <div
        key={stepKey}
        className="w-full animate-in fade-in slide-in-from-bottom-2 duration-300 motion-reduce:animate-none"
      >
        {children}
      </div>
    </div>
  );
}

FactorySetupShell.Header = Header;
FactorySetupShell.Progress = Progress;
FactorySetupShell.Step = Step;

import type { ReactNode } from 'react';

import { Txt } from '@mastra/playground-ui/components/Txt';

import { FactoryHalftoneField } from '../../auth/components/FactoryHalftoneField';
import '@fontsource-variable/mona-sans/standard.css';

/**
 * Full-screen chrome shared by the onboarding flow and the `/factories/create`
 * wizard: a side-by-side layout with the step column on the left and the
 * animated halftone factory panel on the right (hidden on mobile). Slots for the
 * `topLeft` control, progress dots, step heading, and animated step content.
 * Steps stay independent components composed by each flow, so future step
 * variants slot in without mode flags.
 */
export function FactorySetupShell({ topLeft, children }: { topLeft?: ReactNode; children: ReactNode }) {
  return (
    <main className="factory-signin-theme bg-surface1 font-mona-sans text-neutral6 min-h-dvh">
      <div className="grid min-h-dvh w-full grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(480px,42%)]">
        <section className="relative z-3 flex flex-col justify-center px-6 py-12 sm:px-10 lg:px-16 lg:py-17 xl:px-20">
          {topLeft && <div className="absolute top-6 left-6 z-10 sm:top-8 sm:left-8 lg:left-16">{topLeft}</div>}
          <div className="w-full max-w-2xl">{children}</div>
        </section>

        <div className="hidden lg:grid">
          <FactoryHalftoneField />
        </div>
      </div>
    </main>
  );
}

/** Step header: progress dots (as children) followed by the step title and optional subcopy. */
function Header({ title, description, children }: { title: ReactNode; description?: ReactNode; children?: ReactNode }) {
  return (
    <div className="w-full">
      {children}
      <h1 className="max-w-xl text-[clamp(2rem,3.9vw,3.25rem)] leading-[1.1] font-[520] tracking-[0.01em] text-balance [font-stretch:112%]">
        {title}
      </h1>
      {description && (
        <Txt
          as="p"
          variant="ui-lg"
          className="text-neutral3 mt-6 max-w-lg text-[clamp(1rem,1.5vw,1.25rem)] leading-[1.4] tracking-[0.01em]"
        >
          {description}
        </Txt>
      )}
    </div>
  );
}

function Progress({ steps, current }: { steps: string[]; current: string }) {
  const currentIndex = steps.indexOf(current);
  return (
    <ol className="mb-9 flex gap-2" aria-label="Factory setup progress">
      {steps.map((item, index) => (
        <li
          key={item}
          aria-current={current === item ? 'step' : undefined}
          className={`h-1 w-14 rounded-full transition-colors ${index <= currentIndex ? 'bg-accent1' : 'bg-surface4'}`}
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
    <div
      key={stepKey}
      className="animate-in fade-in slide-in-from-bottom-2 mt-11 w-full duration-300 motion-reduce:animate-none"
    >
      {children}
    </div>
  );
}

FactorySetupShell.Header = Header;
FactorySetupShell.Progress = Progress;
FactorySetupShell.Step = Step;

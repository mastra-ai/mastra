import { Txt } from '@mastra/playground-ui/components/Txt';
import { focusRing } from '@mastra/playground-ui/primitives/transitions';
import { cn } from '@mastra/playground-ui/utils/cn';
import { Check } from 'lucide-react';
import { useLocation } from 'react-router';

import { FactoryHalftoneField } from '../auth/components/FactoryHalftoneField';
import { PrototypeBadge } from './StoryChoices';
import { useStoryboard } from './StoryboardProvider';
import { StoryOnboardingAccount } from './StoryOnboardingAccount';
import { StoryOnboardingConnect } from './StoryOnboardingConnect';
import type { OnboardingFlow, OnboardingStage } from './storyState';

type ScreenStage = Exclude<OnboardingStage, 'landed'>;

const STAGES: { value: OnboardingStage; label: string }[] = [
  { value: 'connect', label: 'Connect' },
  { value: 'account', label: 'Factory account' },
  { value: 'landed', label: 'Land on the board' },
];

const PRESET_NOTE = 'Pick a starting point. It only sets defaults.';

const HEADINGS: Record<OnboardingFlow, Record<ScreenStage, { title: string; description: string }>> = {
  cloudflare: {
    connect: {
      title: 'Connect the code and the work behind it.',
      description: 'GitHub for the repositories, Linear for the issues. Nothing runs yet, so nothing bills yet.',
    },
    account: { title: 'What pays for the work?', description: PRESET_NOTE },
  },
  'small-team': {
    connect: {
      title: 'Connect your codebase.',
      description: 'GitHub is all you need to start. Issues can come later.',
    },
    account: {
      title: 'What pays for the work?',
      description: `${PRESET_NOTE} No company key yet? Bring your own plans.`,
    },
  },
  solo: {
    connect: {
      title: 'Connect your codebase.',
      description: 'Just you and your repositories. Issues can come later.',
    },
    account: { title: 'What pays for the work?', description: `${PRESET_NOTE} On your own? One account, yours.` },
  },
};

function Stepper({ current, onBack }: { current: ScreenStage; onBack: (stage: ScreenStage) => void }) {
  const currentIndex = STAGES.findIndex(stage => stage.value === current);
  return (
    <ol aria-label="Factory setup progress" className="flex flex-wrap items-center gap-4">
      {STAGES.map((stage, index) => {
        const done = index < currentIndex;
        const target = stage.value === 'landed' ? null : stage.value;
        return (
          <li key={stage.value} aria-current={stage.value === current ? 'step' : undefined}>
            <button
              type="button"
              disabled={!done || target === null}
              onClick={() => target && onBack(target)}
              className={cn('flex items-center gap-2 rounded-md', done && 'cursor-pointer', focusRing)}
            >
              <span
                className={cn(
                  'text-caption flex size-5 items-center justify-center rounded-full border tabular-nums',
                  done && 'bg-success-indicator text-background border-transparent',
                  stage.value === current && 'border-foreground text-foreground',
                  index > currentIndex && 'border-border text-muted-foreground border-dashed',
                )}
              >
                {done ? <Check className="size-3" aria-hidden /> : index + 1}
              </span>
              <Txt as="span" variant="caption" tone={index > currentIndex ? 'muted' : 'ink'}>
                {stage.label}
              </Txt>
            </button>
          </li>
        );
      })}
    </ol>
  );
}

export function useOnboardingCoversApp(): boolean {
  const onboarding = useStoryboard()?.state.onboarding;
  const onProblemMap = useLocation().pathname.endsWith('/problem-map');
  return !onProblemMap && onboarding != null && onboarding.stage !== 'landed';
}

export function StoryOnboardingScreen() {
  const storyboard = useStoryboard();
  const coversApp = useOnboardingCoversApp();
  const onboarding = storyboard?.state.onboarding;
  if (!storyboard || !onboarding || onboarding.stage === 'landed' || !coversApp) return null;

  const { flow, stage } = onboarding;
  const heading = HEADINGS[flow][stage];
  const goTo = (next: OnboardingStage) => storyboard.patch({ onboarding: { flow, stage: next } });

  return (
    <main className="bg-sidebar text-foreground fixed inset-0 z-50 overflow-y-auto">
      <div className="grid min-h-dvh w-full grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(480px,42%)]">
        <section className="relative z-3 flex flex-col justify-center px-6 py-12 sm:px-10 lg:px-16 xl:px-20">
          <div className="w-full max-w-2xl">
            <div className="mb-9 flex flex-wrap items-center justify-between gap-3">
              <Stepper current={stage} onBack={goTo} />
              <PrototypeBadge />
            </div>
            <h1 className="max-w-xl text-[clamp(2rem,3.9vw,3.25rem)] leading-[1.1] font-[520] tracking-[0.01em] text-balance [font-stretch:112%]">
              {heading.title}
            </h1>
            <Txt as="p" variant="body" tone="muted" className="mt-6 max-w-lg">
              {heading.description}
            </Txt>
            <div key={stage} className="animate-in fade-in slide-in-from-bottom-2 mt-11 duration-300">
              {stage === 'connect' ? (
                <StoryOnboardingConnect flow={flow} onContinue={() => goTo('account')} />
              ) : (
                <StoryOnboardingAccount
                  storyboard={storyboard}
                  flow={flow}
                  onLand={() => storyboard.patch({ onboarding: { flow, stage: 'landed' }, boardImported: false })}
                />
              )}
            </div>
          </div>
        </section>
        <div className="hidden lg:grid">
          <FactoryHalftoneField />
        </div>
      </div>
    </main>
  );
}

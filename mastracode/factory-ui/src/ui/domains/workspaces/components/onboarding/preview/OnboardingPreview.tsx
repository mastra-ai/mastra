import { Txt } from '@mastra/playground-ui/components/Txt';
import { GitBranch } from 'lucide-react';
import type { ReactNode } from 'react';
import type { ProviderConnectionMethod } from '../../../hooks/useProviderConnection';
import type { OnboardingStep } from '../../../services/onboardingFlow';
import { OnboardingPersonalPreview, OnboardingSharedModelPreview } from './OnboardingAccountsPreview';
import { OnboardingIntakePreview } from './OnboardingIntakePreview';
import { Sketch, SketchLabel, SketchLink, SketchPanel } from './OnboardingSketch';
import '../onboarding-preview.css';

export type OnboardingSource = 'linear' | 'jira' | 'incident-io';

export interface OnboardingPreviewProps {
  step: OnboardingStep;
  personalModel?: string;
  repository?: { name: string; fullName: string; defaultBranch: string };
  source?: OnboardingSource;
  model?: string;
  providerId?: string;
  personalProviderId?: string;
  connectionMethod?: ProviderConnectionMethod;
  personalConnectionMethod?: ProviderConnectionMethod;
}

/** Hidden scenes stay out of the accessibility tree while they fade. */
function OnboardingScene({ active, children }: { active: boolean; children: ReactNode }) {
  return (
    <div className="onboarding-scene absolute inset-0" data-active={active} aria-hidden={!active} inert={!active}>
      {children}
    </div>
  );
}

function SketchFactory({ x, y, width, height }: { x: number; y: number; width: number; height: number }) {
  const toothWidth = width / 4;
  const wallTop = y + height / 4;
  const roof = Array.from({ length: 4 }, (_, tooth) => `L${x + (tooth + 1) * toothWidth},${y} V${wallTop}`).join(' ');
  const doorWidth = toothWidth * 0.6;
  const doorHeight = height * 0.35;
  return (
    <g data-highlighted="true" className="onboarding-sketch-surface">
      <path d={`M${x},${y + height} V${wallTop} ${roof} V${y + height} Z`} />
      <rect x={x + (width - doorWidth) / 2} y={y + height - doorHeight} width={doorWidth} height={doorHeight} rx={2} />
    </g>
  );
}

function OnboardingWelcomePreview() {
  return (
    <section aria-label="Welcome illustration" className="relative h-full">
      <Sketch>
        <SketchPanel x={28} y={226} width={88} height={48} />
        <SketchPanel x={20} y={236} width={88} height={48} />
        <SketchLink from={[108, 260]} to={[140, 250]} />
        <SketchFactory x={140} y={100} width={120} height={160} />
        <SketchLink from={[260, 250]} to={[292, 260]} />
        <SketchPanel x={292} y={236} width={88} height={48} highlighted />
        <path d="M324,260 l8,8 l16,-16" className="onboarding-sketch-mark" />
      </Sketch>
      <SketchLabel x={20} y={300} width={112}>
        <Txt variant="meta" tone="muted">
          Issues & ideas
        </Txt>
      </SketchLabel>
      <SketchLabel x={147} y={57} width={126}>
        <Txt variant="meta" tone="muted">
          Build & review
        </Txt>
      </SketchLabel>
      <SketchLabel x={288} y={300} width={110}>
        <Txt variant="meta" tone="muted">
          Ready to ship
        </Txt>
      </SketchLabel>
    </section>
  );
}

function OnboardingCodebasePreview({ repository }: Pick<OnboardingPreviewProps, 'repository'>) {
  return (
    <section aria-label="Codebase preview" className="relative h-full">
      <Sketch>
        <SketchPanel x={25} y={150} width={190} height={90} highlighted />
        <path d="M108,184 l-12,11 l12,11 M132,184 l12,11 l-12,11" className="onboarding-sketch-mark" />
        <SketchLink from={[215, 195]} to={[290, 195]} />
        <SketchFactory x={290} y={140} width={80} height={70} />
      </Sketch>
      <SketchLabel x={279} y={220} width={114}>
        <Txt variant="meta" tone="muted">
          Your Factory
        </Txt>
      </SketchLabel>
      <SketchLabel x={25} y={256} width={220}>
        <Txt variant="caption" className="truncate">
          {repository?.fullName ?? 'Your repository'}
        </Txt>
        <div className="text-muted-foreground mt-2 flex items-center gap-2">
          <GitBranch className="size-3 shrink-0" />
          <Txt variant="meta" tone="muted">
            {repository?.defaultBranch ?? 'Selected branch'}
          </Txt>
        </div>
      </SketchLabel>
    </section>
  );
}

export function OnboardingPreview({
  step,
  personalModel,
  repository,
  source = 'linear',
  model,
  providerId,
  personalProviderId,
  connectionMethod,
  personalConnectionMethod,
}: OnboardingPreviewProps) {
  const personalIsFactoryModel = !model;
  const reviewing = step === 'review';
  return (
    <aside className="onboarding-preview min-w-0 px-8 xl:px-12" aria-label="Factory preview">
      <div className="onboarding-diagram relative mx-auto w-full max-w-150">
        <OnboardingScene active={step === 'initial'}>
          <OnboardingWelcomePreview />
        </OnboardingScene>
        <OnboardingScene active={step === 'vcs'}>
          <OnboardingCodebasePreview repository={repository} />
        </OnboardingScene>
        <OnboardingScene active={step === 'project-management'}>
          <OnboardingIntakePreview source={source} />
        </OnboardingScene>
        <OnboardingScene active={step === 'model-provider' || (reviewing && !personalIsFactoryModel)}>
          <OnboardingSharedModelPreview
            repository={repository}
            model={model}
            providerId={providerId}
            connectionMethod={connectionMethod}
          />
        </OnboardingScene>
        <OnboardingScene active={step === 'personal-provider' || (reviewing && personalIsFactoryModel)}>
          <OnboardingPersonalPreview
            model={model}
            providerId={providerId}
            personalProviderId={personalProviderId}
            personalConnectionMethod={personalConnectionMethod}
            personalModel={personalModel}
          />
        </OnboardingScene>
      </div>
    </aside>
  );
}

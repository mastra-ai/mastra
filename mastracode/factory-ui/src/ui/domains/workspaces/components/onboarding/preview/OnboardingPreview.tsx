import { Txt } from '@mastra/playground-ui/components/Txt';
import { GitBranch } from 'lucide-react';
import type { ReactNode } from 'react';
import type { ProviderConnectionMethod } from '../../../hooks/useProviderConnection';
import type { WorkSource } from '../../../hooks/useWorkSourceConnections';
import type { OnboardingModelScope, OnboardingStep } from '../../../services/onboardingFlow';
import { OnboardingAccountsPreview } from './OnboardingAccountsPreview';
import { OnboardingIntakePreview } from './OnboardingIntakePreview';
import { SketchLabel } from './SketchLabel';
import { OnboardingIllustration } from './OnboardingIllustration';
import type { AccountsMode, DrawingScene } from './onboarding-drawing';
import '../onboarding-preview.css';

export interface OnboardingPreviewProps {
  step: OnboardingStep;
  modelScope?: OnboardingModelScope;
  local?: boolean;
  personalModel?: string;
  repository?: { name: string; fullName: string; defaultBranch: string };
  source?: WorkSource;
  model?: string;
  providerId?: string;
  personalProviderId?: string;
  connectionMethod?: ProviderConnectionMethod;
  personalConnectionMethod?: ProviderConnectionMethod;
}

const ACCOUNT_MODES: Record<OnboardingModelScope, AccountsMode> = {
  factory: 'shared',
  user: 'individual',
  hybrid: 'hybrid',
};

function sceneForStep(step: OnboardingStep): DrawingScene {
  if (step === 'initial') return 'factory';
  if (step === 'vcs') return 'codebase';
  if (step === 'project-management') return 'intake';
  return 'accounts';
}

function OnboardingScene({ active, children }: { active: boolean; children: ReactNode }) {
  return (
    <div className="onboarding-scene absolute inset-0" data-active={active} inert={!active}>
      {children}
    </div>
  );
}

function OnboardingWelcomePreview() {
  return (
    <section aria-label="Welcome illustration" className="relative h-full">
      <SketchLabel x={20} y={300} width={112}>
        <Txt variant="meta" tone="muted">
          Issues & ideas
        </Txt>
      </SketchLabel>
      <SketchLabel x={147} y={42} width={126}>
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
  modelScope = 'factory',
  local = false,
  personalModel,
  repository,
  source = 'linear',
  model,
  providerId,
  personalProviderId,
  connectionMethod,
  personalConnectionMethod,
}: OnboardingPreviewProps) {
  const scene = sceneForStep(step);
  const mode = ACCOUNT_MODES[modelScope];
  return (
    <aside className="onboarding-preview min-w-0 px-8 xl:px-12" aria-hidden="true">
      <div className="onboarding-diagram relative mx-auto w-full max-w-150">
        <OnboardingIllustration scene={scene} mode={mode} />
        <OnboardingScene active={step === 'initial'}>
          <OnboardingWelcomePreview />
        </OnboardingScene>
        <OnboardingScene active={step === 'vcs'}>
          <OnboardingCodebasePreview repository={repository} />
        </OnboardingScene>
        <OnboardingScene active={step === 'project-management'}>
          <OnboardingIntakePreview source={source} />
        </OnboardingScene>
        <OnboardingScene active={scene === 'accounts'}>
          <OnboardingAccountsPreview
            step={step}
            modelScope={modelScope}
            local={local}
            model={model}
            providerId={providerId}
            connectionMethod={connectionMethod}
            personalProviderId={personalProviderId}
            personalConnectionMethod={personalConnectionMethod}
            personalModel={personalModel}
          />
        </OnboardingScene>
      </div>
    </aside>
  );
}

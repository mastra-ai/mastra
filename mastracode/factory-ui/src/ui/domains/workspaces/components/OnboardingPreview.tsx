import type { ProviderConnectionMethod } from '../hooks/useProviderConnection';
import type { OnboardingStep } from '../services/onboardingFlow';
import { OnboardingCodebasePreview } from './OnboardingCodebasePreview';
import { OnboardingIntakePreview } from './OnboardingIntakePreview';
import { OnboardingModelPreview } from './OnboardingModelPreview';
import { OnboardingPersonalPreview } from './OnboardingPersonalPreview';
import { OnboardingWelcomePreview } from './OnboardingWelcomePreview';
import { OnboardingScene } from './OnboardingScene';
import { OnboardingFigure } from './OnboardingFigure';
import journeyFigure from '../figures/journey';
import type { FigureMode, FigureScene } from '../figures/types';
import './onboarding-preview.css';

export type OnboardingSource = 'linear' | 'jira' | 'incident-io';

export interface OnboardingPreviewProps {
  step: OnboardingStep;
  personalModel?: string;
  repository?: { name: string; fullName: string; defaultBranch: string };
  factoryName?: string;
  source?: OnboardingSource;
  model?: string;
  providerId?: string;
  personalProviderId?: string;
  connectionMethod?: ProviderConnectionMethod;
  personalConnectionMethod?: ProviderConnectionMethod;
}

function figureScene(step: OnboardingStep): FigureScene {
  if (step === 'initial') return 'factory';
  if (step === 'vcs') return 'codebase';
  if (step === 'project-management') return 'intake';
  return 'accounts';
}

function figureMode(step: OnboardingStep, personalIsFactoryModel: boolean): FigureMode {
  if (personalIsFactoryModel && (step === 'personal-provider' || step === 'review')) return 'individual';
  if (step === 'model-provider' || step === 'review') return 'shared';
  if (step === 'personal-provider') return 'hybrid';
  return 'shared';
}

/** Each scene explains the outcome of the current setting, in fixed layout slots. */
export function OnboardingPreview({
  step,
  personalModel,
  repository,
  factoryName,
  source = 'linear',
  model,
  providerId,
  personalProviderId,
  connectionMethod,
  personalConnectionMethod,
}: OnboardingPreviewProps) {
  const personalIsFactoryModel = !model;
  return (
    <aside className="onboarding-preview min-w-0 px-8 xl:px-12" aria-label="Factory preview">
      <div className="onboarding-diagram relative mx-auto w-full max-w-150">
        <OnboardingFigure
          figure={journeyFigure}
          scene={figureScene(step)}
          mode={figureMode(step, personalIsFactoryModel)}
          label="Your Factory: ideas become reviewed code, with repository context and connected work"
        />
        <OnboardingScene active={step === 'initial'}>
          <OnboardingWelcomePreview />
        </OnboardingScene>
        <OnboardingScene active={step === 'vcs'}>
          <OnboardingCodebasePreview repository={repository} factoryName={factoryName} />
        </OnboardingScene>
        <OnboardingScene active={step === 'project-management'}>
          <OnboardingIntakePreview source={source} />
        </OnboardingScene>
        <OnboardingScene active={step === 'model-provider' || (step === 'review' && !personalIsFactoryModel)}>
          <OnboardingModelPreview
            repository={repository}
            model={model}
            providerId={providerId}
            connectionMethod={connectionMethod}
          />
        </OnboardingScene>
        <OnboardingScene active={step === 'personal-provider' || (step === 'review' && personalIsFactoryModel)}>
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

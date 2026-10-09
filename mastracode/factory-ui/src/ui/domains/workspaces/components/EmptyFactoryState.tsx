import { OnboardingProgress } from './OnboardingProgress';
import { onboardingSteps, onboardingStepMeta, personalModelChoice } from '../services/onboardingSteps';
import { useIsMutating } from '@tanstack/react-query';
import { useState } from 'react';

import { useApiConfig } from '../../../../api/config';
import { useCompleteFactorySetup } from '../hooks/useCompleteFactorySetup';
import { connectLinear } from '../../factory/services/linear';
import type { SourceControlRepository } from '../services/github';
import { connectGithub, manageGithubConnection } from '../services/github';
import {
  ONBOARDING_REVIEW_RETURN_KEY,
  persistOnboardingDraft,
  readOnboardingDraft,
  type OnboardingDraft,
  persistOnboardingStep,
  readOnboardingStep,
  type OnboardingStep as Step,
} from '../services/onboardingFlow';
import { Button } from '@mastra/playground-ui/components/Button';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { ArrowLeft } from 'lucide-react';
import { LogoWithoutText } from '@mastra/playground-ui/components/Logo';
import { OnboardingPreview } from './OnboardingPreview';
import type { ProviderConnectionMethod } from '../hooks/useProviderConnection';
import type { OnboardingSource } from './OnboardingPreview';
import { InitialFactoryStep } from './InitialFactoryStep';
import { ModelProviderFactoryStep } from './ModelProviderFactoryStep';
import { PersonalProviderFactoryStep } from './PersonalProviderFactoryStep';
import { ProjectManagementFactoryStep } from './ProjectManagementFactoryStep';
import { VcsFactoryStep } from './VcsFactoryStep';
import { OnboardingReviewStep } from './OnboardingReviewStep';
import { ModelSetupPresetStep } from './ModelSetupPresetStep';
import { DEFAULT_MODEL_PRESET, includesPersonalSetup } from '../services/modelSetupPreset';
import type { SaveModelSetupPreset } from '../services/modelSetupPreset';

export function EmptyFactoryState({ onSaveModelPreset }: { onSaveModelPreset?: SaveModelSetupPreset } = {}) {
  const { baseUrl } = useApiConfig();
  const mutationInFlight = useIsMutating() > 0;
  const complete = useCompleteFactorySetup(onSaveModelPreset);
  const [draft, setDraft] = useState<OnboardingDraft>(readOnboardingDraft);
  const [step, setStep] = useState<Step>(() => {
    const saved = readOnboardingStep();
    const stored = readOnboardingDraft();
    if (saved !== 'initial' && !stored.repository) return 'vcs';
    if (onSaveModelPreset && !stored.preset && ['model-provider', 'personal-provider', 'review'].includes(saved))
      return 'model-preset';
    if (!onSaveModelPreset && saved === 'model-preset') return 'model-provider';
    return saved;
  });
  const [returnToReview, setReviewReturn] = useState(
    () => sessionStorage.getItem(ONBOARDING_REVIEW_RETURN_KEY) === 'true',
  );
  const setReturnToReview = (value: boolean) => {
    if (value) sessionStorage.setItem(ONBOARDING_REVIEW_RETURN_KEY, 'true');
    else sessionStorage.removeItem(ONBOARDING_REVIEW_RETURN_KEY);
    setReviewReturn(value);
  };
  const [githubRedirecting, setGithubRedirecting] = useState(false);
  const [previewRepository, setPreviewRepository] = useState<SourceControlRepository>();
  const [previewSource, setPreviewSource] = useState<OnboardingSource>();
  const [previewProvider, setPreviewProvider] = useState<string>();
  const [previewModel, setPreviewModel] = useState<string>();
  const [previewPersonalProvider, setPreviewPersonalProvider] = useState<string>();
  const [previewPersonalModel, setPreviewPersonalModel] = useState<string>();
  const [previewMethod, setPreviewMethod] = useState<ProviderConnectionMethod>();
  const [previewPersonalMethod, setPreviewPersonalMethod] = useState<ProviderConnectionMethod>();

  const updateDraft = (next: OnboardingDraft) => {
    persistOnboardingDraft(next);
    setDraft(next);
  };
  const goTo = (next: Step) => {
    persistOnboardingStep(next);
    setStep(next);
    setPreviewRepository(undefined);
    setPreviewProvider(undefined);
    setPreviewModel(undefined);
    setPreviewPersonalProvider(undefined);
    setPreviewPersonalModel(undefined);
    setPreviewMethod(undefined);
    setPreviewPersonalMethod(undefined);
    complete.reset();
  };
  const advance = (next: Step) => {
    goTo(returnToReview ? 'review' : next);
    setReturnToReview(false);
  };
  const persistBeforeRedirect = (currentStep: Step) => {
    persistOnboardingDraft(draft);
    persistOnboardingStep(currentStep);
  };
  const preset = onSaveModelPreset ? (draft.preset ?? DEFAULT_MODEL_PRESET) : undefined;
  const steps = onboardingSteps(preset);
  const stepIndex = steps.indexOf(step);
  const previousStep = stepIndex > 0 ? steps[stepIndex - 1] : undefined;
  const repository = previewRepository ?? draft.repository;
  const model = previewModel ?? (previewProvider ? undefined : draft.model?.modelId);
  const personalModel = previewPersonalModel ?? (previewPersonalProvider ? undefined : draft.personal?.modelId);
  const meta = onboardingStepMeta(step, preset);

  return (
    <main className="onboarding-page bg-background text-foreground min-h-dvh pb-20">
      <div className="onboarding-layout grid min-h-[calc(100dvh-5rem)] w-full grid-cols-1 min-[900px]:grid-cols-[minmax(400px,44%)_minmax(0,1fr)]">
        <section className="onboarding-form-column relative z-3 flex min-w-0 flex-col px-6 py-5 min-[900px]:px-10 min-[900px]:py-8 lg:px-12 xl:px-16">
          <div className="onboarding-brand mb-4 flex items-center gap-3 min-[900px]:mb-8">
            <LogoWithoutText className="w-6" aria-hidden="true" />
            <Txt variant="label">Factory</Txt>
          </div>
          <div className="onboarding-content w-full max-w-lg min-[900px]:pt-20">
            <div className="onboarding-back mb-6">
              <div className="h-8">
                {previousStep && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setReturnToReview(false);
                      goTo(previousStep);
                    }}
                    aria-label="Go back to previous step"
                    disabled={mutationInFlight || complete.isPending}
                  >
                    <ArrowLeft aria-hidden="true" />
                    Back
                  </Button>
                )}
              </div>
            </div>

            <Txt as="h1" variant="hero" className="onboarding-heading min-h-[2lh] max-w-lg text-balance">
              {meta.title}
            </Txt>
            {meta.description && (
              <Txt
                as="p"
                variant="caption"
                tone="muted"
                className="onboarding-description mt-3 min-h-[2lh] max-w-md lg:mt-4"
              >
                {meta.description}
              </Txt>
            )}

            <div key={step} className="onboarding-form onboarding-reveal mt-6 w-full lg:mt-8">
              {step === 'initial' && <InitialFactoryStep onContinue={() => goTo('vcs')} />}
              {step === 'vcs' && (
                <VcsFactoryStep
                  initialRepository={draft.repository}
                  connectingRepositoryId={null}
                  githubRedirecting={githubRedirecting}
                  mutationPending={false}
                  mutationError={null}
                  onConnect={() => {
                    setGithubRedirecting(true);
                    persistBeforeRedirect('vcs');
                    connectGithub(baseUrl);
                  }}
                  onManageConnection={() => {
                    persistBeforeRedirect('vcs');
                    manageGithubConnection(baseUrl);
                  }}
                  onPreviewRepository={setPreviewRepository}
                  onSelectRepository={repo => {
                    updateDraft({ ...draft, repository: repo });
                    advance('project-management');
                  }}
                />
              )}
              {step === 'project-management' && (
                <ProjectManagementFactoryStep
                  onPreviewSource={setPreviewSource}
                  onConnect={() => {
                    persistBeforeRedirect('project-management');
                    connectLinear(baseUrl);
                  }}
                  onContinue={() => advance(preset ? 'model-preset' : 'model-provider')}
                />
              )}
              {step === 'model-preset' && preset && (
                <ModelSetupPresetStep
                  value={preset}
                  onChange={next => updateDraft({ ...draft, preset: next })}
                  onContinue={() => {
                    updateDraft({ ...draft, preset });
                    // A changed preset must visit its setup, even when entered from review.
                    setReturnToReview(false);
                    goTo(preset.kind === 'company' ? 'model-provider' : 'personal-provider');
                  }}
                />
              )}
              {step === 'model-provider' && (
                <ModelProviderFactoryStep
                  initialChoice={draft.model}
                  onPreviewModel={setPreviewModel}
                  onPreviewProvider={(providerId, method) => {
                    setPreviewMethod(method);
                    setPreviewProvider(providerId);
                    setPreviewModel(undefined);
                  }}
                  onComplete={model => {
                    if (!model && preset) {
                      // A member without shared access can still connect their own account.
                      updateDraft({ ...draft, model, preset: { kind: 'individual' } });
                      setReturnToReview(false);
                      goTo('personal-provider');
                      return;
                    }
                    updateDraft({ ...draft, model });
                    advance(!preset || includesPersonalSetup(preset) ? 'personal-provider' : 'review');
                  }}
                />
              )}
              {step === 'personal-provider' && (
                <PersonalProviderFactoryStep
                  initialChoice={draft.personal}
                  modelChoice={personalModelChoice(preset)}
                  onPreviewModel={setPreviewPersonalModel}
                  onContinue={personal => {
                    updateDraft({ ...draft, personal });
                    advance('review');
                  }}
                  onPreviewProvider={(providerId, method) => {
                    setPreviewPersonalProvider(providerId);
                    setPreviewPersonalMethod(method);
                    setPreviewPersonalModel(undefined);
                  }}
                />
              )}
              {step === 'review' && (
                <OnboardingReviewStep
                  draft={draft}
                  pending={complete.isPending}
                  error={complete.error?.message}
                  onConfirm={() => {
                    if (!complete.isPending) complete.mutate(draft);
                  }}
                  onEdit={target => {
                    setReturnToReview(true);
                    goTo(target);
                  }}
                />
              )}
            </div>
          </div>
        </section>

        <OnboardingPreview
          step={step}
          repository={repository}
          factoryName={draft.repository?.name}
          source={previewSource}
          model={model}
          providerId={previewProvider ?? draft.model?.providerId}
          personalProviderId={previewPersonalProvider ?? draft.personal?.providerId}
          connectionMethod={previewMethod ?? draft.model?.method}
          personalConnectionMethod={previewPersonalMethod ?? draft.personal?.method}
          preset={preset}
          personalModel={personalModel}
        />
      </div>
      <OnboardingProgress step={step} preset={preset} editingReview={returnToReview} />
    </main>
  );
}

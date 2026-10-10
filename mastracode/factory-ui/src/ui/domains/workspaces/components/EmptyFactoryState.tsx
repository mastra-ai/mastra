import { OnboardingProgress } from './onboarding/OnboardingProgress';
import { usesPersonalFactoryModel } from '../services/onboardingModelChoice';
import { onboardingSteps, onboardingStepMeta } from '../services/onboardingSteps';
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
import { OnboardingPreview } from './onboarding/preview/OnboardingPreview';
import type { ProviderConnectionMethod } from '../hooks/useProviderConnection';
import type { OnboardingSource } from './onboarding/preview/OnboardingPreview';
import { InitialFactoryStep } from './InitialFactoryStep';
import { ModelProviderFactoryStep } from './ModelProviderFactoryStep';
import { PersonalProviderFactoryStep } from './PersonalProviderFactoryStep';
import { ProjectManagementFactoryStep } from './ProjectManagementFactoryStep';
import { VcsFactoryStep } from './VcsFactoryStep';
import { OnboardingReviewStep } from './onboarding/OnboardingReviewStep';

/** What the user hovers or focuses before choosing; cleared on every step change. */
interface StepPreview {
  repository?: SourceControlRepository;
  providerId?: string;
  method?: ProviderConnectionMethod;
  model?: string;
  personalProviderId?: string;
  personalMethod?: ProviderConnectionMethod;
  personalModel?: string;
}

/** Hovering another provider hides the saved model: it belongs to the saved provider. */
function shownModel(previewedModel?: string, previewedProvider?: string, savedModel?: string) {
  if (previewedModel) return previewedModel;
  if (previewedProvider) return undefined;
  return savedModel;
}

export function EmptyFactoryState() {
  const { baseUrl } = useApiConfig();
  const mutationInFlight = useIsMutating() > 0;
  const complete = useCompleteFactorySetup();
  const [draft, setDraft] = useState<OnboardingDraft>(readOnboardingDraft);
  const [step, setStep] = useState<Step>(() => {
    const saved = readOnboardingStep();
    const stored = readOnboardingDraft();
    if (saved !== 'initial' && !stored.repository) return 'vcs';
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
  const [previewSource, setPreviewSource] = useState<OnboardingSource>();
  const [preview, setPreview] = useState<StepPreview>({});
  const previewWith = (patch: StepPreview) => setPreview(current => ({ ...current, ...patch }));

  const updateDraft = (next: OnboardingDraft) => {
    persistOnboardingDraft(next);
    setDraft(next);
  };
  const goTo = (next: Step) => {
    persistOnboardingStep(next);
    setStep(next);
    setPreview({});
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
  const steps = onboardingSteps();
  const stepIndex = steps.indexOf(step);
  const previousStep = stepIndex > 0 ? steps[stepIndex - 1] : undefined;
  const repository = preview.repository ?? draft.repository;
  const model = shownModel(preview.model, preview.providerId, draft.model?.modelId);
  const personalModel = shownModel(preview.personalModel, preview.personalProviderId, draft.personal?.modelId);
  const personalIsFactoryModel = usesPersonalFactoryModel(draft);
  const meta = onboardingStepMeta(step, personalIsFactoryModel);

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
                  githubRedirecting={githubRedirecting}
                  onConnect={() => {
                    setGithubRedirecting(true);
                    persistBeforeRedirect('vcs');
                    connectGithub(baseUrl);
                  }}
                  onManageConnection={() => {
                    persistBeforeRedirect('vcs');
                    manageGithubConnection(baseUrl);
                  }}
                  onPreviewRepository={previewed => previewWith({ repository: previewed })}
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
                  onContinue={() => advance('model-provider')}
                />
              )}
              {step === 'model-provider' && (
                <ModelProviderFactoryStep
                  initialChoice={draft.model}
                  onPreviewModel={previewed => previewWith({ model: previewed })}
                  onPreviewProvider={(providerId, method) => previewWith({ providerId, method, model: undefined })}
                  onComplete={model => {
                    updateDraft({ ...draft, model });
                    if (!model) {
                      setReturnToReview(false);
                      goTo('personal-provider');
                      return;
                    }
                    advance('personal-provider');
                  }}
                />
              )}
              {step === 'personal-provider' && (
                <PersonalProviderFactoryStep
                  initialChoice={draft.personal}
                  modelChoice={personalIsFactoryModel ? 'required' : undefined}
                  onPreviewModel={previewed => previewWith({ personalModel: previewed })}
                  onContinue={personal => {
                    updateDraft({ ...draft, personal });
                    advance('review');
                  }}
                  onPreviewProvider={(providerId, method) =>
                    previewWith({ personalProviderId: providerId, personalMethod: method, personalModel: undefined })
                  }
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
          source={previewSource}
          model={model}
          providerId={preview.providerId ?? draft.model?.providerId}
          personalProviderId={preview.personalProviderId ?? draft.personal?.providerId}
          connectionMethod={preview.method ?? draft.model?.method}
          personalConnectionMethod={preview.personalMethod ?? draft.personal?.method}
          personalModel={personalModel}
        />
      </div>
      <OnboardingProgress step={step} editingReview={returnToReview} />
    </main>
  );
}

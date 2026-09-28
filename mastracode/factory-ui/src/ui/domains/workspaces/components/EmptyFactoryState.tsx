import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';

import { useApiConfig } from '../../../../api/config';
import { queryKeys } from '../../../../api/keys';
import { useCreateFactoryMutation, useFactoriesQuery, useLinkRepositoryMutation } from '../../../../hooks/useFactories';
import { connectLinear } from '../../factory/services/linear';
import type { FactoryProject, FactoryProjectPayload, SourceControlRepository } from '../services/github';
import { connectGithub, manageGithubConnection } from '../services/github';
import {
  clearOnboardingFlow,
  ONBOARDING_FACTORY_KEY as FACTORY_KEY,
  persistOnboardingFactory,
  persistOnboardingStep,
  readOnboardingStep,
  type OnboardingStep as Step,
} from '../services/onboardingFlow';
import { Button } from '@mastra/playground-ui/components/Button';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { ArrowLeft } from 'lucide-react';
import { FactoryHalftoneField } from '../../auth/components/FactoryHalftoneField';
import { InitialFactoryStep } from './InitialFactoryStep';
import { ModelProviderFactoryStep } from './ModelProviderFactoryStep';
import { PersonalProviderFactoryStep } from './PersonalProviderFactoryStep';
import { ProjectManagementFactoryStep } from './ProjectManagementFactoryStep';
import { VcsFactoryStep } from './VcsFactoryStep';
import { useNavigate } from 'react-router';

const STEP_META: Record<Step, { title: string; description?: string }> = {
  initial: {
    title: 'Build software with a Factory that knows your work.',
    description:
      'Mastra Factory connects your code, project context, and coding sessions in one shared workspace. It keeps every agent grounded in the repository and work that matters to your team.',
  },
  vcs: {
    title: 'Choose your codebase.',
    description: 'Connect GitHub or GitLab, then select the repository that will become your first Factory.',
  },
  'project-management': {
    title: 'Connect the work behind the code.',
  },
  'model-provider': {
    title: 'Choose your Factory model.',
    description: 'Connect a shared organization provider and select the default model for Factory runs.',
  },
  'personal-provider': {
    title: 'Connect your personal providers.',
    description: 'Optionally add personal provider credentials before you start using your Factory.',
  },
};

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Something went wrong. Please try again.';
}

export function EmptyFactoryState() {
  const { baseUrl } = useApiConfig();
  const queryClient = useQueryClient();
  const persistedFactories = useFactoriesQuery();
  const createFactory = useCreateFactoryMutation();
  const linkRepository = useLinkRepositoryMutation();
  const [step, setStep] = useState<Step>(readOnboardingStep);
  const [pendingFactory, setPendingFactory] = useState<FactoryProject | FactoryProjectPayload | null>(null);
  const [mutationError, setMutationError] = useState<string | null>(null);
  const [completionError, setCompletionError] = useState<string | null>(null);
  const [connectingRepositoryId, setConnectingRepositoryId] = useState<number | string | null>(null);
  const [githubRedirecting, setGithubRedirecting] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (persistedFactories.isPending || pendingFactory) return;
    const pendingId = sessionStorage.getItem(FACTORY_KEY);
    if (!pendingId) {
      if (step !== 'initial' && step !== 'vcs') setStep('vcs');
      return;
    }
    const restored = persistedFactories.data?.find(factory => factory.id === pendingId);
    if (restored) {
      setPendingFactory(restored);
      return;
    }
    sessionStorage.removeItem(FACTORY_KEY);
    persistOnboardingStep('vcs');
    setStep('vcs');
  }, [pendingFactory, persistedFactories.data, persistedFactories.isPending, step]);

  const goTo = (next: Step) => {
    persistOnboardingStep(next);
    setStep(next);
  };

  const persistBeforeRedirect = (currentStep: Step) => {
    persistOnboardingStep(currentStep);
    if (pendingFactory) persistOnboardingFactory(pendingFactory.id);
  };

  const chooseRepository = async (repo: SourceControlRepository) => {
    if (createFactory.isPending || linkRepository.isPending) return;
    setMutationError(null);
    setConnectingRepositoryId(repo.id);
    try {
      // A prior attempt may have created the Factory before the link step
      // failed. Reuse that Factory so retrying cannot create a duplicate.
      const factory = pendingFactory ?? (await createFactory.mutateAsync({ name: repo.name }));
      if (!pendingFactory) {
        setPendingFactory(factory);
        persistOnboardingFactory(factory.id);
      }
      const linkedRepository = await linkRepository.mutateAsync({
        factoryProjectId: factory.id,
        repo,
      });
      const linkedFactory: FactoryProject = {
        ...factory,
        repositories: [linkedRepository],
      };
      setPendingFactory(linkedFactory);
      await queryClient.invalidateQueries({ queryKey: queryKeys.factories() });
      goTo('project-management');
    } catch (error) {
      setMutationError(errorMessage(error));
    } finally {
      setConnectingRepositoryId(null);
    }
  };

  const finish = async () => {
    if (!pendingFactory) {
      setCompletionError('Your pending Factory could not be found. Choose a repository again.');
      return;
    }
    setCompletionError(null);
    try {
      await queryClient.invalidateQueries({ queryKey: queryKeys.factories() });
      clearOnboardingFlow();
      void navigate(`/factories/${pendingFactory.id}`);
    } catch (error) {
      setCompletionError(errorMessage(error));
    }
  };

  const steps: Step[] = ['initial', 'vcs', 'project-management', 'model-provider', 'personal-provider'];
  const stepIndex = steps.indexOf(step);
  const previousStep = stepIndex > 0 ? steps[stepIndex - 1] : undefined;
  // Once a Factory has been created for the user's first repository pick, Back
  // can no longer safely land on `vcs`: rewinding would either orphan the
  // server Factory or race against the retry that already links to it. Drop
  // the affordance in that case rather than shipping a destructive delete.
  const backDisabled = Boolean(pendingFactory) && previousStep === 'vcs';

  return (
    <main className="bg-sidebar text-foreground min-h-dvh">
      <div className="grid min-h-dvh w-full grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(480px,42%)]">
        <section className="relative z-3 flex flex-col justify-center px-6 py-12 sm:px-10 lg:px-16 lg:py-17 xl:px-20">
          <div className="w-full max-w-2xl">
            <div className="mb-9 flex items-center gap-3">
              {previousStep && !backDisabled && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => goTo(previousStep)}
                  aria-label="Go back to previous step"
                  // A pending chooseRepository run ends with goTo('project-management');
                  // letting Back fire mid-flight would move the user forward again
                  // right after they chose to go back. connectingRepositoryId covers
                  // the whole run — including the factories invalidation await after
                  // both mutations have settled.
                  disabled={createFactory.isPending || linkRepository.isPending || connectingRepositoryId !== null}
                >
                  <ArrowLeft aria-hidden="true" />
                  Back
                </Button>
              )}
              <ol className="flex gap-2" aria-label="Factory setup progress">
                {steps.map((item, index) => (
                  <li
                    key={item}
                    aria-current={step === item ? 'step' : undefined}
                    className={`h-1 w-14 rounded-full transition-colors ${index <= stepIndex ? 'bg-accent1' : 'bg-fill'}`}
                  >
                    <span className="sr-only">Step {index + 1}</span>
                  </li>
                ))}
              </ol>
            </div>

            <h1 className="max-w-xl text-[clamp(2rem,3.9vw,3.25rem)] leading-[1.1] font-[520] tracking-[0.01em] text-balance [font-stretch:112%]">
              {STEP_META[step].title}
            </h1>
            {STEP_META[step].description && (
              <Txt
                as="p"
                variant="body"
                tone="muted"
                className="mt-6 max-w-lg text-[clamp(1rem,1.5vw,1.25rem)] leading-[1.4] tracking-[0.01em]"
              >
                {STEP_META[step].description}
              </Txt>
            )}

            <div
              key={step}
              className="animate-in fade-in slide-in-from-bottom-2 mt-11 w-full duration-300 motion-reduce:animate-none"
            >
              {step === 'initial' && <InitialFactoryStep onContinue={() => goTo('vcs')} />}
              {step === 'vcs' && (
                <VcsFactoryStep
                  connectingRepositoryId={connectingRepositoryId}
                  githubRedirecting={githubRedirecting}
                  mutationPending={createFactory.isPending || linkRepository.isPending}
                  mutationError={mutationError}
                  onConnect={() => {
                    setGithubRedirecting(true);
                    persistBeforeRedirect('vcs');
                    connectGithub(baseUrl);
                  }}
                  onManageConnection={() => {
                    persistBeforeRedirect('vcs');
                    manageGithubConnection(baseUrl);
                  }}
                  onSelectRepository={repo => void chooseRepository(repo)}
                />
              )}
              {step === 'project-management' && (
                <ProjectManagementFactoryStep
                  onConnect={() => {
                    persistBeforeRedirect('project-management');
                    connectLinear(baseUrl);
                  }}
                  onContinue={() => goTo('model-provider')}
                />
              )}
              {step === 'model-provider' && pendingFactory && (
                <ModelProviderFactoryStep
                  factoryId={pendingFactory.id}
                  completionError={completionError ?? undefined}
                  onComplete={() => goTo('personal-provider')}
                />
              )}
              {step === 'personal-provider' && pendingFactory && (
                <PersonalProviderFactoryStep onContinue={() => void finish()} />
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

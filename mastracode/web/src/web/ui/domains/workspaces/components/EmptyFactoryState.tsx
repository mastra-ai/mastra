import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';

import { useApiConfig } from '../../../../../shared/api/config';
import { queryKeys } from '../../../../../shared/api/keys';
import {
  useCreateFactoryMutation,
  useFactoriesQuery,
  useLinkRepositoryMutation,
} from '../../../../../shared/hooks/useFactories';
import { connectLinear } from '../../factory/services/linear';
import type { FactoryProject, FactoryProjectPayload } from '../services/github';
import { connectGithub, manageGithubConnection } from '../services/github';
import type { GithubRepo } from '../services/github';
import {
  clearOnboardingFlow,
  ONBOARDING_FACTORY_KEY as FACTORY_KEY,
  persistOnboardingFactory,
  persistOnboardingStep,
  readOnboardingStep,
  type OnboardingStep as Step,
} from '../services/onboardingFlow';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { FactoryHalftoneField } from '../../auth/components/FactoryHalftoneField';
import { InitialFactoryStep } from './InitialFactoryStep';
import { ModelProviderFactoryStep } from './ModelProviderFactoryStep';
import { ProjectManagementFactoryStep } from './ProjectManagementFactoryStep';
import { VcsFactoryStep } from './VcsFactoryStep';
import { useNavigate } from 'react-router';
import '@fontsource-variable/mona-sans/standard.css';

const STEP_META: Record<Step, { title: string; description?: string }> = {
  initial: {
    title: 'Build software with a Factory that knows your work.',
    description:
      'Mastra Factory connects your code, project context, and coding sessions in one shared workspace. It keeps every agent grounded in the repository and work that matters to your team.',
  },
  vcs: {
    title: 'Choose your codebase.',
    description: 'Connect GitHub, then select the repository that will become your first factory.',
  },
  'project-management': {
    title: 'Connect the work behind the code.',
  },
  'model-provider': {
    title: 'Choose your Factory model.',
    description: 'Connect a provider and select the default model for Factory runs.',
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
  const [connectingRepositoryId, setConnectingRepositoryId] = useState<number | null>(null);
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

  const chooseRepository = async (repo: GithubRepo) => {
    if (createFactory.isPending || linkRepository.isPending) return;
    setMutationError(null);
    setConnectingRepositoryId(repo.id);
    try {
      const factory = await createFactory.mutateAsync({ name: repo.name });
      setPendingFactory(factory);
      persistOnboardingFactory(factory.id);
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

  const steps: Step[] = ['initial', 'vcs', 'project-management', 'model-provider'];
  const stepIndex = steps.indexOf(step);

  return (
    <main className="factory-signin-theme min-h-dvh bg-surface1 font-mona-sans text-neutral6">
      <div className="grid min-h-dvh w-full grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(480px,42%)]">
        <section className="relative z-3 flex flex-col justify-center px-6 py-12 sm:px-10 lg:px-16 lg:py-17 xl:px-20">
          <div className="w-full max-w-2xl">
            <ol className="mb-9 flex gap-2" aria-label="Factory setup progress">
              {steps.map((item, index) => (
                <li
                  key={item}
                  aria-current={step === item ? 'step' : undefined}
                  className={`h-1 w-14 rounded-full transition-colors ${index <= stepIndex ? 'bg-accent1' : 'bg-surface4'}`}
                >
                  <span className="sr-only">Step {index + 1}</span>
                </li>
              ))}
            </ol>

            <h1 className="max-w-xl text-[clamp(2rem,3.9vw,3.25rem)] leading-[1.1] font-[520] tracking-[0.01em] text-balance [font-stretch:112%]">
              {STEP_META[step].title}
            </h1>
            {STEP_META[step].description && (
              <Txt
                as="p"
                variant="ui-lg"
                className="mt-6 max-w-lg text-[clamp(1rem,1.5vw,1.25rem)] leading-[1.4] tracking-[0.01em] text-neutral3"
              >
                {STEP_META[step].description}
              </Txt>
            )}

            <div
              key={step}
              className="mt-11 w-full animate-in fade-in slide-in-from-bottom-2 duration-300 motion-reduce:animate-none"
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
                  onComplete={() => void finish()}
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

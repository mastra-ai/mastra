import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';

import { useApiConfig } from '../../../../../shared/api/config';
import { queryKeys } from '../../../../../shared/api/keys';
import { useCreateFactoryMutation, useFactoriesQuery, useLinkRepositoryMutation } from '../../../../../shared/hooks/useFactories';
import { connectLinear } from '../../factory/services/linear';
import type { FactoryProject, FactoryProjectPayload } from '../services/github';
import { connectGithub, manageGithubConnection } from '../services/github';
import type { GithubRepo } from '../services/github';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { FactoryHalftoneField } from '../../auth/components/FactoryHalftoneField';
import { InitialFactoryStep } from './InitialFactoryStep';
import { ProjectManagementFactoryStep } from './ProjectManagementFactoryStep';
import { VcsFactoryStep } from './VcsFactoryStep';
import { useNavigate } from 'react-router';

export type Step = 'initial' | 'vcs' | 'project-management';

const STEP_KEY = 'mastracode.factory-onboarding.step';
const FACTORY_KEY = 'mastracode.factory-onboarding.factory-id';

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
};

function storedStep(): Step {
  const value = sessionStorage.getItem(STEP_KEY);
  return value === 'vcs' || value === 'project-management' ? value : 'initial';
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Something went wrong. Please try again.';
}

export function EmptyFactoryState() {
  const { baseUrl } = useApiConfig();
  const queryClient = useQueryClient();
  const persistedFactories = useFactoriesQuery();
  const createFactory = useCreateFactoryMutation();
  const linkRepository = useLinkRepositoryMutation();
  const [step, setStep] = useState<Step>(storedStep);
  const [pendingFactory, setPendingFactory] = useState<FactoryProject | FactoryProjectPayload | null>(null);
  const [mutationError, setMutationError] = useState<string | null>(null);
  const [completionError, setCompletionError] = useState<string | null>(null);
  const [connectingRepositoryId, setConnectingRepositoryId] = useState<number | null>(null);
  const [githubRedirecting, setGithubRedirecting] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (persistedFactories.isPending || pendingFactory) return;
    const pendingId = sessionStorage.getItem(FACTORY_KEY);
    if (!pendingId) {
      if (step === 'project-management') setStep('vcs');
      return;
    }
    const restored = persistedFactories.data?.find(factory => factory.id === pendingId);
    if (restored) {
      setPendingFactory(restored);
      return;
    }
    sessionStorage.removeItem(FACTORY_KEY);
    sessionStorage.setItem(STEP_KEY, 'vcs');
    setStep('vcs');
  }, [pendingFactory, persistedFactories.data, persistedFactories.isPending, step]);

  const goTo = (next: Step) => {
    sessionStorage.setItem(STEP_KEY, next);
    setStep(next);
  };

  const persistBeforeRedirect = (currentStep: Step) => {
    sessionStorage.setItem(STEP_KEY, currentStep);
    if (pendingFactory) sessionStorage.setItem(FACTORY_KEY, pendingFactory.id);
  };

  const chooseRepository = async (repo: GithubRepo) => {
    if (createFactory.isPending || linkRepository.isPending) return;
    setMutationError(null);
    setConnectingRepositoryId(repo.id);
    try {
      const factory = await createFactory.mutateAsync({ name: repo.name });
      setPendingFactory(factory);
      sessionStorage.setItem(FACTORY_KEY, factory.id);
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
    setFinishing(true);
    try {
      await queryClient.invalidateQueries({ queryKey: queryKeys.factories() });
      sessionStorage.removeItem(STEP_KEY);
      sessionStorage.removeItem(FACTORY_KEY);
      void navigate(`/factories/${pendingFactory.id}`);
    } catch (error) {
      setCompletionError(errorMessage(error));
      setFinishing(false);
    }
  };

  return (
    <main className="relative min-h-dvh overflow-hidden bg-surface1 text-neutral6">
      <FactoryHalftoneField variant="backdrop" />
      <div className="relative mx-auto flex min-h-dvh w-full max-w-7xl flex-col px-6 py-8 sm:px-10 lg:px-16">
        <section className="mx-auto flex w-full max-w-3xl flex-1 flex-col text-center">
          <div className="pt-2 sm:pt-4">
            <ol className="mb-6 flex justify-center gap-2" aria-label="Factory setup progress">
              {(['initial', 'vcs', 'project-management'] as const).map((item, index) => (
                <li
                  key={item}
                  aria-current={step === item ? 'step' : undefined}
                  className={`h-1 w-14 rounded-full ${index <= ['initial', 'vcs', 'project-management'].indexOf(step) ? 'bg-accent1' : 'bg-surface4'}`}
                >
                  <span className="sr-only">Step {index + 1}</span>
                </li>
              ))}
            </ol>
            <h1 className="mx-auto max-w-2xl text-3xl leading-tight font-semibold tracking-[-0.035em] text-balance sm:text-4xl lg:text-5xl">
              {STEP_META[step].title}
            </h1>
            {STEP_META[step].description && (
              <Txt as="p" variant="ui-lg" className="mx-auto mt-6 max-w-2xl leading-7 text-neutral3 sm:text-lg">
                {STEP_META[step].description}
              </Txt>
            )}
          </div>
          <div className="flex flex-1 items-start justify-center pt-16">
            <div
              key={step}
              className="w-full animate-in fade-in slide-in-from-bottom-2 duration-300 motion-reduce:animate-none"
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
                  completionError={completionError}
                  finishing={finishing}
                  onConnect={() => {
                    persistBeforeRedirect('project-management');
                    connectLinear(baseUrl);
                  }}
                  onFinish={() => void finish()}
                />
              )}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

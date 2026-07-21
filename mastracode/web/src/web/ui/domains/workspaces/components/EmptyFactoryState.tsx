import { useEffect, useState } from 'react';

import { useApiConfig } from '../../../../../shared/api/config';
import { useCreateFactoryMutation, useLinkRepositoryMutation, useLoadFactories } from '../../../../../shared/hooks/useFactories';
import { useActiveFactoryContext } from '../context/ActiveFactoryProvider';
import { connectLinear } from '../../factory/services/linear';
import { saveFactories } from '../services/factories';
import type { Factory, ServerFactory } from '../services/factories';
import { connectGithub, manageGithubConnection } from '../services/github';
import type { GithubRepo } from '../services/github';
import { InitialFactoryStep } from './InitialFactoryStep';
import { ProjectManagementFactoryStep } from './ProjectManagementFactoryStep';
import { VcsFactoryStep } from './VcsFactoryStep';

export type Step = 'initial' | 'vcs' | 'project-management';

const STEP_KEY = 'mastracode.factory-onboarding.step';
const FACTORY_KEY = 'mastracode.factory-onboarding.factory-id';

function storedStep(): Step {
  const value = sessionStorage.getItem(STEP_KEY);
  return value === 'vcs' || value === 'project-management' ? value : 'initial';
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Something went wrong. Please try again.';
}

export interface EmptyFactoryStateProps {
  onOpenFactories?: () => void;
}

export function EmptyFactoryState(_props: EmptyFactoryStateProps) {
  const { baseUrl } = useApiConfig();
  const { selectFactory } = useActiveFactoryContext();
  const persistedFactories = useLoadFactories();
  const createFactory = useCreateFactoryMutation();
  const linkRepository = useLinkRepositoryMutation();
  const [step, setStep] = useState<Step>(storedStep);
  const [pendingFactory, setPendingFactory] = useState<Factory | null>(null);
  const [mutationError, setMutationError] = useState<string | null>(null);
  const [completionError, setCompletionError] = useState<string | null>(null);
  const [connectingRepositoryId, setConnectingRepositoryId] = useState<number | null>(null);
  const [githubRedirecting, setGithubRedirecting] = useState(false);
  const [finishing, setFinishing] = useState(false);

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
        factoryProjectId: factory.binding.factoryProjectId,
        repo,
      });
      const linkedFactory: ServerFactory = {
        ...factory,
        binding: {
          ...factory.binding,
          selectedRepositoryId: linkedRepository.projectRepositoryId,
          repositories: [{ ...linkedRepository, worktrees: [] }],
        },
      };
      setPendingFactory(linkedFactory);
      saveFactories([...(persistedFactories.data ?? []).filter(item => item.id !== linkedFactory.id), linkedFactory]);
      goTo('project-management');
    } catch (error) {
      setMutationError(errorMessage(error));
    } finally {
      setConnectingRepositoryId(null);
    }
  };

  const finish = async () => {
    if (!pendingFactory || finishing) return;
    setCompletionError(null);
    setFinishing(true);
    try {
      await selectFactory(pendingFactory);
      sessionStorage.removeItem(STEP_KEY);
      sessionStorage.removeItem(FACTORY_KEY);
      window.history.replaceState({}, '', '/factory/work');
    } catch (error) {
      setCompletionError(errorMessage(error));
      setFinishing(false);
    }
  };

  return (
    <main className="relative min-h-dvh overflow-hidden bg-surface1 text-neutral6">
      <div className="pointer-events-none absolute inset-0" aria-hidden="true">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_42%,color-mix(in_oklab,var(--accent1)_15%,transparent),transparent_34%)]" />
      </div>
      <div className="relative mx-auto flex min-h-dvh w-full max-w-7xl items-center px-6 py-10 sm:px-10 lg:px-16">
        <section className="mx-auto w-full max-w-3xl text-center">
          <ol className="mb-8 flex justify-center gap-2" aria-label="Factory setup progress">
            {(['initial', 'vcs', 'project-management'] as const).map((item, index) => (
              <li
                key={item}
                aria-current={step === item ? 'step' : undefined}
                className={`h-1.5 w-14 rounded-full ${index <= ['initial', 'vcs', 'project-management'].indexOf(step) ? 'bg-accent1' : 'bg-surface4'}`}
              >
                <span className="sr-only">Step {index + 1}</span>
              </li>
            ))}
          </ol>
          <div key={step} className="animate-in fade-in slide-in-from-bottom-2 duration-300 motion-reduce:animate-none">
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
        </section>
      </div>
    </main>
  );
}

import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';

import { useApiConfig } from '../../../../../shared/api/config';
import { queryKeys } from '../../../../../shared/api/keys';
import {
  useCreateFactoryMutation,
  useLinkRepositoryMutation,
  useLoadFactories,
} from '../../../../../shared/hooks/useFactories';
import { connectLinear } from '../../factory/services/linear';
import { saveFactories } from '../services/factories';
import type { Factory, ServerFactory } from '../services/factories';
import { factoryHomePath } from '../services/factoryPaths';
import { connectGithub, manageGithubConnection } from '../services/github';
import type { GithubRepo } from '../services/github';
import { FactorySetupShell } from './FactorySetupShell';
import { InitialFactoryStep } from './InitialFactoryStep';
import { ProjectManagementFactoryStep } from './ProjectManagementFactoryStep';
import { VcsFactoryStep } from './VcsFactoryStep';
import { useNavigate } from 'react-router';

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

export function EmptyFactoryState() {
  const { baseUrl } = useApiConfig();
  const queryClient = useQueryClient();
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
      void navigate(factoryHomePath(pendingFactory));
    } catch (error) {
      setCompletionError(errorMessage(error));
      setFinishing(false);
    }
  };

  return (
    <FactorySetupShell>
      <FactorySetupShell.Progress steps={['initial', 'vcs', 'project-management']} current={step} />
      <FactorySetupShell.Step stepKey={step}>
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
      </FactorySetupShell.Step>
    </FactorySetupShell>
  );
}

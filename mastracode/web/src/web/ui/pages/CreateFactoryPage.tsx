import { Button } from '@mastra/playground-ui/components/Button';
import { useQueryClient } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router';

import { useApiConfig } from '../../../shared/api/config';
import { queryKeys } from '../../../shared/api/keys';
import { useCreateFactoryMutation } from '../../../shared/hooks/useFactories';
import { connectLinear } from '../domains/factory/services/linear';
import { FactoryNameStep } from '../domains/workspaces/components/FactoryNameStep';
import { FactorySetupShell } from '../domains/workspaces/components/FactorySetupShell';
import { ModelProviderFactoryStep } from '../domains/workspaces/components/ModelProviderFactoryStep';
import { ProjectManagementFactoryStep } from '../domains/workspaces/components/ProjectManagementFactoryStep';
import { VcsFactoryStep } from '../domains/workspaces/components/VcsFactoryStep';
import { useConnectFactoryRepository } from '../domains/workspaces/hooks/useConnectFactoryRepository';
import { useCreateFactoryFlow } from '../domains/workspaces/hooks/useCreateFactoryFlow';
import { factoryHomePath } from '../domains/workspaces/services/factoryPaths';
import { connectGithub, manageGithubConnection } from '../domains/workspaces/services/github';
import type { GithubRepo } from '../domains/workspaces/services/github';
import { useKeyDown } from '../lib/hooks';

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Something went wrong. Please try again.';
}

const STEP_TITLES = {
  name: 'Name your new Factory.',
  vcs: 'Choose your codebase.',
  'project-management': 'Connect the work behind the code.',
  'model-provider': 'Choose your Factory model.',
} as const;

/**
 * Full-screen Create Factory wizard (`/factories/create`): Name → VCS →
 * Project management → Model provider, mirroring onboarding. The factory is created up-front on
 * the name step so the GitHub OAuth redirect can resume mid-flow (see
 * `useCreateFactoryFlow`) and repo linking has a target. Back/Escape return to
 * the previous page via history; deep links fall back to `/`.
 */
export function CreateFactoryPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { baseUrl } = useApiConfig();
  const queryClient = useQueryClient();
  const createFactory = useCreateFactoryMutation();
  const flow = useCreateFactoryFlow();
  const [mutationError, setMutationError] = useState<string | null>(null);
  const [completionError, setCompletionError] = useState<string | null>(null);
  const [connectingRepositoryId, setConnectingRepositoryId] = useState<number | null>(null);
  const [githubRedirecting, setGithubRedirecting] = useState(false);

  const pendingFactory = flow.state?.pendingFactory;
  const linkRepository = useConnectFactoryRepository({
    pendingFactory,
    onLinked: linkedFactory => flow.advanceToProjectManagement(linkedFactory),
  });

  // A stored step past `name` without a restorable pending factory (cleared
  // storage, factory removed elsewhere) cannot continue — restart at the name step.
  useEffect(() => {
    if (!flow.state) return;
    if (flow.state.step !== 'name' && !flow.state.pendingFactory) void flow.clear();
  }, [flow]);

  const goBack = () => {
    if (location.key === 'default') void navigate('/');
    else void navigate(-1);
  };
  useKeyDown({ escape: goBack });

  const submitName = async (name: string) => {
    try {
      const factory = await createFactory.mutateAsync({ name });
      await flow.advanceToVcs(factory);
    } catch {
      // Mutation state owns the rendered error.
    }
  };

  const chooseRepository = async (repo: GithubRepo) => {
    if (linkRepository.isPending) return;
    setMutationError(null);
    setConnectingRepositoryId(repo.id);
    try {
      await linkRepository.mutateAsync(repo);
    } catch (error) {
      setMutationError(errorMessage(error));
    } finally {
      setConnectingRepositoryId(null);
    }
  };

  const finish = async () => {
    if (!pendingFactory) {
      setCompletionError('Your pending Factory could not be found. Start over from the name step.');
      return;
    }
    setCompletionError(null);
    try {
      await queryClient.invalidateQueries({ queryKey: queryKeys.factories() });
      await flow.clear();
      void navigate(factoryHomePath(pendingFactory));
    } catch (error) {
      setCompletionError(errorMessage(error));
    }
  };

  const step = flow.state?.step;
  const stepDescription =
    step === 'name'
      ? 'A Factory owns its board, metrics, and audit trail. You can connect repositories in the next step.'
      : step === 'vcs'
        ? `Connect GitHub, then select the repository to link to ${pendingFactory?.name ?? 'your Factory'}.`
        : step === 'model-provider'
          ? 'Connect a provider and select the default model for Factory runs.'
          : undefined;

  return (
    <FactorySetupShell
      topLeft={
        <Button variant="ghost" onClick={goBack}>
          <ArrowLeft aria-hidden="true" />
          Back
        </Button>
      }
    >
      {step && (
        <>
          <FactorySetupShell.Header title={STEP_TITLES[step]} description={stepDescription}>
            <FactorySetupShell.Progress
              steps={['name', 'vcs', 'project-management', 'model-provider']}
              current={step}
            />
          </FactorySetupShell.Header>
          <FactorySetupShell.Step stepKey={step}>
            {step === 'name' && (
              <FactoryNameStep
                pending={createFactory.isPending}
                error={createFactory.error ? errorMessage(createFactory.error) : null}
                onSubmit={name => void submitName(name)}
              />
            )}
            {step === 'vcs' && (
              <VcsFactoryStep
                connectingRepositoryId={connectingRepositoryId}
                githubRedirecting={githubRedirecting}
                mutationPending={linkRepository.isPending}
                mutationError={mutationError}
                onConnect={() => {
                  setGithubRedirecting(true);
                  flow.persistBeforeRedirect();
                  connectGithub(baseUrl);
                }}
                onManageConnection={() => {
                  flow.persistBeforeRedirect();
                  manageGithubConnection(baseUrl);
                }}
                onSelectRepository={repo => void chooseRepository(repo)}
              />
            )}
            {step === 'project-management' && pendingFactory && (
              <ProjectManagementFactoryStep
                onConnect={() => {
                  flow.persistBeforeRedirect();
                  connectLinear(baseUrl);
                }}
                onContinue={() => void flow.advanceToModelProvider(pendingFactory)}
              />
            )}
            {step === 'model-provider' && pendingFactory && (
              <ModelProviderFactoryStep
                factoryId={pendingFactory.id}
                completionError={completionError ?? undefined}
                onComplete={() => void finish()}
              />
            )}
          </FactorySetupShell.Step>
        </>
      )}
    </FactorySetupShell>
  );
}

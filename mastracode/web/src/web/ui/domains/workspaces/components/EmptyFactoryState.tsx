import { Button } from '@mastra/playground-ui/components/Button';
import { EmptyState } from '@mastra/playground-ui/components/EmptyState';
import { Spinner } from '@mastra/playground-ui/components/Spinner';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { useEffect, useState } from 'react';

import { useApiConfig } from '../../../../../shared/api/config';
import { useCreateFactoryMutation, useLinkRepositoryMutation } from '../../../../../shared/hooks/useFactories';
import { useGithubReposQuery } from '../../../../../shared/hooks/useGithubRepos';
import { useGithubStatusQuery } from '../../../../../shared/hooks/useGithubStatus';
import { useLinearStatusQuery } from '../../../../../shared/hooks/useLinearData';
import { GithubIcon, LinearIcon, SearchIcon } from '../../../ui/icons';
import { SkeletonRows } from '../../../ui/SkeletonRows';
import { useActiveFactoryContext } from '../context/ActiveFactoryProvider';
import { connectLinear } from '../../factory/services/linear';
import { loadFactories } from '../services/factories';
import { connectGithub, manageGithubConnection } from '../services/github';

export type Step = 'initial' | 'vcs' | 'project-management';

const STEP_KEY = 'mastracode.factory-onboarding.step';
const FACTORY_KEY = 'mastracode.factory-onboarding.factory-id';

function storedStep(): Step {
  const value = sessionStorage.getItem(STEP_KEY);
  return value === 'vcs' || value === 'project-management' ? value : 'initial';
}

function errorMessage(error: unknown): string | null {
  return error instanceof Error ? error.message : null;
}

/** Factory onboarding shown when no factory is active yet. */
export function EmptyFactoryState({ onOpenFactories: _onOpenFactories }: { onOpenFactories?: () => void }) {
  const { baseUrl } = useApiConfig();
  const { factories, factoriesPending, selectFactory } = useActiveFactoryContext();
  const [step, setStep] = useState<Step>(storedStep);
  const [query, setQuery] = useState('');
  const [githubRedirecting, setGithubRedirecting] = useState(false);
  const [connectingRepositoryId, setConnectingRepositoryId] = useState<number | null>(null);
  const [finishing, setFinishing] = useState(false);
  const [completionError, setCompletionError] = useState<string | null>(null);
  const githubStatus = useGithubStatusQuery(step === 'vcs');
  const connectedToGithub = githubStatus.data?.connected === true;
  const repos = useGithubReposQuery(query || undefined, step === 'vcs' && connectedToGithub);
  const linearStatus = useLinearStatusQuery(step === 'project-management');
  const createFactory = useCreateFactoryMutation();
  const linkRepository = useLinkRepositoryMutation();
  const pendingFactoryId = sessionStorage.getItem(FACTORY_KEY);
  const pendingFactory =
    factories.find(factory => factory.id === pendingFactoryId) ??
    loadFactories().find(factory => factory.id === pendingFactoryId);
  const mutationError = errorMessage(createFactory.error) ?? errorMessage(linkRepository.error);

  useEffect(() => {
    if (factoriesPending || step !== 'project-management' || !pendingFactoryId) return;
    if (!pendingFactory) {
      sessionStorage.removeItem(FACTORY_KEY);
      sessionStorage.setItem(STEP_KEY, 'vcs');
      setStep('vcs');
    }
  }, [factoriesPending, pendingFactory, pendingFactoryId, step]);

  const goTo = (nextStep: Step) => {
    sessionStorage.setItem(STEP_KEY, nextStep);
    setStep(nextStep);
  };

  const persistBeforeRedirect = (target: Step) => {
    sessionStorage.setItem(STEP_KEY, target);
  };

  const chooseRepository = async (repo: NonNullable<typeof repos.data>[number]) => {
    if (createFactory.isPending || linkRepository.isPending) return;
    createFactory.reset();
    linkRepository.reset();
    setConnectingRepositoryId(repo.id);
    try {
      const factory = await createFactory.mutateAsync({ name: repo.name });
      sessionStorage.setItem(FACTORY_KEY, factory.id);
      await linkRepository.mutateAsync({ factoryProjectId: factory.binding.factoryProjectId, repo });
      goTo('project-management');
    } catch {
      // The mutations expose their server messages inline so the user can retry.
    } finally {
      setConnectingRepositoryId(null);
    }
  };

  const finish = async () => {
    setCompletionError(null);
    const factory = factories.find(item => item.id === sessionStorage.getItem(FACTORY_KEY));
    if (!factory) {
      setCompletionError('Your Factory could not be restored. Choose a repository to continue.');
      goTo('vcs');
      return;
    }
    setFinishing(true);
    try {
      await selectFactory(factory);
      sessionStorage.removeItem(STEP_KEY);
      sessionStorage.removeItem(FACTORY_KEY);
    } finally {
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
            {step === 'initial' && (
              <>
                <h1 className="mx-auto max-w-2xl text-3xl leading-tight font-semibold tracking-[-0.035em] text-balance sm:text-4xl lg:text-5xl">
                  Build software with a Factory that knows your work.
                </h1>
                <Txt as="p" variant="ui-lg" className="mx-auto mt-6 max-w-2xl leading-7 text-neutral3 sm:text-lg">
                  A Software Factory connects your code, project context, and coding sessions in one shared workspace. It
                  keeps every agent grounded in the repository and work that matter to your team.
                </Txt>

                <div className="mx-auto mt-8 w-full max-w-2xl text-left" aria-hidden="true">
                  <div className="grid grid-cols-3 gap-3">
                    <div className="rounded-xl border border-border1 bg-surface2/80 p-3">
                      <div className="mb-3 flex items-center gap-2 text-ui-xs font-medium text-icon3">
                        <span className="size-2 rounded-full bg-icon2" />
                        To do
                      </div>
                      <div className="relative min-h-[140px]">
                        <div className="animate-factory-ticket-move absolute inset-x-0 top-0 z-10 h-[64px] rounded-lg border border-border1 bg-surface3 px-3 py-2.5 shadow-sm motion-reduce:animate-none">
                          <span className="block text-ui-xs text-icon3">ENG-124</span>
                          <span className="mt-1 block text-ui-sm font-medium text-icon6">Add repository search</span>
                        </div>
                        <div className="animate-factory-ticket-appear absolute inset-x-0 top-[76px] h-[64px] rounded-lg border border-border1 bg-surface3 px-3 py-2.5 shadow-sm motion-reduce:animate-none">
                          <span className="block text-ui-xs text-icon3">ENG-125</span>
                          <span className="mt-1 block text-ui-sm font-medium text-icon6">Improve setup flow</span>
                        </div>
                      </div>
                    </div>
                    <div className="rounded-xl border border-border1 bg-surface2/80 p-3">
                      <div className="mb-3 flex items-center gap-2 text-ui-xs font-medium text-icon3">
                        <span className="size-2 rounded-full bg-accent1" />
                        In progress
                      </div>
                      <div className="min-h-[140px]" />
                    </div>
                    <div className="rounded-xl border border-border1 bg-surface2/80 p-3">
                      <div className="mb-3 flex items-center gap-2 text-ui-xs font-medium text-icon3">
                        <span className="size-2 rounded-full bg-accent3" />
                        Deployed
                      </div>
                      <div className="min-h-[140px]" />
                    </div>
                  </div>
                </div>

                <Button variant="primary" size="lg" className="mt-8 min-h-14 text-base" onClick={() => goTo('vcs')}>
                  Create my first factory
                </Button>
              </>
            )}

            {step === 'vcs' && (
              <>
                <h1 className="mx-auto max-w-2xl text-3xl leading-tight font-semibold tracking-[-0.035em] text-balance sm:text-4xl lg:text-5xl">
                  Choose your codebase.
                </h1>
                <Txt as="p" variant="ui-lg" className="mx-auto mt-6 max-w-2xl leading-7 text-neutral3 sm:text-lg">
                  Connect GitHub, then select the repository that will become your first Factory.
                </Txt>
                <section aria-label="GitHub repository" className="mx-auto mt-8 max-w-2xl rounded-2xl border border-border1 bg-surface2/80 p-5 text-left">
                  {githubStatus.isPending ? (
                    <SkeletonRows label="Loading GitHub status" rows={3} rowClassName="h-12 w-full rounded-xl" />
                  ) : !connectedToGithub ? (
                    <GithubConnection status={githubStatus.data} isConnecting={githubRedirecting} onConnect={() => {
                      setGithubRedirecting(true);
                      persistBeforeRedirect('vcs');
                      connectGithub(baseUrl);
                    }} />
                  ) : (
                    <div className="flex flex-col gap-4">
                      <div className="flex items-center gap-2 rounded-lg border border-border1 bg-surface1 px-3 py-2">
                        <SearchIcon size={15} className="text-icon2" />
                        <input
                          aria-label="Search repositories"
                          className="min-w-0 flex-1 bg-transparent text-ui-sm text-icon6 placeholder:text-icon2 focus:outline-none"
                          placeholder="Filter repositories…"
                          value={query}
                          onChange={event => setQuery(event.target.value)}
                        />
                      </div>
                      {mutationError && <p role="alert" className="m-0 text-ui-sm text-notice-destructive-fg">{mutationError}</p>}
                      {repos.isError && <p role="alert" className="m-0 text-ui-sm text-notice-destructive-fg">{repos.error.message}</p>}
                      {repos.isPending ? (
                        <SkeletonRows label="Loading repositories" rows={3} rowClassName="h-12 w-full rounded-xl" />
                      ) : repos.data?.length ? (
                        <div className="flex max-h-80 flex-col gap-2 overflow-y-auto">
                          {repos.data.map(repo => {
                            const isConnecting = connectingRepositoryId === repo.id;

                            return (
                              <button
                                key={repo.id}
                                className="flex items-center gap-3 rounded-xl border border-border1 bg-surface1 px-4 py-3 text-left hover:border-border2 hover:bg-surface4 disabled:opacity-60"
                                disabled={createFactory.isPending || linkRepository.isPending}
                                onClick={() => void chooseRepository(repo)}
                              >
                                <GithubIcon className="shrink-0 text-icon3" />
                                <span className="min-w-0 flex-1">
                                  <span className="block truncate text-ui-sm font-medium text-icon6">{repo.fullName}</span>
                                  <span className="block text-ui-xs text-icon3">{repo.private ? 'Private' : 'Public'} · {repo.defaultBranch}</span>
                                </span>
                                {isConnecting ? (
                                  <Spinner size="sm" aria-label={`Connecting ${repo.fullName}`} className="shrink-0 text-accent1" />
                                ) : (
                                  <span className="text-ui-xs text-accent1">Select</span>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      ) : (
                        <Txt as="p" variant="ui-sm" className="m-0 text-icon3">No repositories found.</Txt>
                      )}
                      <Button variant="outline" size="sm" className="self-start" onClick={() => {
                        persistBeforeRedirect('vcs');
                        manageGithubConnection(baseUrl);
                      }}>Manage GitHub connection</Button>
                    </div>
                  )}
                </section>
              </>
            )}

            {step === 'project-management' && (
              <>
                <h1 className="mx-auto max-w-2xl text-3xl leading-tight font-semibold tracking-[-0.035em] text-balance sm:text-4xl lg:text-5xl">
                  Connect the work behind the code.
                </h1>
                <section aria-label="Linear connection" className="mx-auto mt-8 max-w-xl rounded-2xl border border-border1 bg-surface2/80 p-5">
                  {linearStatus.isPending ? (
                    <SkeletonRows label="Loading Linear status" rows={2} rowClassName="h-12 w-full rounded-xl" />
                  ) : linearStatus.data?.connected ? (
                    <div className="flex flex-col gap-4">
                      <Txt as="p" variant="ui-md" className="m-0 text-icon5">Connected to {linearStatus.data.workspace?.name ?? 'Linear'}.</Txt>
                      <Button variant="primary" onClick={() => void finish()}>Finish setup</Button>
                    </div>
                  ) : (
                    <EmptyState
                      className="py-8"
                      iconSlot={<LinearIcon className="size-10 text-icon3" />}
                      titleSlot="Connect Linear"
                      descriptionSlot="Give your Factory the issue context and priorities behind your code."
                      actionSlot={(
                        <div className="flex flex-wrap items-center justify-center gap-2">
                          {linearStatus.data?.reason !== 'missing_config' && linearStatus.data?.reason !== 'organization_required' && (
                            <Button variant="primary" onClick={() => {
                              persistBeforeRedirect('project-management');
                              connectLinear(baseUrl);
                            }}>
                              <LinearIcon />
                              {linearStatus.data?.reason === 'not_connected' ? 'Connect Linear' : 'Reconnect Linear'}
                            </Button>
                          )}
                          <Button variant="ghost" disabled={finishing} onClick={() => void finish()}>
                            {finishing && <Spinner size="sm" aria-label="Finishing setup" />}
                            Skip for now
                          </Button>
                        </div>
                      )}
                    />
                  )}
                  {completionError && <p role="alert" className="mt-4 text-ui-sm text-notice-destructive-fg">{completionError}</p>}
                </section>
              </>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}

function GithubConnection({ status, isConnecting, onConnect }: {
  status: ReturnType<typeof useGithubStatusQuery>['data'];
  isConnecting: boolean;
  onConnect: () => void;
}) {
  const unavailable = status?.reason === 'missing_config' || status?.reason === 'organization_required';
  const message = status?.reason === 'missing_config'
    ? 'GitHub is not configured for this deployment.'
    : status?.reason === 'organization_required'
      ? 'Join an organization to connect GitHub repositories.'
      : status?.reason === 'auth_required'
        ? 'Sign in again to connect GitHub.'
        : 'Connect GitHub to choose a repository.';

  return (
    <EmptyState
      className="py-8"
      iconSlot={<GithubIcon className="size-10 text-icon3" />}
      titleSlot="Connect GitHub"
      descriptionSlot={message}
      actionSlot={!unavailable ? (
        <Button variant="primary" disabled={isConnecting} onClick={onConnect}>
          {isConnecting ? <Spinner size="sm" aria-label="Connecting to GitHub" /> : <GithubIcon />}
          Connect GitHub
        </Button>
      ) : undefined}
    />
  );
}

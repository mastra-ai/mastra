import { Button } from '@mastra/playground-ui/components/Button';
import { EmptyState } from '@mastra/playground-ui/components/EmptyState';
import { Spinner } from '@mastra/playground-ui/components/Spinner';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { useState } from 'react';

import { useGithubReposQuery } from '../../../../../shared/hooks/useGithubRepos';
import { useGithubStatusQuery } from '../../../../../shared/hooks/useGithubStatus';
import type { GithubRepo, GithubStatus } from '../services/github';
import { GithubIcon, SearchIcon } from '../../../ui/icons';
import { SkeletonRows } from '../../../ui/SkeletonRows';

export interface VcsFactoryStepProps {
  connectingRepositoryId: number | null;
  githubRedirecting: boolean;
  mutationPending: boolean;
  mutationError: string | null;
  onConnect: () => void;
  onManageConnection: () => void;
  onSelectRepository: (repository: GithubRepo) => void;
}

export function VcsFactoryStep({
  connectingRepositoryId,
  githubRedirecting,
  mutationPending,
  mutationError,
  onConnect,
  onManageConnection,
  onSelectRepository,
}: VcsFactoryStepProps) {
  const [query, setQuery] = useState('');
  const githubStatus = useGithubStatusQuery();
  const connected = githubStatus.data?.connected === true;
  const repos = useGithubReposQuery(query || undefined, connected);

  return (
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
        ) : !connected ? (
          <GithubConnection status={githubStatus.data} isConnecting={githubRedirecting} onConnect={onConnect} />
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
                      disabled={mutationPending}
                      onClick={() => onSelectRepository(repo)}
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
            <Button variant="outline" size="sm" className="self-start" onClick={onManageConnection}>Manage GitHub connection</Button>
          </div>
        )}
      </section>
    </>
  );
}

function GithubConnection({ status, isConnecting, onConnect }: {
  status: GithubStatus | undefined;
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

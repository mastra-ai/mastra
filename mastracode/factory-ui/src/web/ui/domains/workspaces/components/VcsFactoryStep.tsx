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
    <section
      aria-label="GitHub repository"
      className="border-border1 bg-surface2/80 mx-auto max-w-2xl rounded-2xl border p-5 text-left"
    >
      {githubStatus.isPending ? (
        <SkeletonRows label="Loading GitHub status" rows={3} rowClassName="h-12 w-full rounded-xl" />
      ) : !connected ? (
        <GithubConnection status={githubStatus.data} isConnecting={githubRedirecting} onConnect={onConnect} />
      ) : (
        <div className="flex flex-col gap-4">
          <div className="border-border1 bg-surface1 flex items-center gap-2 rounded-lg border px-3 py-2">
            <SearchIcon size={15} className="text-icon2" />
            <input
              aria-label="Search repositories"
              className="text-ui-sm text-icon6 placeholder:text-icon2 min-w-0 flex-1 bg-transparent focus:outline-none"
              placeholder="Filter repositories…"
              value={query}
              onChange={event => setQuery(event.target.value)}
            />
          </div>
          {mutationError && (
            <p role="alert" className="text-ui-sm text-notice-destructive-fg m-0">
              {mutationError}
            </p>
          )}
          {repos.isError && (
            <p role="alert" className="text-ui-sm text-notice-destructive-fg m-0">
              {repos.error.message}
            </p>
          )}
          {repos.isPending ? (
            <SkeletonRows label="Loading repositories" rows={3} rowClassName="h-12 w-full rounded-xl" />
          ) : repos.data?.length ? (
            <div className="flex max-h-80 flex-col gap-2 overflow-y-auto">
              {repos.data.map(repo => {
                const isConnecting = connectingRepositoryId === repo.id;
                return (
                  <button
                    key={repo.id}
                    className="group bg-surface3 hover:bg-surface4 flex cursor-pointer items-center gap-3 rounded-xl px-4 py-3 text-left disabled:cursor-not-allowed disabled:opacity-60"
                    disabled={mutationPending}
                    onClick={() => onSelectRepository(repo)}
                  >
                    <GithubIcon className="text-icon3 shrink-0" />
                    <span className="min-w-0 flex-1">
                      <span className="text-ui-sm text-icon6 block truncate font-medium">{repo.fullName}</span>
                      <span className="text-ui-xs text-icon3 block">
                        {repo.private ? 'Private' : 'Public'} · {repo.defaultBranch}
                      </span>
                    </span>
                    {isConnecting ? (
                      <Spinner size="sm" aria-label={`Connecting ${repo.fullName}`} className="text-accent1 shrink-0" />
                    ) : (
                      <span className="text-ui-xs text-neutral1 opacity-0 transition-opacity group-hover:opacity-100">
                        Select
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          ) : (
            <Txt as="p" variant="ui-sm" className="text-icon3 m-0">
              No repositories found.
            </Txt>
          )}
          <Button variant="outline" size="sm" className="self-start" onClick={onManageConnection}>
            Manage GitHub connection
          </Button>
        </div>
      )}
    </section>
  );
}

function GithubConnection({
  status,
  isConnecting,
  onConnect,
}: {
  status: GithubStatus | undefined;
  isConnecting: boolean;
  onConnect: () => void;
}) {
  const unavailable = status?.reason === 'missing_config' || status?.reason === 'organization_required';
  const message =
    status?.reason === 'missing_config'
      ? 'GitHub is not configured for this deployment.'
      : status?.reason === 'organization_required'
        ? 'Join an organization to connect GitHub repositories.'
        : status?.reason === 'auth_required'
          ? 'Sign in again to connect GitHub.'
          : 'Connect GitHub to choose a repository.';
  // Non-secret env var names reported by the server; a "sync" button can't
  // exist without server-side GitHub App credentials, so the only honest
  // affordance here is telling the operator exactly what to configure.
  const missingEnvVars = status?.reason === 'missing_config' ? (status.diagnostics?.missingGithubAppEnvVars ?? []) : [];

  return (
    <EmptyState
      className="py-8"
      iconSlot={<GithubIcon className="text-icon3 size-10" />}
      titleSlot="Connect GitHub"
      descriptionSlot={message}
      actionSlot={
        !unavailable ? (
          <Button variant="primary" disabled={isConnecting} onClick={onConnect}>
            {isConnecting ? <Spinner size="sm" aria-label="Connecting to GitHub" /> : <GithubIcon />}
            Connect GitHub
          </Button>
        ) : missingEnvVars.length > 0 ? (
          <div className="flex max-w-md flex-col items-center gap-2">
            <Txt as="p" variant="ui-sm" className="text-icon3 m-0 text-center">
              To enable it, set the GitHub App environment variables on the server and restart:
            </Txt>
            <ul className="m-0 flex list-none flex-wrap justify-center gap-1.5 p-0">
              {missingEnvVars.map(name => (
                <li key={name}>
                  <code className="bg-surface4 text-ui-xs text-icon5 rounded px-1.5 py-0.5 font-mono">{name}</code>
                </li>
              ))}
            </ul>
          </div>
        ) : undefined
      }
    />
  );
}

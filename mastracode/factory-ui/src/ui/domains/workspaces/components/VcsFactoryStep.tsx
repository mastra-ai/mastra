import { Button } from '@mastra/playground-ui/components/Button';
import { EmptyState } from '@mastra/playground-ui/components/EmptyState';
import { Spinner } from '@mastra/playground-ui/components/Spinner';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { GithubIcon } from '@mastra/playground-ui/icons/GithubIcon';
import { useDebouncedValue } from '@mastra/playground-ui/hooks/use-debounced-value';
import { useState, type ReactNode } from 'react';

import { useGitLabProjectsQuery, useGitLabStatusQuery } from '../../../../hooks/useGitLabData';
import { useGithubReposQuery } from '../../../../hooks/useGithubRepos';
import { useGithubStatusQuery } from '../../../../hooks/useGithubStatus';
import { gitLabProjectRepository } from '../../factory/services/gitlab';
import type { SourceControlRepository } from '../services/github';
import { ProviderConnectControl } from '../../settings/components/PlatformProviderConnections';
import { GitLabIcon, SearchIcon } from '../../../ui/icons';
import { SkeletonRows } from '../../../ui/SkeletonRows';

export interface VcsFactoryStepProps {
  connectingRepositoryId: number | string | null;
  githubRedirecting: boolean;
  mutationPending: boolean;
  mutationError: string | null;
  onConnect: () => void;
  onManageConnection: () => void;
  onSelectRepository: (repository: SourceControlRepository) => void;
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
  const [selectedProvider, setSelectedProvider] = useState<'github' | 'gitlab' | null>(null);
  const [query, setQuery] = useState('');
  const debouncedQuery = useDebouncedValue(query, 750);
  const githubStatus = useGithubStatusQuery();
  const connected = githubStatus.data?.connected === true;
  const repos = useGithubReposQuery(debouncedQuery || undefined, connected && selectedProvider === 'github');
  const gitlabStatus = useGitLabStatusQuery();
  const gitlabConfigured = Boolean(gitlabStatus.data?.enabled && gitlabStatus.data.configured);
  const gitlabProjects = useGitLabProjectsQuery(gitlabConfigured && selectedProvider === 'gitlab');
  const gitlabRepos = (gitlabProjects.data ?? []).flatMap(project => {
    const repository = gitLabProjectRepository(project);
    return repository ? [repository] : [];
  });

  return (
    <section
      aria-label="Source control repository"
      className="border-border bg-background/80 mx-auto max-w-2xl rounded-2xl border p-5 text-left"
    >
      {githubStatus.isPending || gitlabStatus.isPending ? (
        <SkeletonRows label="Loading source control status" rows={2} rowClassName="h-32 w-full rounded-xl" />
      ) : selectedProvider === null ? (
        <ProviderChoice
          githubRedirecting={githubRedirecting}
          githubUnavailable={
            githubStatus.data?.reason === 'organization_required' || githubStatus.data?.reason === 'missing_config'
          }
          gitlabConnected={gitlabConfigured}
          // Personal GitLab accounts see `enabled: true` from the status endpoint but the
          // connect-session request answers 403 with `organization_required`, so gate the
          // tile here to keep it from starting a doomed Nango session.
          gitlabUnavailable={!gitlabStatus.data?.enabled || gitlabStatus.data.reason === 'organization_required'}
          gitlabUnavailableReason={
            !gitlabStatus.data?.enabled
              ? 'missing_config'
              : gitlabStatus.data.reason === 'organization_required'
                ? 'organization_required'
                : undefined
          }
          onChooseGithub={() => {
            if (connected) setSelectedProvider('github');
            else onConnect();
          }}
          onGitlabConnected={() => {
            void gitlabStatus.refetch();
            void gitlabProjects.refetch();
          }}
          onChooseGitlab={() => {
            if (gitlabConfigured) setSelectedProvider('gitlab');
          }}
        />
      ) : (
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between gap-3">
            <ProviderHeading>
              {selectedProvider === 'github' ? 'GitHub repositories' : 'GitLab repositories'}
            </ProviderHeading>
            <button
              type="button"
              className="text-meta text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
              onClick={() => {
                setQuery('');
                setSelectedProvider(null);
              }}
            >
              Choose another provider
            </button>
          </div>
          <div className="border-border bg-sidebar flex items-center gap-2 rounded-lg border px-3 py-2">
            <SearchIcon size={15} className="text-placeholder" />
            <input
              aria-label="Search repositories"
              className="text-caption text-foreground placeholder:text-placeholder min-w-0 flex-1 bg-transparent focus:outline-none"
              placeholder="Filter repositories…"
              value={query}
              onChange={event => setQuery(event.target.value)}
            />
          </div>
          {mutationError && <RepositoryError message={mutationError} />}
          {selectedProvider === 'github' ? (
            <>
              {repos.isError && <RepositoryError message={repos.error.message} />}
              <RepositoryRows
                repositories={repos.data ?? []}
                query=""
                pending={repos.isPending}
                mutationPending={mutationPending}
                connectingRepositoryId={connectingRepositoryId}
                provider="github"
                onSelectRepository={onSelectRepository}
              />
              <Button size="sm" className="self-start" onClick={onManageConnection}>
                Manage GitHub connection
              </Button>
            </>
          ) : (
            <>
              {gitlabProjects.isError && <RepositoryError message={gitlabProjects.error.message} />}
              <RepositoryRows
                repositories={gitlabRepos}
                query={debouncedQuery}
                pending={gitlabProjects.isPending}
                mutationPending={mutationPending}
                connectingRepositoryId={connectingRepositoryId}
                provider="gitlab"
                onSelectRepository={onSelectRepository}
              />
            </>
          )}
        </div>
      )}
    </section>
  );
}

function ProviderChoice({
  githubRedirecting,
  githubUnavailable,
  gitlabConnected,
  gitlabUnavailable,
  gitlabUnavailableReason,
  onChooseGithub,
  onChooseGitlab,
  onGitlabConnected,
}: {
  githubRedirecting: boolean;
  githubUnavailable: boolean;
  gitlabConnected: boolean;
  gitlabUnavailable: boolean;
  gitlabUnavailableReason?: 'missing_config' | 'organization_required';
  onChooseGithub: () => void;
  onChooseGitlab: () => void;
  onGitlabConnected: () => void;
}) {
  const gitlabMessage = gitlabUnavailable
    ? gitlabUnavailableReason === 'organization_required'
      ? 'Join an organization to connect GitLab repositories.'
      : 'GitLab is not available for this deployment.'
    : 'Connect GitLab to choose a repository.';
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_1px_minmax(0,1fr)] items-stretch gap-5">
      <ProviderConnection
        provider="GitHub"
        message={
          githubUnavailable ? 'GitHub is not available for this deployment.' : 'Connect GitHub to choose a repository.'
        }
        icon={<GithubIcon />}
        actionSlot={
          <Button variant="primary" disabled={githubRedirecting || githubUnavailable} onClick={onChooseGithub}>
            {githubRedirecting ? (
              <Spinner size="sm" aria-label="Connecting to GitHub" />
            ) : (
              <GithubIcon className="size-4" />
            )}
            Connect GitHub
          </Button>
        }
        title={githubUnavailable ? 'GitHub unavailable' : 'Connect GitHub'}
      />
      <div role="separator" aria-orientation="vertical" className="bg-border h-full min-h-36 w-px" />
      <ProviderConnection
        provider="GitLab"
        message={gitlabMessage}
        icon={<GitLabIcon />}
        actionSlot={
          gitlabUnavailable ? (
            <Button variant="primary" disabled onClick={() => {}}>
              <GitLabIcon className="size-4" />
              Connect GitLab
            </Button>
          ) : gitlabConnected ? (
            <Button variant="primary" onClick={onChooseGitlab}>
              <GitLabIcon className="size-4" />
              Choose GitLab repository
            </Button>
          ) : (
            <ProviderConnectControl
              provider="gitlab"
              label="Connect GitLab"
              variant="primary"
              size="md"
              icon={<GitLabIcon className="size-4" />}
              onCompleted={onGitlabConnected}
            />
          )
        }
        title={gitlabUnavailable ? 'GitLab unavailable' : 'Connect GitLab'}
      />
    </div>
  );
}

function ProviderConnection({
  provider: _provider,
  message,
  icon,
  title,
  actionSlot,
}: {
  provider: 'GitHub' | 'GitLab';
  message: string;
  icon: ReactNode;
  title: string;
  actionSlot: ReactNode;
}) {
  return (
    <EmptyState
      className="min-w-0 py-8"
      iconSlot={icon}
      titleSlot={title}
      descriptionSlot={message}
      actionSlot={actionSlot}
    />
  );
}

function ProviderHeading({ children }: { children: string }) {
  return (
    <Txt as="h2" variant="label" className="text-foreground m-0">
      {children}
    </Txt>
  );
}

function RepositoryError({ message }: { message: string }) {
  return (
    <p role="alert" className="text-caption text-notice-destructive-fg m-0">
      {message}
    </p>
  );
}

function RepositoryRows({
  repositories,
  query,
  pending,
  mutationPending,
  connectingRepositoryId,
  provider,
  onSelectRepository,
}: {
  repositories: SourceControlRepository[];
  query: string;
  pending: boolean;
  mutationPending: boolean;
  connectingRepositoryId: number | string | null;
  provider: 'github' | 'gitlab';
  onSelectRepository: (repository: SourceControlRepository) => void;
}) {
  if (pending)
    return <SkeletonRows label={`Loading ${provider} repositories`} rows={3} rowClassName="h-12 w-full rounded-xl" />;
  const normalizedQuery = query.trim().toLowerCase();
  const visible = normalizedQuery
    ? repositories.filter(repository => repository.fullName.toLowerCase().includes(normalizedQuery))
    : repositories;
  if (visible.length === 0) {
    return (
      <Txt as="p" variant="caption" className="text-muted-foreground m-0">
        No {provider === 'gitlab' ? 'GitLab' : 'GitHub'} repositories found.
      </Txt>
    );
  }
  return (
    <div className="flex max-h-80 flex-col gap-2 overflow-y-auto">
      {visible.map(repo => {
        const isConnecting = connectingRepositoryId === repo.id;
        return (
          <button
            key={repo.id}
            className="group bg-card hover:bg-fill flex cursor-pointer items-center gap-3 rounded-xl px-4 py-3 text-left disabled:cursor-not-allowed disabled:opacity-60"
            disabled={mutationPending}
            onClick={() => onSelectRepository(repo)}
          >
            {provider === 'gitlab' ? (
              <GitLabIcon className="text-muted-foreground size-4 shrink-0" />
            ) : (
              <GithubIcon className="text-muted-foreground size-4 shrink-0" />
            )}
            <span className="min-w-0 flex-1">
              <span className="text-column text-foreground block truncate">{repo.fullName}</span>
              <span className="text-meta text-muted-foreground block">
                {provider === 'gitlab' ? 'GitLab' : repo.private ? 'Private' : 'Public'} · {repo.defaultBranch}
              </span>
            </span>
            {isConnecting ? (
              <Spinner size="sm" aria-label={`Connecting ${repo.fullName}`} className="text-accent1 shrink-0" />
            ) : (
              <span className="text-meta text-placeholder opacity-0 transition-opacity group-hover:opacity-100">
                Select
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

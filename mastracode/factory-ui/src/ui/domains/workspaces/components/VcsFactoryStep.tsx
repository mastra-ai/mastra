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
import { gitLabProjectRepository, manageGitLabConnection } from '../../factory/services/gitlab';
import type { GithubStatus, SourceControlRepository } from '../services/github';
import { SearchIcon } from '../../../ui/icons';
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

const GITHUB_ENV_VAR_DISPLAY_ORDER = [
  'GITHUB_APP_ID',
  'GITHUB_APP_PRIVATE_KEY',
  'GITHUB_APP_CLIENT_ID',
  'GITHUB_APP_SLUG',
  'GITHUB_APP_CLIENT_SECRET',
];

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
      className="border-border1 bg-surface2/80 mx-auto max-w-2xl rounded-2xl border p-5 text-left"
    >
      {githubStatus.isPending || gitlabStatus.isPending ? (
        <SkeletonRows label="Loading source control status" rows={2} rowClassName="h-32 w-full rounded-xl" />
      ) : selectedProvider === null ? (
        <ProviderChoice
          githubStatus={githubStatus.data}
          gitlabConfigured={gitlabConfigured}
          gitlabReason={gitlabStatus.data?.reason}
          gitlabMode={gitlabStatus.data?.mode}
          githubRedirecting={githubRedirecting}
          onChooseGithub={() => {
            if (connected) setSelectedProvider('github');
            else onConnect();
          }}
          onChooseGitlab={() => {
            if (gitlabConfigured) setSelectedProvider('gitlab');
            else if (gitlabStatus.data?.mode === 'platform') manageGitLabConnection();
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
              className="text-ui-xs text-icon3 hover:text-icon6 cursor-pointer transition-colors"
              onClick={() => {
                setQuery('');
                setSelectedProvider(null);
              }}
            >
              Choose another provider
            </button>
          </div>
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
              <Button variant="outline" size="sm" className="self-start" onClick={onManageConnection}>
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
  githubStatus,
  gitlabConfigured,
  gitlabReason,
  gitlabMode,
  githubRedirecting,
  onChooseGithub,
  onChooseGitlab,
}: {
  githubStatus: GithubStatus | undefined;
  gitlabConfigured: boolean;
  gitlabReason: 'missing_config' | 'auth_required' | 'organization_required' | 'not_connected' | 'ready' | undefined;
  gitlabMode: 'direct' | 'platform' | undefined;
  githubRedirecting: boolean;
  onChooseGithub: () => void;
  onChooseGitlab: () => void;
}) {
  const githubUnavailable =
    githubStatus?.reason === 'missing_config' || githubStatus?.reason === 'organization_required';
  const githubMessage =
    githubStatus?.reason === 'missing_config'
      ? 'GitHub is not configured for this deployment.'
      : githubStatus?.reason === 'organization_required'
        ? 'Join an organization to connect GitHub repositories.'
        : githubStatus?.reason === 'auth_required'
          ? 'Sign in again to connect GitHub.'
          : 'Connect GitHub to choose a repository.';
  const githubMissingEnvVars =
    githubStatus?.reason === 'missing_config'
      ? [...(githubStatus.diagnostics?.missingGithubAppEnvVars ?? [])].sort(
          (left, right) => GITHUB_ENV_VAR_DISPLAY_ORDER.indexOf(left) - GITHUB_ENV_VAR_DISPLAY_ORDER.indexOf(right),
        )
      : [];
  const gitlabPlatformManaged = gitlabMode === 'platform';
  const gitlabUnavailable = !gitlabConfigured && !gitlabPlatformManaged;
  const gitlabMessage =
    gitlabReason === 'organization_required'
      ? 'Join an organization to connect GitLab repositories.'
      : gitlabReason === 'auth_required'
        ? 'Sign in again to connect GitLab.'
        : !gitlabConfigured && gitlabPlatformManaged
          ? 'Connect GitLab through Mastra Platform to choose a repository.'
          : gitlabUnavailable
            ? 'GitLab is not configured for this deployment.'
            : 'Connect GitLab to choose a repository.';
  const gitlabMissingEnvVars =
    gitlabUnavailable && gitlabReason !== 'organization_required'
      ? ['GITLAB_ACCESS_TOKEN', 'GITLAB_ACCESS_TOKEN_TYPE']
      : [];

  return (
    <div className="grid grid-cols-[minmax(0,1fr)_1px_minmax(0,1fr)] items-stretch gap-5">
      <ProviderConnection
        provider="GitHub"
        message={githubMessage}
        icon={<GithubIcon className="size-10" />}
        buttonIcon={<GithubIcon className="size-4" />}
        unavailable={githubUnavailable}
        isConnecting={githubRedirecting}
        missingEnvVars={githubMissingEnvVars}
        setupMessage="To enable it, set the GitHub App environment variables on the server and restart:"
        onConnect={onChooseGithub}
      />
      <div role="separator" aria-orientation="vertical" className="bg-border1 h-full min-h-36 w-px" />
      <ProviderConnection
        provider="GitLab"
        message={gitlabMessage}
        icon={<GitLabIcon className="size-10" />}
        buttonIcon={<GitLabIcon className="size-4" />}
        unavailable={gitlabUnavailable}
        missingEnvVars={gitlabMissingEnvVars}
        setupMessage="To enable it, set the GitLab environment variables on the server and restart:"
        onConnect={onChooseGitlab}
      />
    </div>
  );
}

function ProviderConnection({
  provider,
  message,
  icon,
  buttonIcon,
  unavailable,
  isConnecting = false,
  missingEnvVars,
  setupMessage,
  onConnect,
}: {
  provider: 'GitHub' | 'GitLab';
  message: string;
  icon: ReactNode;
  buttonIcon: ReactNode;
  unavailable: boolean;
  isConnecting?: boolean;
  missingEnvVars: string[];
  setupMessage: string;
  onConnect: () => void;
}) {
  return (
    <EmptyState
      className="min-w-0 py-8"
      iconSlot={<span className="text-icon3">{icon}</span>}
      titleSlot={`Connect ${provider}`}
      descriptionSlot={message}
      actionSlot={
        !unavailable ? (
          <Button variant="primary" disabled={isConnecting} onClick={onConnect}>
            {isConnecting ? <Spinner size="sm" aria-label={`Connecting to ${provider}`} /> : buttonIcon}
            Connect {provider}
          </Button>
        ) : missingEnvVars.length > 0 ? (
          <div className="flex max-w-md min-w-0 flex-col items-center gap-2">
            <Txt as="p" variant="ui-sm" className="text-icon3 m-0 text-center">
              {setupMessage}
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

function GitLabIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className} fill="currentColor">
      <path d="M23.955 13.587 20.613 3.307a.54.54 0 0 0-1.025 0l-2.257 6.946H6.67L4.413 3.307a.54.54 0 0 0-1.025 0L.045 13.587a1.08 1.08 0 0 0 .393 1.207L12 23.196l11.562-8.402a1.08 1.08 0 0 0 .393-1.207Z" />
    </svg>
  );
}

function ProviderHeading({ children }: { children: string }) {
  return (
    <Txt as="h2" variant="ui-sm" className="text-icon5 m-0 font-medium">
      {children}
    </Txt>
  );
}

function RepositoryError({ message }: { message: string }) {
  return (
    <p role="alert" className="text-ui-sm text-notice-destructive-fg m-0">
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
      <Txt as="p" variant="ui-sm" className="text-icon3 m-0">
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
            className="group bg-surface3 hover:bg-surface4 flex cursor-pointer items-center gap-3 rounded-xl px-4 py-3 text-left disabled:cursor-not-allowed disabled:opacity-60"
            disabled={mutationPending}
            onClick={() => onSelectRepository(repo)}
          >
            {provider === 'gitlab' ? (
              <GitLabIcon className="text-icon3 size-4 shrink-0" />
            ) : (
              <GithubIcon className="text-icon3 size-4 shrink-0" />
            )}
            <span className="min-w-0 flex-1">
              <span className="text-ui-sm text-icon6 block truncate font-medium">{repo.fullName}</span>
              <span className="text-ui-xs text-icon3 block">
                {provider === 'gitlab' ? 'GitLab' : repo.private ? 'Private' : 'Public'} · {repo.defaultBranch}
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
  );
}

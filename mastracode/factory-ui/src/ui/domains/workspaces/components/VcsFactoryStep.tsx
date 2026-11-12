import { Metadata } from '@mastra/playground-ui/components/Metadata';
import { Button } from '@mastra/playground-ui/components/Button';
import { RadioGroup, RadioGroupItem } from '@mastra/playground-ui/components/RadioGroup';
import { SegmentedControl, SegmentedControlItem } from '@mastra/playground-ui/components/SegmentedControl';
import { cn } from '@mastra/playground-ui/utils/cn';
import { RefreshCw } from 'lucide-react';
import { SearchInput } from '@mastra/playground-ui/components/SearchInput';
import { Spinner } from '@mastra/playground-ui/components/Spinner';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { GithubIcon } from '@mastra/playground-ui/icons/GithubIcon';
import { useDebouncedValue } from '@mastra/playground-ui/hooks/use-debounced-value';
import { useState } from 'react';
import { Link } from 'react-router';

import { useGitLabProjectsQuery, useGitLabStatusQuery } from '../../../../hooks/useGitLabData';
import { useGithubReposQuery, useRefreshGithubReposMutation } from '../../../../hooks/useGithubRepos';
import { useGithubStatusQuery } from '../../../../hooks/useGithubStatus';
import { gitLabProjectRepository } from '../../factory/services/gitlab';
import { isGitLabRepository } from '../services/github';
import type { GithubStatusReason, SourceControlRepository } from '../services/github';
import { ProviderConnectControl } from '../../settings/components/PlatformProviderConnections';
import { GitLabIcon } from '../../../ui/icons';
import { SkeletonRows } from '../../../ui/SkeletonRows';
import type { GitHubAppCallbackResult } from './GitHubAppCallbackHandler';
import { OnboardingConnectionRow } from './onboarding/OnboardingConnectionRow';
import { OnboardingGithubNotice } from './onboarding/OnboardingGithubNotice';
import { OnboardingInset } from './onboarding/OnboardingInset';
import { OnboardingSearchInset } from './onboarding/OnboardingSearchInset';
import { OnboardingStepCard } from './onboarding/OnboardingStepCard';

type SourceControlHost = 'github' | 'gitlab';

/**
 * Why a host can't be connected: `unavailable` means its status couldn't be read, so Retry may help;
 * `auth_required` means the Factory session expired, so only signing in again helps.
 */
type HostUnavailableReason = 'missing_config' | 'organization_required' | 'unavailable' | 'auth_required';

const HOST_NAMES = { github: 'GitHub', gitlab: 'GitLab' } as const;

function hostUnavailableDescription(host: SourceControlHost, reason: HostUnavailableReason): string {
  if (reason === 'organization_required') return `Join an organization to connect ${HOST_NAMES[host]}.`;
  if (reason === 'unavailable') return `Couldn't load ${HOST_NAMES[host]} status.`;
  if (reason === 'auth_required') return `Your session expired. Sign in again to connect ${HOST_NAMES[host]}.`;
  return 'Unavailable for this deployment.';
}

function gitLabUnavailableReason(status?: { enabled: boolean; reason?: string }): HostUnavailableReason | undefined {
  if (status?.reason === 'unavailable') return 'unavailable';
  // An enabled GitLab with `auth_required` needs its own reauthorization, which Connect GitLab does.
  if (!status?.enabled && status?.reason === 'auth_required') return 'auth_required';
  if (!status?.enabled) return 'missing_config';
  if (status.reason === 'organization_required') return 'organization_required';
  return undefined;
}

function githubUnavailableReason(reason?: GithubStatusReason): HostUnavailableReason | undefined {
  if (
    reason === 'unavailable' ||
    reason === 'organization_required' ||
    reason === 'missing_config' ||
    reason === 'auth_required'
  )
    return reason;
  return undefined;
}

/** The way out of a host problem that Connect can't fix: Retry a failed status, or sign in again. */
function HostRecoveryAction({
  host,
  reason,
  onRetry,
}: {
  host: SourceControlHost;
  reason?: HostUnavailableReason;
  onRetry: () => void;
}) {
  if (reason === 'unavailable') {
    return (
      <Button variant="ghost" aria-label={`Retry ${HOST_NAMES[host]}`} onClick={onRetry}>
        Retry
      </Button>
    );
  }
  if (reason === 'auth_required') {
    return (
      <Button variant="default" render={<Link to="/signin" />}>
        Sign in
      </Button>
    );
  }
  return null;
}

function needsRecovery(reason?: HostUnavailableReason): boolean {
  return reason === 'unavailable' || reason === 'auth_required';
}

function repositoryHost(repository: SourceControlRepository): SourceControlHost {
  return isGitLabRepository(repository) ? 'gitlab' : 'github';
}

export interface VcsFactoryStepProps {
  initialRepository?: SourceControlRepository;
  githubRedirecting: boolean;
  githubCallback?: GitHubAppCallbackResult;
  onDismissGithubCallback: () => void;
  onConnect: () => void;
  onManageConnection: () => void;
  onSelectRepository: (repository: SourceControlRepository) => void;
  onPreviewRepository?: (repository: SourceControlRepository | undefined) => void;
}

export function VcsFactoryStep({
  initialRepository,
  githubRedirecting,
  githubCallback,
  onDismissGithubCallback,
  onConnect,
  onManageConnection,
  onSelectRepository,
  onPreviewRepository,
}: VcsFactoryStepProps) {
  // Undefined follows the connection status, so an OAuth return lands on the connected host.
  const [pinnedHost, setPinnedHost] = useState<SourceControlHost | undefined>(
    initialRepository && repositoryHost(initialRepository),
  );
  const [chosenRepository, setChosenRepository] = useState(initialRepository);
  const [query, setQuery] = useState('');
  const debouncedQuery = useDebouncedValue(query, 750);
  const githubStatus = useGithubStatusQuery();
  const connected = githubStatus.data?.connected === true;
  const gitlabStatus = useGitLabStatusQuery();
  const gitlabConfigured = Boolean(gitlabStatus.data?.enabled && gitlabStatus.data.configured);
  const anyHostReady = connected || gitlabConfigured;
  // A GitHub App result is about GitHub, so it opens there even when GitLab is the ready host.
  const defaultHost: SourceControlHost = connected || githubCallback ? 'github' : 'gitlab';
  const host = pinnedHost ?? defaultHost;
  const hostReady = host === 'github' ? connected : gitlabConfigured;
  const repositoryForProvider =
    chosenRepository && repositoryHost(chosenRepository) === host ? chosenRepository : undefined;
  const repositorySearch = debouncedQuery || undefined;
  const repos = useGithubReposQuery(repositorySearch, connected && host === 'github');
  const refreshRepos = useRefreshGithubReposMutation(repositorySearch);
  const gitlabProjects = useGitLabProjectsQuery(gitlabConfigured && host === 'gitlab');
  const gitlabRepos = (gitlabProjects.data ?? []).flatMap(project => {
    const repository = gitLabProjectRepository(project);
    return repository ? [repository] : [];
  });
  const repositoryQuery = host === 'gitlab' ? gitlabProjects : repos;
  // A failed first load has no list; its empty-list text would wrongly blame repository access.
  const repositoriesFailed = repositoryQuery.isError && repositoryQuery.data === undefined;
  const statusPending = githubStatus.isPending || gitlabStatus.isPending;
  const githubUnavailable = githubUnavailableReason(githubStatus.data?.reason);
  const chooseRepository = (repository: SourceControlRepository) => {
    setChosenRepository(repository);
    onPreviewRepository?.(repository);
  };
  const showRepositories = !statusPending && hostReady;
  // With no host ready both rows show; otherwise only the selected host's row, so it can be connected.
  const showGithubRow = !statusPending && !hostReady && (!anyHostReady || host === 'github');
  const showGitlabRow = !statusPending && !hostReady && (!anyHostReady || host === 'gitlab');
  const refreshGithub = () => {
    // The repository refresh re-syncs status itself; refetching here too cancels and repeats it.
    if (connected) {
      const before = repos.data?.length ?? 0;
      refreshRepos.mutate(undefined, {
        // New repositories mean the access a request or a Platform fix waited on has landed.
        onSuccess: next => {
          if (next.length > before) onDismissGithubCallback();
        },
      });
      return;
    }
    // A fix made elsewhere (an approval, Platform's Refresh accounts) shows up here; its notice is then moot.
    void githubStatus.refetch().then(result => {
      if (result.data?.connected) onDismissGithubCallback();
    });
  };

  return (
    <OnboardingStepCard
      section="vcs"
      headerEnd={
        !statusPending &&
        anyHostReady && (
          <SegmentedControl
            aria-label="Source control host"
            value={host}
            onValueChange={next => {
              setPinnedHost(next);
              setQuery('');
              setChosenRepository(undefined);
              onPreviewRepository?.(undefined);
            }}
            className="max-[899px]:w-full"
          >
            <SegmentedControlItem value="github" className="max-[899px]:min-w-0 max-[899px]:flex-1">
              GitHub
            </SegmentedControlItem>
            <SegmentedControlItem value="gitlab" className="max-[899px]:min-w-0 max-[899px]:flex-1">
              GitLab
            </SegmentedControlItem>
          </SegmentedControl>
        )
      }
      notice={
        host === 'github' && (
          <OnboardingGithubNotice
            callback={githubCallback}
            connected={connected}
            statusSettled={githubStatus.isSuccess && !githubStatus.isFetching}
            refreshing={githubStatus.isFetching || refreshRepos.isPending}
            onConnect={onConnect}
            onRefresh={refreshGithub}
            onDismiss={onDismissGithubCallback}
          />
        )
      }
      actions={
        showRepositories &&
        host === 'github' && (
          <>
            <Button variant="ghost" size="sm" onClick={onManageConnection}>
              Manage access
            </Button>
            <Button
              variant="ghost"
              size="sm"
              aria-label="Refresh GitHub repositories"
              disabled={refreshRepos.isPending}
              onClick={refreshGithub}
            >
              <RefreshCw className={cn('size-3.5', refreshRepos.isPending && 'animate-spin')} aria-hidden="true" />
              Refresh
            </Button>
          </>
        )
      }
      primary={
        showRepositories && (
          <Button
            variant="primary"
            disabled={!repositoryForProvider}
            onClick={() => {
              if (repositoryForProvider) onSelectRepository(repositoryForProvider);
            }}
          >
            Continue
          </Button>
        )
      }
    >
      {statusPending && (
        <OnboardingInset>
          <SkeletonRows label="Loading source control status" rows={2} rowClassName="h-15 w-full" />
        </OnboardingInset>
      )}
      {(showGithubRow || showGitlabRow) && (
        <OnboardingInset>
          {showGithubRow && (
            <GitHubHostRow
              redirecting={githubRedirecting}
              unavailableReason={githubUnavailable}
              onConnect={onConnect}
              onRetry={() => void githubStatus.refetch()}
            />
          )}
          {showGitlabRow && (
            <GitLabHostRow
              unavailableReason={gitLabUnavailableReason(gitlabStatus.data)}
              onConnected={() => {
                setPinnedHost('gitlab');
                void gitlabStatus.refetch();
              }}
              onRetry={() => void gitlabStatus.refetch()}
            />
          )}
        </OnboardingInset>
      )}
      {showRepositories && (
        <OnboardingSearchInset
          search={
            <SearchInput
              label="Search repositories"
              placeholder="Find a repository"
              value={query}
              onValueChange={value => {
                setQuery(value);
                setChosenRepository(undefined);
                onPreviewRepository?.(undefined);
              }}
            />
          }
        >
          {repositoryQuery.isError && (
            <RepositoryError message={repositoryQuery.error.message} onRetry={() => void repositoryQuery.refetch()} />
          )}
          {host === 'github' && refreshRepos.isError && (
            <RepositoryError message={refreshRepos.error.message} onRetry={refreshGithub} />
          )}
          {!repositoriesFailed && (
            <div
              onMouseLeave={() => onPreviewRepository?.(repositoryForProvider)}
              onBlur={event => {
                if (!event.currentTarget.contains(event.relatedTarget)) onPreviewRepository?.(repositoryForProvider);
              }}
            >
              <RepositoryRows
                repositories={host === 'github' ? (repos.data ?? []) : gitlabRepos}
                searched={debouncedQuery !== ''}
                filter={host === 'gitlab' ? debouncedQuery : ''}
                pending={repositoryQuery.isPending}
                selectedRepositoryId={repositoryForProvider?.id}
                provider={host}
                onSelectRepository={chooseRepository}
                onPreviewRepository={onPreviewRepository}
              />
            </div>
          )}
        </OnboardingSearchInset>
      )}
    </OnboardingStepCard>
  );
}

function GitHubHostRow({
  redirecting,
  unavailableReason,
  onConnect,
  onRetry,
}: {
  redirecting: boolean;
  unavailableReason?: HostUnavailableReason;
  onConnect: () => void;
  onRetry: () => void;
}) {
  return (
    <OnboardingConnectionRow
      name="GitHub"
      icon={<GithubIcon />}
      description={
        unavailableReason
          ? hostUnavailableDescription('github', unavailableReason)
          : 'Repositories, branches, and pull requests.'
      }
      tone={unavailableReason === 'unavailable' ? 'error' : 'muted'}
      action={
        needsRecovery(unavailableReason) ? (
          <HostRecoveryAction host="github" reason={unavailableReason} onRetry={onRetry} />
        ) : (
          <Button variant="default" disabled={redirecting || unavailableReason !== undefined} onClick={onConnect}>
            {redirecting && <Spinner size="sm" aria-label="Connecting to GitHub" />}
            Connect GitHub
          </Button>
        )
      }
    />
  );
}

function GitLabHostRow({
  unavailableReason,
  onConnected,
  onRetry,
}: {
  unavailableReason?: HostUnavailableReason;
  onConnected: () => void;
  onRetry: () => void;
}) {
  return (
    <OnboardingConnectionRow
      name="GitLab"
      icon={<GitLabIcon />}
      description={
        unavailableReason
          ? hostUnavailableDescription('gitlab', unavailableReason)
          : 'Projects, branches, and merge requests.'
      }
      tone={unavailableReason === 'unavailable' ? 'error' : 'muted'}
      action={<GitLabAction unavailableReason={unavailableReason} onConnected={onConnected} onRetry={onRetry} />}
    />
  );
}

function GitLabAction({
  unavailableReason,
  onConnected,
  onRetry,
}: {
  unavailableReason?: HostUnavailableReason;
  onConnected: () => void;
  onRetry: () => void;
}) {
  if (needsRecovery(unavailableReason)) {
    return <HostRecoveryAction host="gitlab" reason={unavailableReason} onRetry={onRetry} />;
  }
  if (unavailableReason) {
    return (
      <Button variant="default" disabled>
        Connect GitLab
      </Button>
    );
  }
  return (
    <ProviderConnectControl
      provider="gitlab"
      label="Connect GitLab"
      variant="default"
      size="md"
      onCompleted={onConnected}
    />
  );
}

function RepositoryError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="flex items-center justify-between gap-3 ps-3">
      <Txt variant="caption" role="alert" className="text-destructive-foreground m-0">
        {message}
      </Txt>
      <Button variant="ghost" size="sm" onClick={onRetry}>
        Retry
      </Button>
    </div>
  );
}

const EMPTY_REPOSITORIES = {
  github: 'No repositories are shared with the Mastra GitHub App yet. Use Manage access to add some.',
  gitlab: 'No GitLab projects found.',
} as const;

function RepositoryRows({
  repositories,
  searched,
  filter,
  pending,
  selectedRepositoryId,
  provider,
  onSelectRepository,
  onPreviewRepository,
}: {
  repositories: SourceControlRepository[];
  searched: boolean;
  /** Filters the list here, for hosts whose search isn't done by the server. */
  filter: string;
  pending: boolean;
  selectedRepositoryId?: number | string;
  provider: 'github' | 'gitlab';
  onSelectRepository: (repository: SourceControlRepository) => void;
  onPreviewRepository?: (repository: SourceControlRepository | undefined) => void;
}) {
  if (pending) return <SkeletonRows label={`Loading ${provider} repositories`} rows={3} rowClassName="h-12 w-full" />;
  const normalizedFilter = filter.trim().toLowerCase();
  const visible = normalizedFilter
    ? repositories.filter(repository => repository.fullName.toLowerCase().includes(normalizedFilter))
    : repositories;
  if (visible.length === 0) {
    return (
      <Txt tone="muted" as="p" variant="caption" className="m-0 px-3 py-4">
        {searched ? 'No matching repositories.' : EMPTY_REPOSITORIES[provider]}
      </Txt>
    );
  }
  return (
    <RadioGroup
      aria-label="Choose a repository"
      value={selectedRepositoryId === undefined ? null : String(selectedRepositoryId)}
      onValueChange={value => {
        const repository = visible.find(repo => String(repo.id) === value);
        if (repository) onSelectRepository(repository);
      }}
      className="gap-0.5"
    >
      {visible.map(repo => (
        <label
          key={repo.id}
          className={cn(
            'group/onboarding-repo flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5',
            selectedRepositoryId === repo.id ? 'bg-fill' : 'hover:bg-fill-subtle focus-within:bg-fill-subtle',
          )}
          onMouseEnter={() => onPreviewRepository?.(repo)}
          onFocus={() => onPreviewRepository?.(repo)}
        >
          <RadioGroupItem value={String(repo.id)} aria-label={repo.fullName} className="shrink-0" />
          <span className="min-w-0 flex-1 motion-safe:transition-transform motion-safe:duration-200 motion-safe:group-hover/onboarding-repo:translate-x-0.5">
            <Txt as="span" variant="caption" className="block truncate">
              {repo.fullName}
            </Txt>
            <Txt as="span" variant="meta" tone="muted" className="mt-0.5 block">
              <Metadata>
                <Metadata.Item>{repo.defaultBranch}</Metadata.Item>
                {repo.private && <Metadata.Item>Private</Metadata.Item>}
              </Metadata>
            </Txt>
          </span>
        </label>
      ))}
    </RadioGroup>
  );
}

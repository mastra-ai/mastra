import { Button } from '@mastra/playground-ui/components/Button';
import { SearchInput } from '@mastra/playground-ui/components/SearchInput';
import { SegmentedControl, SegmentedControlItem } from '@mastra/playground-ui/components/SegmentedControl';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { useDebouncedValue } from '@mastra/playground-ui/hooks/use-debounced-value';
import { cn } from '@mastra/playground-ui/utils/cn';
import { RefreshCw } from 'lucide-react';
import { useState } from 'react';

import { useGitLabProjectsQuery, useGitLabStatusQuery } from '../../../../hooks/useGitLabData';
import {
  RECENT_REPOSITORY_LIMIT,
  useGithubReposQuery,
  useRefreshGithubReposMutation,
} from '../../../../hooks/useGithubRepos';
import { useGithubStatusQuery } from '../../../../hooks/useGithubStatus';
import { SkeletonRows } from '../../../ui/SkeletonRows';
import { gitLabProjectRepository } from '../../factory/services/gitlab';
import type { SourceControlRepository } from '../services/github';
import { githubCallbackAwaitsAccess } from '../services/githubCallbackRecovery';
import { gitLabUnavailableReason, githubUnavailableReason, repositoryHost } from '../services/sourceControlHosts';
import type { SourceControlHost } from '../services/sourceControlHosts';
import type { GitHubAppCallbackResult } from './GitHubAppCallbackHandler';
import { OnboardingGithubHostRow } from './onboarding/OnboardingGithubHostRow';
import { OnboardingGithubNotice } from './onboarding/OnboardingGithubNotice';
import { OnboardingGitlabHostRow } from './onboarding/OnboardingGitlabHostRow';
import { OnboardingInset } from './onboarding/OnboardingInset';
import { OnboardingRepositoryError } from './onboarding/OnboardingRepositoryError';
import { OnboardingRepositoryRows } from './onboarding/OnboardingRepositoryRows';
import { OnboardingSearchInset } from './onboarding/OnboardingSearchInset';
import { OnboardingStepCard } from './onboarding/OnboardingStepCard';

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
  // Decided once on arrival: a GitHub App result is about GitHub, so it opens there even over a GitLab
  // repository or a ready GitLab, and stays there when the result is dismissed. Undefined follows the
  // connection status, so an OAuth return lands on the connected host.
  const [pinnedHost, setPinnedHost] = useState<SourceControlHost | undefined>(() => {
    if (githubCallback) return 'github';
    return initialRepository && repositoryHost(initialRepository);
  });
  const [chosenRepository, setChosenRepository] = useState(initialRepository);
  const [query, setQuery] = useState('');
  const debouncedQuery = useDebouncedValue(query, 750);
  // Clearing the box shows the full list at once; only typing waits for the debounce.
  const search = query === '' ? '' : debouncedQuery;
  const githubStatus = useGithubStatusQuery();
  const connected = githubStatus.data?.connected === true;
  const gitlabStatus = useGitLabStatusQuery();
  const gitlabConfigured = Boolean(gitlabStatus.data?.enabled && gitlabStatus.data.configured);
  const anyHostReady = connected || gitlabConfigured;
  const host = pinnedHost ?? (connected ? 'github' : 'gitlab');
  const hostReady = host === 'github' ? connected : gitlabConfigured;
  const repositoryForProvider =
    chosenRepository && repositoryHost(chosenRepository) === host ? chosenRepository : undefined;
  const repositorySearch = search || undefined;
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
  const refreshFailed = host === 'github' && refreshRepos.isError;
  const statusPending = githubStatus.isPending || gitlabStatus.isPending;
  const chooseRepository = (repository: SourceControlRepository) => {
    setChosenRepository(repository);
    onPreviewRepository?.(repository);
  };
  const resetChoice = () => {
    setChosenRepository(undefined);
    onPreviewRepository?.(undefined);
    // A refresh failure was about the list it refreshed.
    refreshRepos.reset();
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
        // New repositories mean the access an approval or a Platform fix waited on has landed.
        onSuccess: next => {
          if (githubCallbackAwaitsAccess(githubCallback) && next.length > before) onDismissGithubCallback();
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
              resetChoice();
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
        // With no host ready both host rows show, so GitHub's notice belongs there too.
        (host === 'github' || !anyHostReady) && (
          <OnboardingGithubNotice
            callback={githubCallback}
            statusReason={githubStatus.data?.reason}
            statusChecked={githubStatus.isFetchedAfterMount}
            redirecting={githubRedirecting}
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
            <OnboardingGithubHostRow
              redirecting={githubRedirecting}
              unavailableReason={githubUnavailableReason(githubStatus.data?.reason)}
              retrying={githubStatus.isFetching}
              onConnect={onConnect}
              onRetry={() => void githubStatus.refetch()}
            />
          )}
          {showGitlabRow && (
            <OnboardingGitlabHostRow
              unavailableReason={gitLabUnavailableReason(gitlabStatus.data)}
              retrying={gitlabStatus.isFetching}
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
                resetChoice();
              }}
            />
          }
        >
          {refreshFailed ? (
            <OnboardingRepositoryError
              message={refreshRepos.error.message}
              retrying={refreshRepos.isPending}
              onRetry={refreshGithub}
            />
          ) : (
            repositoryQuery.isError && (
              <OnboardingRepositoryError
                message={repositoryQuery.error.message}
                retrying={repositoryQuery.isFetching}
                onRetry={() => void repositoryQuery.refetch()}
              />
            )
          )}
          {!repositoriesFailed && (
            <div
              onMouseLeave={() => onPreviewRepository?.(repositoryForProvider)}
              onBlur={event => {
                if (!event.currentTarget.contains(event.relatedTarget)) onPreviewRepository?.(repositoryForProvider);
              }}
            >
              <OnboardingRepositoryRows
                repositories={host === 'github' ? (repos.data ?? []) : gitlabRepos}
                host={host}
                search={search}
                pending={repositoryQuery.isPending}
                selectedRepositoryId={repositoryForProvider?.id}
                onSelectRepository={chooseRepository}
                onPreviewRepository={onPreviewRepository}
              />
              {host === 'github' && !search && (repos.data?.length ?? 0) >= RECENT_REPOSITORY_LIMIT && (
                <Txt tone="muted" as="p" variant="caption" className="m-0 px-3 pt-2">
                  Showing your most recently pushed repositories. Type to search the rest.
                </Txt>
              )}
            </div>
          )}
        </OnboardingSearchInset>
      )}
    </OnboardingStepCard>
  );
}

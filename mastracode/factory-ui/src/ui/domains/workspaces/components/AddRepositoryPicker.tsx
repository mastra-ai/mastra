import { AddRepositoryDrawerContent } from '@mastra/playground-ui/components/RepositoryList';
import { Button } from '@mastra/playground-ui/components/Button';
import { Notice } from '@mastra/playground-ui/components/Notice';
import { useDebouncedValue } from '@mastra/playground-ui/hooks/use-debounced-value';
import { IconArrowRotateCounterClockwise } from '@mastra/playground-ui/icons/central/IconArrowRotateCounterClockwise';
import { useState } from 'react';

import { useGitLabProjectsQuery, useGitLabStatusQuery } from '../../../../hooks/useGitLabData';
import {
  RECENT_REPOSITORY_LIMIT,
  useGithubReposQuery,
  useRefreshGithubReposMutation,
} from '../../../../hooks/useGithubRepos';
import { useGithubStatusQuery } from '../../../../hooks/useGithubStatus';
import { gitLabProjectRepository } from '../../factory/services/gitlab';
import type { FactoryProject, GithubStatus, SourceControlRepository } from '../services/github';
import { isGitLabRepository } from '../services/github';

export function AddRepositoryPicker({
  factory,
  addingRepository,
  linkError,
  onAddRepository,
}: {
  factory: FactoryProject;
  addingRepository?: SourceControlRepository;
  linkError?: Error;
  onAddRepository: (repo: SourceControlRepository) => void;
}) {
  const [query, setQuery] = useState('');
  const debouncedQuery = useDebouncedValue(query, 750);
  const searchQuery = (query && debouncedQuery) || undefined;
  const githubStatus = useGithubStatusQuery();
  const gitlabStatus = useGitLabStatusQuery();
  const githubConnected = githubStatus.data?.connected === true;
  const gitlabConfigured = gitlabStatus.data?.enabled === true && gitlabStatus.data.configured;
  const reposQuery = useGithubReposQuery(searchQuery, githubConnected);
  const gitlabProjects = useGitLabProjectsQuery(gitlabConfigured);
  const refreshRepos = useRefreshGithubReposMutation(searchQuery);

  const linkedKeys = new Set(factory.repositories.map(repo => `${repo.provider ?? 'github'}:${repo.slug}`));
  const repositories: SourceControlRepository[] = [
    ...(reposQuery.data ?? []),
    ...(gitlabProjects.data ?? []).flatMap(project => {
      const repository = gitLabProjectRepository(project);
      return repository ? [repository] : [];
    }),
  ];
  const normalizedQuery = query.trim().toLowerCase();
  const available = repositories.filter(repo => {
    const provider = isGitLabRepository(repo) ? 'gitlab' : 'github';
    return !linkedKeys.has(`${provider}:${repo.fullName}`) && repo.fullName.toLowerCase().includes(normalizedQuery);
  });
  const pending =
    githubStatus.isPending ||
    gitlabStatus.isPending ||
    (githubConnected && reposQuery.isPending) ||
    (gitlabConfigured && gitlabProjects.isPending);
  const error =
    githubStatus.error ??
    reposQuery.error ??
    gitlabStatus.error ??
    gitlabProjects.error ??
    refreshRepos.error ??
    linkError;
  const githubUnavailable = githubStatus.data?.reason === 'unavailable';
  const gitlabUnavailable = gitlabStatus.data?.reason === 'unavailable';
  const statusUnavailable = githubUnavailable || gitlabUnavailable;
  const canSearch = githubConnected || gitlabConfigured;
  // With no query GitHub lists only the most recent repositories, so more may exist beyond them.
  const recentListCapped = (reposQuery.data?.length ?? 0) >= RECENT_REPOSITORY_LIMIT;
  const waitingForSearch =
    githubConnected && (query !== (searchQuery ?? '') || reposQuery.isPlaceholderData || reposQuery.isFetching);
  const loadingResults = pending || (available.length === 0 && waitingForSearch && !error && !statusUnavailable);

  const repositoryKey = (repo: SourceControlRepository) =>
    `${isGitLabRepository(repo) ? 'gitlab' : 'github'}:${repo.id}`;
  const byKey = new Map(available.map(repo => [repositoryKey(repo), repo]));

  return (
    <AddRepositoryDrawerContent
      repositories={available.map(repo => ({
        key: repositoryKey(repo),
        fullName: repo.fullName,
        provider: isGitLabRepository(repo) ? 'gitlab' : 'github',
        private: isGitLabRepository(repo) ? undefined : repo.private,
        defaultBranch: repo.defaultBranch,
      }))}
      query={query}
      onQueryChange={setQuery}
      loading={loadingResults}
      error={error?.message}
      notices={
        <>
          {githubUnavailable && (
            <StatusUnavailableNotice
              provider="GitHub"
              retrying={githubStatus.isFetching}
              onRetry={() => void githubStatus.refetch()}
            />
          )}
          {gitlabUnavailable && (
            <StatusUnavailableNotice
              provider="GitLab"
              retrying={gitlabStatus.isFetching}
              onRetry={() => void gitlabStatus.refetch()}
            />
          )}
        </>
      }
      unavailableMessage={
        canSearch || error || statusUnavailable ? undefined : githubUnavailableMessage(githubStatus.data)
      }
      emptyMessage={
        error || statusUnavailable
          ? null
          : query
            ? 'No repositories match your search.'
            : recentListCapped
              ? 'Your most recent repositories are already added. Search to find others.'
              : 'No more repositories available. Check repository access with Manage under Source control.'
      }
      onRefresh={githubConnected ? () => refreshRepos.mutate() : undefined}
      refreshLabel="Refresh GitHub repositories"
      refreshing={refreshRepos.isPending}
      addingKey={addingRepository && repositoryKey(addingRepository)}
      onAdd={option => {
        const repo = byKey.get(option.key);
        if (repo) onAddRepository(repo);
      }}
    />
  );
}

function StatusUnavailableNotice({
  provider,
  retrying,
  onRetry,
}: {
  provider: 'GitHub' | 'GitLab';
  retrying: boolean;
  onRetry: () => void;
}) {
  return (
    <Notice
      variant="warning"
      action={
        <Button
          size="sm"
          variant="ghost"
          icon={<IconArrowRotateCounterClockwise />}
          disabled={retrying}
          onClick={onRetry}
        >
          Retry {provider}
        </Button>
      }
    >
      {provider} repositories could not be loaded.
    </Notice>
  );
}

function githubUnavailableMessage(status: GithubStatus | undefined): string {
  if (status?.authRequired || status?.reason === 'auth_required') return 'Sign in again to manage repository access.';
  if (status?.organizationRequired || status?.reason === 'organization_required')
    return 'Select an organization to connect repositories.';
  if (status?.reason === 'missing_config') {
    const missing = status.diagnostics?.missingGithubAppEnvVars ?? [];
    return missing.length > 0
      ? `GitHub is disabled on the server. Missing env vars: ${missing.join(', ')}.`
      : 'No source-control provider is configured on this server.';
  }
  return 'Connect GitHub or GitLab to add repositories.';
}

import { Metadata } from '@mastra/playground-ui/components/Metadata';
import { Button } from '@mastra/playground-ui/components/Button';
import {
  DrawerBody,
  DrawerClose,
  DrawerContent,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from '@mastra/playground-ui/components/Drawer';
import { Notice } from '@mastra/playground-ui/components/Notice';
import { SearchInput } from '@mastra/playground-ui/components/SearchInput';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { useDebouncedValue } from '@mastra/playground-ui/hooks/use-debounced-value';
import { SettingsItem, SettingsSkeleton } from '@mastra/playground-ui/new/settings';
import { IconArrowRotateClockwise } from '@mastra/playground-ui/icons/central/IconArrowRotateClockwise';
import { IconArrowRotateCounterClockwise } from '@mastra/playground-ui/icons/central/IconArrowRotateCounterClockwise';
import { IconCrossMedium } from '@mastra/playground-ui/icons/central/IconCrossMedium';
import { IconPlusLarge } from '@mastra/playground-ui/icons/central/IconPlusLarge';
import { useRef, useState } from 'react';

import { useGitLabProjectsQuery, useGitLabStatusQuery } from '../../../../hooks/useGitLabData';
import { useGithubReposQuery, useRefreshGithubReposMutation } from '../../../../hooks/useGithubRepos';
import { useGithubStatusQuery } from '../../../../hooks/useGithubStatus';
import { gitLabProjectRepository } from '../../factory/services/gitlab';
import { IntegrationItemIcon } from '../../settings/components/IntegrationItem';
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
  const searchInput = useRef<HTMLInputElement>(null);
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
  const waitingForSearch =
    githubConnected && (query !== (searchQuery ?? '') || reposQuery.isPlaceholderData || reposQuery.isFetching);
  const loadingResults = pending || (available.length === 0 && waitingForSearch && !error && !statusUnavailable);

  return (
    <DrawerContent
      initialFocus={searchInput}
      showCloseButton={!addingRepository}
      aria-busy={Boolean(addingRepository) || undefined}
      className="overflow-hidden"
    >
      <DrawerHeader className="shrink-0">
        <DrawerTitle>Add repository</DrawerTitle>
        <div className="mt-3 flex items-center gap-2">
          <SearchInput
            label="Search repositories"
            placeholder="Search repositories"
            value={query}
            onValueChange={setQuery}
            ref={searchInput}
            disabled={Boolean(addingRepository)}
            className="min-w-0 flex-1"
          />
          {githubConnected && (
            <Button
              variant="ghost"
              size="icon-md"
              aria-label="Refresh GitHub repositories"
              disabled={refreshRepos.isPending}
              onClick={() => refreshRepos.mutate()}
            >
              <IconArrowRotateClockwise className={refreshRepos.isPending ? 'motion-safe:animate-spin' : undefined} />
            </Button>
          )}
        </div>
      </DrawerHeader>
      <DrawerBody className="min-h-0 overflow-x-hidden overflow-y-auto">
        {error && <Notice variant="destructive">{error.message}</Notice>}
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
        {loadingResults ? (
          <SettingsSkeleton label="Loading available repositories" variant="item" rows={3} />
        ) : canSearch ? (
          <div className="divide-border flex flex-col divide-y *:py-3">
            {available.map(repo => (
              <SettingsItem
                key={`${isGitLabRepository(repo) ? 'gitlab' : 'github'}:${repo.id}`}
                media={<IntegrationItemIcon provider={isGitLabRepository(repo) ? 'gitlab' : 'github'} />}
                title={<span title={repo.fullName}>{repo.fullName}</span>}
                description={
                  <Metadata>
                    {!isGitLabRepository(repo) && <Metadata.Item>{repo.private ? 'Private' : 'Public'}</Metadata.Item>}
                    <Metadata.Item>Default branch: {repo.defaultBranch}</Metadata.Item>
                  </Metadata>
                }
              >
                <Button
                  size="sm"
                  icon={<IconPlusLarge />}
                  aria-label={`Add ${repo.fullName}`}
                  disabled={Boolean(addingRepository)}
                  onClick={() => onAddRepository(repo)}
                >
                  {addingRepository?.id === repo.id ? 'Adding…' : 'Add'}
                </Button>
              </SettingsItem>
            ))}
            {available.length === 0 && !error && !statusUnavailable && (
              <Txt as="p" variant="caption" tone="muted">
                {query
                  ? 'No repositories match your search.'
                  : 'No more repositories available. Check repository access with Manage under Source control.'}
              </Txt>
            )}
          </div>
        ) : !error && !statusUnavailable ? (
          <Txt as="p" variant="caption" tone="muted">
            {githubUnavailableMessage(githubStatus.data)}
          </Txt>
        ) : null}
      </DrawerBody>
      <DrawerFooter className="shrink-0">
        <DrawerClose
          disabled={Boolean(addingRepository)}
          render={
            <Button size="sm" icon={<IconCrossMedium />}>
              Cancel
            </Button>
          }
        />
      </DrawerFooter>
    </DrawerContent>
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

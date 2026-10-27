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
import { SettingsRow } from '@mastra/playground-ui/new/settings';
import { Plus, RefreshCw, RotateCcw, Settings2, X } from 'lucide-react';
import { useRef, useState } from 'react';
import { Link } from 'react-router';

import { useGitLabProjectsQuery, useGitLabStatusQuery } from '../../../../hooks/useGitLabData';
import { useGithubReposQuery, useRefreshGithubReposMutation } from '../../../../hooks/useGithubRepos';
import { useGithubStatusQuery } from '../../../../hooks/useGithubStatus';
import { gitLabProjectRepository } from '../../factory/services/gitlab';
import { settingsSectionPath } from '../../settings/settingsSections';
import { SettingsIntegrationIcon } from '../../settings/components/brand-icons/SettingsIntegrationIcon';
import { SkeletonRows } from '../../../ui/SkeletonRows';
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
  const statusUnavailable = githubStatus.data?.reason === 'unavailable';
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
            placeholder="Search repositories…"
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
              <RefreshCw className={refreshRepos.isPending ? 'motion-safe:animate-spin' : undefined} />
            </Button>
          )}
        </div>
      </DrawerHeader>
      <DrawerBody className="min-h-0 overflow-x-hidden overflow-y-auto">
        {error && <Notice variant="destructive">{error.message}</Notice>}
        {statusUnavailable && (
          <Notice
            variant="warning"
            action={
              <Button
                size="sm"
                variant="ghost"
                icon={<RotateCcw />}
                disabled={githubStatus.isFetching}
                onClick={() => void githubStatus.refetch()}
              >
                Retry GitHub
              </Button>
            }
          >
            GitHub repositories could not be loaded.
          </Notice>
        )}
        {loadingResults ? (
          <SkeletonRows label="Loading available repositories" rows={3} />
        ) : canSearch ? (
          <div>
            {available.map(repo => (
              <SettingsRow
                key={`${isGitLabRepository(repo) ? 'gitlab' : 'github'}:${repo.id}`}
                label={
                  <span className="flex min-w-0 items-center gap-3">
                    <SettingsIntegrationIcon provider={isGitLabRepository(repo) ? 'gitlab' : 'github'} />
                    <span className="wrap-anywhere">{repo.fullName}</span>
                  </span>
                }
                description={
                  isGitLabRepository(repo)
                    ? `Default branch: ${repo.defaultBranch}`
                    : `${repo.private ? 'Private' : 'Public'} · Default branch: ${repo.defaultBranch}`
                }
              >
                <Button
                  size="sm"
                  icon={<Plus />}
                  aria-label={`Add ${repo.fullName}`}
                  disabled={Boolean(addingRepository)}
                  onClick={() => onAddRepository(repo)}
                >
                  {addingRepository?.id === repo.id ? 'Adding…' : 'Add'}
                </Button>
              </SettingsRow>
            ))}
            {available.length === 0 && !error && !statusUnavailable && (
              <Txt as="p" variant="caption" tone="muted">
                {query
                  ? 'No repositories match your search.'
                  : 'No more repositories available. Check repository access in Connections.'}
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
        <Button
          variant="link"
          size="sm"
          icon={<Settings2 />}
          disabled={Boolean(addingRepository)}
          className="mr-auto"
          render={<Link to={settingsSectionPath(factory.id, 'connections')} />}
        >
          Manage connections
        </Button>
        <DrawerClose
          disabled={Boolean(addingRepository)}
          render={
            <Button size="sm" icon={<X />}>
              Cancel
            </Button>
          }
        />
      </DrawerFooter>
    </DrawerContent>
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
      : 'No source-control provider is configured. Manage connections to see available providers.';
  }
  return 'Connect GitHub or GitLab to add repositories.';
}

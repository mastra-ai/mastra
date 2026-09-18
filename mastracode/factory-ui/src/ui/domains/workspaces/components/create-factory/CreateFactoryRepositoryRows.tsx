import { CommandGroup } from '@mastra/playground-ui/components/Command';
import { CommandPaletteItem } from '@mastra/playground-ui/components/CommandPalette';
import { Spinner } from '@mastra/playground-ui/components/Spinner';
import { useDebouncedValue } from '@mastra/playground-ui/hooks/use-debounced-value';
import { GithubIcon } from '@mastra/playground-ui/icons/GithubIcon';
import { GitBranch, Settings2 } from 'lucide-react';

import { useGitLabProjectsQuery, useGitLabStatusQuery } from '../../../../../hooks/useGitLabData';
import { useGithubReposQuery } from '../../../../../hooks/useGithubRepos';
import { useGithubStatusQuery } from '../../../../../hooks/useGithubStatus';
import { SkeletonRows } from '../../../../ui/SkeletonRows';
import { gitLabProjectRepository } from '../../../factory/services/gitlab';
import type { GitLabRepository } from '../../../factory/services/gitlab';
import type { GithubRepo, GithubStatus, SourceControlRepository } from '../../services/github';
import { CreateFactoryPaletteAlert, CreateFactoryPaletteMessage } from './CreateFactoryPalette';

export interface CreateFactoryRepositoryRowsProps {
  query: string;
  githubRedirecting: boolean;
  onConnect: () => void;
  onManageConnection: () => void;
  onSelectRepository: (repository: SourceControlRepository) => void;
}

function connectionMessage(status: GithubStatus | undefined): string {
  switch (status?.reason) {
    case 'missing_config':
      return 'GitHub is not configured for this deployment.';
    case 'organization_required':
      return 'Join an organization to connect GitHub repositories.';
    case 'auth_required':
      return 'Sign in again to connect GitHub.';
    default:
      return 'Browse the repositories your installations can reach.';
  }
}

export function CreateFactoryRepositoryRows({
  query,
  githubRedirecting,
  onConnect,
  onManageConnection,
  onSelectRepository,
}: CreateFactoryRepositoryRowsProps) {
  const githubStatus = useGithubStatusQuery();
  const connected = githubStatus.data?.connected === true;
  const gitlabStatus = useGitLabStatusQuery();
  const gitlabConfigured = Boolean(gitlabStatus.data?.enabled && gitlabStatus.data.configured);
  const gitlabProjects = useGitLabProjectsQuery(gitlabConfigured);

  if (githubStatus.isPending || gitlabStatus.isPending) {
    return <SkeletonRows label="Loading repositories" rows={3} rowClassName="mx-2 my-1 h-12 rounded-xl" />;
  }

  const githubRows = !connected ? (
    (() => {
      const unavailable =
        githubStatus.data?.reason === 'missing_config' || githubStatus.data?.reason === 'organization_required';
      const missingEnvVars =
        githubStatus.data?.reason === 'missing_config'
          ? (githubStatus.data.diagnostics?.missingGithubAppEnvVars ?? [])
          : [];

      return (
        <CommandGroup heading="GitHub">
          <CommandPaletteItem
            icon={githubRedirecting ? <Spinner size="sm" aria-label="Connecting to GitHub" /> : <GithubIcon />}
            title={unavailable ? 'GitHub unavailable' : 'Connect GitHub'}
            subtitle={
              missingEnvVars.length > 0
                ? `Set ${missingEnvVars.join(', ')} on the server and restart.`
                : connectionMessage(githubStatus.data)
            }
            value="connect-github"
            disabled={unavailable || githubRedirecting}
            onSelect={onConnect}
          />
        </CommandGroup>
      );
    })()
  ) : (
    <>
      <GithubRepositoryResults query={query} onSelectRepository={onSelectRepository} />
      <CommandGroup heading="GitHub">
        <CommandPaletteItem
          icon={<Settings2 />}
          title="Manage GitHub connection"
          subtitle="Add installations or grant access to more repositories"
          value="manage-github"
          onSelect={onManageConnection}
        />
      </CommandGroup>
    </>
  );

  return (
    <>
      {githubRows}
      {gitlabConfigured ? (
        <GitLabRepositoryResults
          query={query}
          projects={gitlabProjects.data?.flatMap(project => {
            const repository = gitLabProjectRepository(project);
            return repository ? [repository] : [];
          })}
          pending={gitlabProjects.isPending}
          error={gitlabProjects.error}
          onSelectRepository={onSelectRepository}
        />
      ) : (
        <CommandGroup heading="GitLab">
          <CommandPaletteItem
            icon={<GitBranch />}
            title="GitLab unavailable"
            subtitle={
              gitlabStatus.data?.reason === 'organization_required'
                ? 'Join an organization to connect GitLab repositories.'
                : 'Connect GitLab through Mastra Platform or configure a GitLab access token on the server.'
            }
            value="gitlab-unavailable"
            disabled
          />
        </CommandGroup>
      )}
    </>
  );
}

function GithubRepositoryResults({
  query,
  onSelectRepository,
}: Pick<CreateFactoryRepositoryRowsProps, 'query' | 'onSelectRepository'>) {
  const debouncedQuery = useDebouncedValue(query, 750);
  const repos = useGithubReposQuery(debouncedQuery || undefined, true);

  if (repos.isPending) {
    return <SkeletonRows label="Loading repositories" rows={3} rowClassName="mx-2 my-1 h-12 rounded-xl" />;
  }
  if (repos.isError) return <CreateFactoryPaletteAlert>{repos.error.message}</CreateFactoryPaletteAlert>;
  if (repos.data.length === 0) return <CreateFactoryPaletteMessage>No repositories found.</CreateFactoryPaletteMessage>;

  return (
    <CommandGroup heading="Repositories">
      {repos.data.map(repo => (
        <CommandPaletteItem
          key={repo.id}
          icon={<GithubIcon />}
          title={repo.fullName}
          subtitle={`${repo.private ? 'Private' : 'Public'} · ${repo.defaultBranch}`}
          value={`repo-${repo.id}`}
          onSelect={() => onSelectRepository(repo)}
        />
      ))}
    </CommandGroup>
  );
}

function GitLabRepositoryResults({
  query,
  projects,
  pending,
  error,
  onSelectRepository,
}: {
  query: string;
  projects: GitLabRepository[] | undefined;
  pending: boolean;
  error: Error | null;
  onSelectRepository: (repository: SourceControlRepository) => void;
}) {
  const normalizedQuery = query.trim().toLowerCase();
  const matches = (projects ?? []).filter(project => project.fullName.toLowerCase().includes(normalizedQuery));
  if (pending) {
    return <SkeletonRows label="Loading GitLab repositories" rows={3} rowClassName="mx-2 my-1 h-12 rounded-xl" />;
  }
  if (error) return <CreateFactoryPaletteAlert>{error.message}</CreateFactoryPaletteAlert>;
  return (
    <CommandGroup heading="GitLab repositories">
      {matches.length === 0 ? (
        <CreateFactoryPaletteMessage>No GitLab repositories found.</CreateFactoryPaletteMessage>
      ) : (
        matches.map(repo => (
          <CommandPaletteItem
            key={repo.id}
            icon={<GitBranch />}
            title={repo.fullName}
            subtitle={`GitLab · ${repo.defaultBranch}`}
            value={`gitlab-repo-${repo.id}`}
            onSelect={() => onSelectRepository(repo)}
          />
        ))
      )}
    </CommandGroup>
  );
}

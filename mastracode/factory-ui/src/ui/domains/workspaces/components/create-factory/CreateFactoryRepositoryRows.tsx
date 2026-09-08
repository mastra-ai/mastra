import { CommandGroup } from '@mastra/playground-ui/components/Command';
import { CommandPaletteItem } from '@mastra/playground-ui/components/CommandPalette';
import { Spinner } from '@mastra/playground-ui/components/Spinner';
import { useDebouncedValue } from '@mastra/playground-ui/hooks/use-debounced-value';
import { GithubIcon } from '@mastra/playground-ui/icons/GithubIcon';
import { Settings2 } from 'lucide-react';

import { useGithubReposQuery } from '../../../../../hooks/useGithubRepos';
import { useGithubStatusQuery } from '../../../../../hooks/useGithubStatus';
import { SkeletonRows } from '../../../../ui/SkeletonRows';
import type { GithubRepo, GithubStatus } from '../../services/github';
import { CreateFactoryPaletteAlert, CreateFactoryPaletteMessage } from './CreateFactoryPalette';

export interface CreateFactoryRepositoryRowsProps {
  query: string;
  githubRedirecting: boolean;
  onConnect: () => void;
  onManageConnection: () => void;
  onSelectRepository: (repository: GithubRepo) => void;
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

  if (githubStatus.isPending) {
    return <SkeletonRows label="Loading repositories" rows={3} rowClassName="mx-2 my-1 h-12 rounded-xl" />;
  }

  if (!connected) {
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
  }

  return (
    <>
      <RepositoryResults query={query} onSelectRepository={onSelectRepository} />
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
}

function RepositoryResults({
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

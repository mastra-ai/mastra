import { Button } from '@mastra/playground-ui/components/Button';
import { RadioGroup, RadioGroupItem } from '@mastra/playground-ui/components/RadioGroup';
import { cn } from '@mastra/playground-ui/utils/cn';
import { ArrowRight, Check } from 'lucide-react';
import { SearchInput } from '@mastra/playground-ui/components/SearchInput';
import { Spinner } from '@mastra/playground-ui/components/Spinner';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { GithubIcon } from '@mastra/playground-ui/icons/GithubIcon';
import { useDebouncedValue } from '@mastra/playground-ui/hooks/use-debounced-value';
import { useState } from 'react';

import { useGitLabProjectsQuery, useGitLabStatusQuery } from '../../../../hooks/useGitLabData';
import { useGithubReposQuery } from '../../../../hooks/useGithubRepos';
import { useGithubStatusQuery } from '../../../../hooks/useGithubStatus';
import { gitLabProjectRepository } from '../../factory/services/gitlab';
import { isGitLabRepository } from '../services/github';
import type { SourceControlRepository } from '../services/github';
import { ProviderConnectControl } from '../../settings/components/PlatformProviderConnections';
import { GitLabIcon } from '../../../ui/icons';
import { SkeletonRows } from '../../../ui/SkeletonRows';
import { OnboardingConnectionRow } from './OnboardingConnectionRow';

export interface VcsFactoryStepProps {
  initialRepository?: SourceControlRepository;
  githubRedirecting: boolean;
  onConnect: () => void;
  onManageConnection: () => void;
  onSelectRepository: (repository: SourceControlRepository) => void;
  onPreviewRepository?: (repository: SourceControlRepository | undefined) => void;
}

export function VcsFactoryStep({
  initialRepository,
  githubRedirecting,
  onConnect,
  onManageConnection,
  onSelectRepository,
  onPreviewRepository,
}: VcsFactoryStepProps) {
  // Undefined follows the connection status, including a return from OAuth.
  // The provider list remains available through Change provider.
  const [providerChoice, setProviderChoice] = useState<'github' | 'gitlab' | 'providers' | undefined>(
    initialRepository ? (isGitLabRepository(initialRepository) ? 'gitlab' : 'github') : undefined,
  );
  const [chosenRepository, setChosenRepository] = useState(initialRepository);
  const [query, setQuery] = useState('');
  const debouncedQuery = useDebouncedValue(query, 750);
  const githubStatus = useGithubStatusQuery();
  const connected = githubStatus.data?.connected === true;
  const gitlabStatus = useGitLabStatusQuery();
  const gitlabConfigured = Boolean(gitlabStatus.data?.enabled && gitlabStatus.data.configured);
  // A draft can outlive its connection; a pin to a disconnected provider would wait on a disabled query forever.
  const pinnedProvider =
    (providerChoice === 'github' && !connected) || (providerChoice === 'gitlab' && !gitlabConfigured)
      ? undefined
      : providerChoice;
  const selectedProvider =
    pinnedProvider === undefined ? (connected ? 'github' : gitlabConfigured ? 'gitlab' : 'providers') : pinnedProvider;
  const repositoryForProvider =
    chosenRepository && (isGitLabRepository(chosenRepository) ? 'gitlab' : 'github') === selectedProvider
      ? chosenRepository
      : undefined;
  const repos = useGithubReposQuery(debouncedQuery || undefined, connected && selectedProvider === 'github');
  const gitlabProjects = useGitLabProjectsQuery(gitlabConfigured && selectedProvider === 'gitlab');
  const gitlabRepos = (gitlabProjects.data ?? []).flatMap(project => {
    const repository = gitLabProjectRepository(project);
    return repository ? [repository] : [];
  });
  const repositoryQuery = selectedProvider === 'gitlab' ? gitlabProjects : repos;
  const chooseRepository = (repository: SourceControlRepository) => {
    setChosenRepository(repository);
    onPreviewRepository?.(repository);
  };

  return (
    <section aria-label="Source control repository" className="w-full text-left">
      {githubStatus.isPending || gitlabStatus.isPending ? (
        <SkeletonRows label="Loading source control status" rows={2} rowClassName="h-16 w-full" />
      ) : selectedProvider === 'providers' ? (
        <ProviderChoice
          githubConnected={connected}
          githubRedirecting={githubRedirecting}
          githubUnavailable={
            githubStatus.data?.reason === 'organization_required' || githubStatus.data?.reason === 'missing_config'
          }
          gitlabConnected={gitlabConfigured}
          gitlabUnavailable={!gitlabStatus.data?.enabled || gitlabStatus.data.reason === 'organization_required'}
          gitlabUnavailableReason={
            !gitlabStatus.data?.enabled
              ? 'missing_config'
              : gitlabStatus.data.reason === 'organization_required'
                ? 'organization_required'
                : undefined
          }
          onChooseGithub={() => {
            if (connected) setProviderChoice('github');
            else onConnect();
          }}
          onGitlabConnected={() => {
            setProviderChoice('gitlab');
            void gitlabStatus.refetch();
            void gitlabProjects.refetch();
          }}
          onChooseGitlab={() => setProviderChoice('gitlab')}
        />
      ) : (
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Check className="text-muted-foreground size-3.5" aria-hidden="true" />
              <ProviderHeading>
                {selectedProvider === 'github' ? 'GitHub connected' : 'GitLab connected'}
              </ProviderHeading>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setQuery('');
                setChosenRepository(undefined);
                onPreviewRepository?.(undefined);
                setProviderChoice('providers');
              }}
            >
              Change provider
            </Button>
          </div>
          <SearchInput
            label="Search repositories"
            placeholder="Find a repository…"
            value={query}
            onValueChange={value => {
              setQuery(value);
              setChosenRepository(undefined);
              onPreviewRepository?.(undefined);
            }}
          />
          {repositoryQuery.isError && <RepositoryError message={repositoryQuery.error.message} />}
          <div
            onMouseLeave={() => onPreviewRepository?.(chosenRepository)}
            onBlur={event => {
              if (!event.currentTarget.contains(event.relatedTarget)) onPreviewRepository?.(chosenRepository);
            }}
          >
            <RepositoryRows
              repositories={selectedProvider === 'github' ? (repos.data ?? []) : gitlabRepos}
              query={selectedProvider === 'gitlab' ? debouncedQuery : ''}
              pending={repositoryQuery.isPending}
              selectedRepositoryId={repositoryForProvider?.id}
              provider={selectedProvider}
              onSelectRepository={chooseRepository}
              onPreviewRepository={onPreviewRepository}
            />
          </div>
          <div className="mt-2 flex items-center gap-3">
            <Button
              variant="primary"
              className="group/onboarding-action"
              disabled={!repositoryForProvider}
              onClick={() => {
                if (repositoryForProvider) onSelectRepository(repositoryForProvider);
              }}
            >
              Continue
              <span className="flex size-4 shrink-0 items-center justify-center">
                <ArrowRight
                  className="size-3.5 motion-safe:transition-transform motion-safe:duration-200 motion-safe:group-hover/onboarding-action:translate-x-0.5"
                  aria-hidden="true"
                />
              </span>
            </Button>
            {selectedProvider === 'github' && (
              <Button variant="ghost" size="sm" onClick={onManageConnection}>
                Manage access
              </Button>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

function ProviderChoice({
  githubConnected,
  githubRedirecting,
  githubUnavailable,
  gitlabConnected,
  gitlabUnavailable,
  gitlabUnavailableReason,
  onChooseGithub,
  onChooseGitlab,
  onGitlabConnected,
}: {
  githubConnected: boolean;
  githubRedirecting: boolean;
  githubUnavailable: boolean;
  gitlabConnected: boolean;
  gitlabUnavailable: boolean;
  gitlabUnavailableReason?: 'missing_config' | 'organization_required';
  onChooseGithub: () => void;
  onChooseGitlab: () => void;
  onGitlabConnected: () => void;
}) {
  return (
    <div className="space-y-1">
      <OnboardingConnectionRow
        name="GitHub"
        icon={<GithubIcon />}
        description={
          githubUnavailable ? 'Unavailable for this deployment.' : 'Repositories, branches, and pull requests.'
        }
        connected={githubConnected}
        action={
          <Button variant="default" disabled={githubRedirecting || githubUnavailable} onClick={onChooseGithub}>
            {githubRedirecting && <Spinner size="sm" aria-label="Connecting to GitHub" />}
            {githubConnected ? 'Continue with GitHub' : 'Connect GitHub'}
          </Button>
        }
      />
      <OnboardingConnectionRow
        name="GitLab"
        icon={<GitLabIcon />}
        description={
          gitlabUnavailable
            ? gitlabUnavailableReason === 'organization_required'
              ? 'Join an organization to connect GitLab.'
              : 'Unavailable for this deployment.'
            : 'Projects, branches, and merge requests.'
        }
        connected={gitlabConnected}
        action={
          gitlabUnavailable ? (
            <Button variant="default" disabled>
              Connect GitLab
            </Button>
          ) : gitlabConnected ? (
            <Button variant="default" onClick={onChooseGitlab}>
              Continue with GitLab
            </Button>
          ) : (
            <ProviderConnectControl
              provider="gitlab"
              label="Connect GitLab"
              variant="default"
              size="md"
              onCompleted={onGitlabConnected}
            />
          )
        }
      />
    </div>
  );
}

function ProviderHeading({ children }: { children: string }) {
  return (
    <Txt tone="muted" as="h2" variant="caption" className="m-0">
      {children}
    </Txt>
  );
}

function RepositoryError({ message }: { message: string }) {
  return (
    <Txt variant="caption" role="alert" className="text-destructive-foreground m-0">
      {message}
    </Txt>
  );
}

function RepositoryRows({
  repositories,
  query,
  pending,
  selectedRepositoryId,
  provider,
  onSelectRepository,
  onPreviewRepository,
}: {
  repositories: SourceControlRepository[];
  query: string;
  pending: boolean;
  selectedRepositoryId?: number | string;
  provider: 'github' | 'gitlab';
  onSelectRepository: (repository: SourceControlRepository) => void;
  onPreviewRepository?: (repository: SourceControlRepository | undefined) => void;
}) {
  if (pending) return <SkeletonRows label={`Loading ${provider} repositories`} rows={3} rowClassName="h-12 w-full" />;
  const normalizedQuery = query.trim().toLowerCase();
  const visible = normalizedQuery
    ? repositories.filter(repository => repository.fullName.toLowerCase().includes(normalizedQuery))
    : repositories;
  if (visible.length === 0) {
    return (
      <Txt tone="muted" as="p" variant="caption" className="m-0 py-4">
        {query ? 'No matching repositories.' : `No ${provider === 'gitlab' ? 'GitLab' : 'GitHub'} repositories found.`}
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
      className="max-h-48 gap-1 overflow-y-auto p-1 sm:max-h-64"
    >
      {visible.map(repo => (
        <label
          key={repo.id}
          className={cn(
            'group/onboarding-repo hover:bg-fill focus-within:bg-fill flex cursor-pointer items-center gap-3 rounded-lg px-3 py-3 transition-colors',
            selectedRepositoryId === repo.id && 'bg-fill',
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
              {repo.defaultBranch}
              {repo.private ? ' · Private' : ''}
            </Txt>
          </span>
        </label>
      ))}
    </RadioGroup>
  );
}

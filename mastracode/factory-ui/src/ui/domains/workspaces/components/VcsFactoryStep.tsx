import { Button } from '@mastra/playground-ui/components/Button';
import { RadioGroup, RadioGroupItem } from '@mastra/playground-ui/components/RadioGroup';
import { cn } from '@mastra/playground-ui/utils/cn';
import { ArrowRight, Check, RefreshCw } from 'lucide-react';
import { SearchInput } from '@mastra/playground-ui/components/SearchInput';
import { Spinner } from '@mastra/playground-ui/components/Spinner';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { GithubIcon } from '@mastra/playground-ui/icons/GithubIcon';
import { useDebouncedValue } from '@mastra/playground-ui/hooks/use-debounced-value';
import { useState } from 'react';

import { useGitLabProjectsQuery, useGitLabStatusQuery } from '../../../../hooks/useGitLabData';
import { useGithubReposQuery, useRefreshGithubReposMutation } from '../../../../hooks/useGithubRepos';
import { useGithubStatusQuery } from '../../../../hooks/useGithubStatus';
import { gitLabProjectRepository } from '../../factory/services/gitlab';
import {
  INSTALL_ON_GITHUB_ORGANIZATION,
  isGitLabRepository,
  SHARE_WITH_THIS_FACTORY,
  unavailableInstallNotice,
} from '../services/github';
import type { SourceControlRepository, UnavailableInstallNotice } from '../services/github';
import { ProviderConnectControl } from '../../settings/components/PlatformProviderConnections';
import { GitLabIcon } from '../../../ui/icons';
import { SkeletonRows } from '../../../ui/SkeletonRows';
import { OnboardingConnectionRow } from './onboarding/OnboardingConnectionRow';

type SourceControlView = 'github' | 'gitlab' | 'providers';

type GitLabUnavailableReason = 'missing_config' | 'organization_required' | 'unavailable';

const HOST_NAMES = { github: 'GitHub', gitlab: 'GitLab' } as const;

const GITLAB_UNAVAILABLE_DESCRIPTIONS: Record<GitLabUnavailableReason, string> = {
  missing_config: 'Unavailable for this deployment.',
  organization_required: 'Join an organization to connect GitLab.',
  unavailable: "Couldn't load GitLab status.",
};

function gitLabUnavailableReason(status?: { enabled: boolean; reason?: string }): GitLabUnavailableReason | undefined {
  if (status?.reason === 'unavailable') return 'unavailable';
  if (!status?.enabled) return 'missing_config';
  if (status.reason === 'organization_required') return 'organization_required';
  return undefined;
}

function repositoryHost(repository: SourceControlRepository) {
  return isGitLabRepository(repository) ? 'gitlab' : 'github';
}

/** A draft can outlive its connection; a pin to a disconnected provider would wait on a disabled query forever. */
function sourceControlView({
  pinned,
  githubConnected,
  gitlabConfigured,
}: {
  pinned?: SourceControlView;
  githubConnected: boolean;
  gitlabConfigured: boolean;
}): SourceControlView {
  const pinIsReachable =
    (pinned === 'github' && githubConnected) || (pinned === 'gitlab' && gitlabConfigured) || pinned === 'providers';
  if (pinned && pinIsReachable) return pinned;
  if (githubConnected) return 'github';
  if (gitlabConfigured) return 'gitlab';
  return 'providers';
}

export interface VcsFactoryStepProps {
  initialRepository?: SourceControlRepository;
  githubRedirecting: boolean;
  onConnect: () => void;
  onManageConnection: () => void;
  /** Opens the Platform page where the linker shares their personal GitHub account install with this factory. */
  onShare: (shareUrl: string) => void;
  onSelectRepository: (repository: SourceControlRepository) => void;
  onPreviewRepository?: (repository: SourceControlRepository | undefined) => void;
}

export function VcsFactoryStep({
  initialRepository,
  githubRedirecting,
  onConnect,
  onManageConnection,
  onShare,
  onSelectRepository,
  onPreviewRepository,
}: VcsFactoryStepProps) {
  // Undefined follows the connection status, so an OAuth return lands on the connected host.
  const [providerChoice, setProviderChoice] = useState<SourceControlView | undefined>(
    initialRepository && repositoryHost(initialRepository),
  );
  const [chosenRepository, setChosenRepository] = useState(initialRepository);
  const [query, setQuery] = useState('');
  const debouncedQuery = useDebouncedValue(query, 750);
  const githubStatus = useGithubStatusQuery();
  const connected = githubStatus.data?.connected === true;
  const installNotice = unavailableInstallNotice(githubStatus.data);
  const gitlabStatus = useGitLabStatusQuery();
  const gitlabConfigured = Boolean(gitlabStatus.data?.enabled && gitlabStatus.data.configured);
  const selectedProvider = sourceControlView({ pinned: providerChoice, githubConnected: connected, gitlabConfigured });
  const repositoryForProvider =
    chosenRepository && repositoryHost(chosenRepository) === selectedProvider ? chosenRepository : undefined;
  const repos = useGithubReposQuery(debouncedQuery || undefined, connected && selectedProvider === 'github');
  const refreshRepos = useRefreshGithubReposMutation(debouncedQuery || undefined);
  const gitlabProjects = useGitLabProjectsQuery(gitlabConfigured && selectedProvider === 'gitlab');
  const gitlabRepos = (gitlabProjects.data ?? []).flatMap(project => {
    const repository = gitLabProjectRepository(project);
    return repository ? [repository] : [];
  });
  const repositoryQuery = selectedProvider === 'gitlab' ? gitlabProjects : repos;
  const statusPending = githubStatus.isPending || gitlabStatus.isPending;
  const chooseRepository = (repository: SourceControlRepository) => {
    setChosenRepository(repository);
    onPreviewRepository?.(repository);
  };

  return (
    <section aria-label="Source control repository" className="w-full text-left">
      {statusPending && <SkeletonRows label="Loading source control status" rows={2} rowClassName="h-16 w-full" />}
      {!statusPending && selectedProvider === 'providers' && (
        <ProviderChoice
          githubConnected={connected}
          githubRedirecting={githubRedirecting}
          githubUnavailable={
            githubStatus.data?.reason === 'organization_required' || githubStatus.data?.reason === 'missing_config'
          }
          githubInstallNotice={installNotice}
          gitlabConnected={gitlabConfigured}
          gitlabUnavailableReason={gitLabUnavailableReason(gitlabStatus.data)}
          onChooseGithub={() => {
            if (connected) setProviderChoice('github');
            else if (installNotice?.shareUrl) onShare(installNotice.shareUrl);
            else if (installNotice?.temporary) void githubStatus.refetch();
            else onConnect();
          }}
          onGitlabConnected={() => {
            setProviderChoice('gitlab');
            void gitlabStatus.refetch();
          }}
          onChooseGitlab={() => setProviderChoice('gitlab')}
          onRetryGitlab={() => void gitlabStatus.refetch()}
        />
      )}
      {!statusPending && selectedProvider !== 'providers' && (
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Check className="text-muted-foreground size-3.5" aria-hidden="true" />
              <ProviderHeading>{`${HOST_NAMES[selectedProvider]} connected`}</ProviderHeading>
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
          {selectedProvider === 'github' && installNotice && (
            <Txt as="p" variant="caption" tone="muted">
              {installNotice.message}
            </Txt>
          )}
          {repositoryQuery.isError && (
            <RepositoryError message={repositoryQuery.error.message} onRetry={() => void repositoryQuery.refetch()} />
          )}
          <div
            onMouseLeave={() => onPreviewRepository?.(repositoryForProvider)}
            onBlur={event => {
              if (!event.currentTarget.contains(event.relatedTarget)) onPreviewRepository?.(repositoryForProvider);
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
              <>
                <Button variant="ghost" size="sm" onClick={onManageConnection}>
                  Manage access
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  aria-label="Refresh GitHub repositories"
                  disabled={refreshRepos.isPending}
                  onClick={() => refreshRepos.mutate()}
                >
                  <RefreshCw
                    className={refreshRepos.isPending ? 'size-3.5 animate-spin' : 'size-3.5'}
                    aria-hidden="true"
                  />
                  Refresh
                </Button>
              </>
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
  githubInstallNotice,
  gitlabConnected,
  gitlabUnavailableReason,
  onChooseGithub,
  onChooseGitlab,
  onGitlabConnected,
  onRetryGitlab,
}: {
  githubConnected: boolean;
  githubRedirecting: boolean;
  githubUnavailable: boolean;
  githubInstallNotice?: UnavailableInstallNotice;
  gitlabConnected: boolean;
  gitlabUnavailableReason?: GitLabUnavailableReason;
  onChooseGithub: () => void;
  onChooseGitlab: () => void;
  onGitlabConnected: () => void;
  onRetryGitlab: () => void;
}) {
  return (
    <div className="space-y-1">
      <OnboardingConnectionRow
        name="GitHub"
        icon={<GithubIcon />}
        description={
          githubUnavailable
            ? 'Unavailable for this deployment.'
            : (githubInstallNotice?.message ?? 'Repositories, branches, and pull requests.')
        }
        connected={githubConnected}
        action={
          <Button variant="default" disabled={githubRedirecting || githubUnavailable} onClick={onChooseGithub}>
            {githubRedirecting && <Spinner size="sm" aria-label="Connecting to GitHub" />}
            {githubConnected
              ? 'Continue with GitHub'
              : githubInstallNotice?.shareUrl
                ? SHARE_WITH_THIS_FACTORY
                : githubInstallNotice?.temporary
                  ? 'Retry GitHub'
                  : githubInstallNotice
                    ? INSTALL_ON_GITHUB_ORGANIZATION
                    : 'Connect GitHub'}
          </Button>
        }
      />
      <OnboardingConnectionRow
        name="GitLab"
        icon={<GitLabIcon />}
        description={
          gitlabUnavailableReason
            ? GITLAB_UNAVAILABLE_DESCRIPTIONS[gitlabUnavailableReason]
            : 'Projects, branches, and merge requests.'
        }
        connected={gitlabConnected}
        action={
          <GitLabAction
            unavailableReason={gitlabUnavailableReason}
            connected={gitlabConnected}
            onChoose={onChooseGitlab}
            onConnected={onGitlabConnected}
            onRetry={onRetryGitlab}
          />
        }
      />
    </div>
  );
}

function GitLabAction({
  unavailableReason,
  connected,
  onChoose,
  onConnected,
  onRetry,
}: {
  unavailableReason?: GitLabUnavailableReason;
  connected: boolean;
  onChoose: () => void;
  onConnected: () => void;
  onRetry: () => void;
}) {
  if (unavailableReason === 'unavailable') {
    return (
      <Button variant="ghost" aria-label="Retry GitLab" onClick={onRetry}>
        Retry
      </Button>
    );
  }
  if (unavailableReason) {
    return (
      <Button variant="default" disabled>
        Connect GitLab
      </Button>
    );
  }
  if (connected) {
    return (
      <Button variant="default" onClick={onChoose}>
        Continue with GitLab
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

function ProviderHeading({ children }: { children: string }) {
  return (
    <Txt tone="muted" as="h2" variant="caption" className="m-0">
      {children}
    </Txt>
  );
}

function RepositoryError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <Txt variant="caption" role="alert" className="text-destructive-foreground m-0">
        {message}
      </Txt>
      <Button variant="ghost" size="sm" onClick={onRetry}>
        Retry
      </Button>
    </div>
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
        {query ? 'No matching repositories.' : `No ${HOST_NAMES[provider]} repositories found.`}
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

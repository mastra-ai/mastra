import { Metadata } from '@mastra/playground-ui/components/Metadata';
import { RadioGroup, RadioGroupItem } from '@mastra/playground-ui/components/RadioGroup';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { cn } from '@mastra/playground-ui/utils/cn';

import { SkeletonRows } from '../../../../ui/SkeletonRows';
import type { SourceControlRepository } from '../../services/github';
import type { SourceControlHost } from '../../services/sourceControlHosts';

const EMPTY_REPOSITORIES = {
  github: 'No repositories are shared with the Mastra GitHub App yet. Use Manage access to add some.',
  gitlab: 'No GitLab projects found.',
} as const;

/** GitHub searches on the server; GitLab lists every project, so its search filters here. */
function visibleRepositories(repositories: SourceControlRepository[], host: SourceControlHost, search: string) {
  const filter = search.trim().toLowerCase();
  if (host === 'github' || !filter) return repositories;
  return repositories.filter(repository => repository.fullName.toLowerCase().includes(filter));
}

export function OnboardingRepositoryRows({
  repositories,
  host,
  search,
  pending,
  selectedRepositoryId,
  onSelectRepository,
  onPreviewRepository,
}: {
  repositories: SourceControlRepository[];
  host: SourceControlHost;
  /** The search the list reflects; empty when there is none. */
  search: string;
  pending: boolean;
  selectedRepositoryId?: number | string;
  onSelectRepository: (repository: SourceControlRepository) => void;
  onPreviewRepository?: (repository: SourceControlRepository | undefined) => void;
}) {
  if (pending) return <SkeletonRows label={`Loading ${host} repositories`} rows={3} rowClassName="h-12 w-full" />;
  const visible = visibleRepositories(repositories, host, search);
  if (visible.length === 0) {
    return (
      <Txt tone="muted" as="p" variant="caption" className="m-0 px-3 py-4">
        {search ? 'No matching repositories.' : EMPTY_REPOSITORIES[host]}
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

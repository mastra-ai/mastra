import { Badge } from '@mastra/playground-ui/components/Badge';
import { ContentBlock, ContentBlocks } from '@mastra/playground-ui/components/ContentBlocks';
import { Switch } from '@mastra/playground-ui/components/Switch';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { GithubIcon } from '@mastra/playground-ui/icons/GithubIcon';
import { SettingsContainer } from '@mastra/playground-ui/new/settings';
import { ChevronDown, GripVertical } from 'lucide-react';
import { useState } from 'react';

import type {
  FactoryEnvironmentRepository,
  FactoryEnvironmentRepositoryPatch,
} from '../../../workspaces/services/environment';
import { GitLabIcon } from '../../../../ui/icons';
import { CommittedInput, type SaveEnvironment } from './CommittedInput';

/**
 * The route validates positions as a permutation of 1..n over every link of
 * the project, so each repository change ships the whole list, renumbered in
 * display order. Dead links (no repository row behind them) ride along with
 * their current values so the count matches; the factory skips them and the
 * page never shows them.
 */
export function repositoriesPatch(
  ordered: FactoryEnvironmentRepository[],
  change?: Partial<FactoryEnvironmentRepositoryPatch> & { projectRepositoryId: string },
): FactoryEnvironmentRepositoryPatch[] {
  return ordered.map((repository, index) => {
    const patch: FactoryEnvironmentRepositoryPatch = {
      projectRepositoryId: repository.projectRepositoryId,
      position: index + 1,
      inEnvironment: repository.inEnvironment,
      setupCommand: repository.setupCommand,
      teardownCommand: repository.teardownCommand,
    };
    return change && change.projectRepositoryId === repository.projectRepositoryId ? { ...patch, ...change } : patch;
  });
}

export type RepositoryProviders = Record<string, 'github' | 'gitlab'>;

/** Live rows are shown and reordered; dead links keep their slots at the end of the list. */
function splitRows(repositories: FactoryEnvironmentRepository[]) {
  const ordered = [...repositories].sort((a, b) => a.position - b.position);
  return {
    live: ordered.filter(repository => repository.slug !== null),
    dead: ordered.filter(repository => repository.slug === null),
  };
}

/** The ordered repository list: drag to reorder, include or exclude, expand for setup, teardown and status. */
export function RepositoriesBlock({
  repositories,
  providers,
  disabled,
  onSave,
}: {
  repositories: FactoryEnvironmentRepository[];
  providers: RepositoryProviders;
  disabled: boolean;
  onSave: SaveEnvironment;
}) {
  const { live, dead } = splitRows(repositories);
  const save = (nextLive: FactoryEnvironmentRepository[], change?: Parameters<typeof repositoriesPatch>[1]) =>
    onSave({ repositories: repositoriesPatch([...nextLive, ...dead], change) });

  return (
    <div className="flex flex-col gap-2">
      <Txt as="h3" variant="label">
        Repositories
      </Txt>
      <Txt as="p" variant="meta" tone="muted">
        Repositories cloned into each new sandbox, in this order.
      </Txt>
      <SettingsContainer className="divide-y-0 p-2">
        <ContentBlocks
          items={live}
          onChange={next => {
            // A drop in place changes nothing the route would see.
            const order = (list: FactoryEnvironmentRepository[]) => list.map(r => r.projectRepositoryId).join('\n');
            if (disabled || order(next) === order(live)) return;
            void save(next);
          }}
          className="flex min-w-0 flex-col gap-px"
        >
          {live.map((repository, index) => (
            <ContentBlock
              key={repository.projectRepositoryId}
              draggableId={repository.projectRepositoryId}
              index={index}
            >
              {dragHandleProps => (
                <RepositoryRow
                  repository={repository}
                  provider={providers[repository.projectRepositoryId] ?? 'github'}
                  disabled={disabled}
                  dragHandleProps={dragHandleProps}
                  onToggle={inEnvironment =>
                    void save(live, { projectRepositoryId: repository.projectRepositoryId, inEnvironment })
                  }
                  onCommands={commands =>
                    save(live, { projectRepositoryId: repository.projectRepositoryId, ...commands })
                  }
                />
              )}
            </ContentBlock>
          ))}
        </ContentBlocks>
      </SettingsContainer>
    </div>
  );
}

/** How the repository's last setup went; nothing to show before the first one. */
const STATUS_BADGE: Record<
  FactoryEnvironmentRepository['lastBuildStatus'],
  { label: string; variant: 'success' | 'destructive' } | null
> = {
  unbuilt: null,
  configured: { label: 'Setup OK', variant: 'success' },
  failed: { label: 'Setup failed', variant: 'destructive' },
};

/** Keeps a click on a control inside the header row from toggling the row. */
const stop = (event: React.SyntheticEvent) => event.stopPropagation();

function RepositoryRow({
  repository,
  provider,
  disabled,
  dragHandleProps,
  onToggle,
  onCommands,
}: {
  repository: FactoryEnvironmentRepository;
  provider: 'github' | 'gitlab';
  disabled: boolean;
  dragHandleProps: React.HTMLAttributes<HTMLElement> | null;
  onToggle: (inEnvironment: boolean) => void;
  onCommands: (commands: { setupCommand?: string | null; teardownCommand?: string | null }) => Promise<unknown>;
}) {
  const [expanded, setExpanded] = useState(false);
  const label = repository.slug ?? '';
  const status = STATUS_BADGE[repository.lastBuildStatus];

  const toggleExpanded = () => setExpanded(v => !v);

  return (
    <div className="rounded-md">
      <div
        role="button"
        tabIndex={0}
        aria-expanded={expanded}
        aria-label={`${expanded ? 'Hide' : 'Show'} details for ${label}`}
        className="hover:bg-surface3 flex w-full cursor-pointer items-center gap-3 rounded-md px-2 py-2"
        onClick={toggleExpanded}
        onKeyDown={event => {
          if (event.target !== event.currentTarget) return;
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            toggleExpanded();
          }
        }}
      >
        <span
          {...dragHandleProps}
          className="text-muted-foreground flex cursor-grab items-center"
          aria-label={`Drag ${label}`}
          onClick={stop}
          onPointerDown={event => {
            stop(event);
            dragHandleProps?.onPointerDown?.(event);
          }}
        >
          <GripVertical className="size-4" aria-hidden />
        </span>
        <span className="min-w-0 flex-1">
          <Txt as="span" tone={repository.inEnvironment ? 'ink' : 'muted'} className="flex items-center gap-1.5">
            {provider === 'gitlab' ? (
              <GitLabIcon className="text-foreground size-3.5 shrink-0" />
            ) : (
              <GithubIcon className="text-foreground size-3.5 shrink-0" />
            )}
            <span className="min-w-0 truncate">{label}</span>
          </Txt>
          {repository.defaultBranch && (
            <Txt as="span" variant="caption" tone="muted" className="block truncate">
              Default branch: {repository.defaultBranch}
            </Txt>
          )}
        </span>
        {status && (
          <Badge size="sm" variant={status.variant}>
            {status.label}
          </Badge>
        )}
        <span className="flex items-center gap-2" onClick={stop}>
          <Txt as="span" variant="caption" tone="muted">
            {repository.inEnvironment ? 'Cloned' : 'Not cloned'}
          </Txt>
          <Switch
            aria-label={`Clone ${label} into every session`}
            checked={repository.inEnvironment}
            disabled={disabled}
            onCheckedChange={value => onToggle(value)}
          />
        </span>
        <ChevronDown
          aria-hidden
          className={`text-muted-foreground size-4 shrink-0 transition-transform ${expanded ? 'rotate-180' : ''}`}
        />
      </div>
      {expanded && (
        <div className="flex flex-col gap-3 px-2 pt-1 pb-3 pl-9">
          <Txt as="p" variant="meta" tone="muted">
            {repository.inEnvironment
              ? 'Cloned into every session and the template build.'
              : 'Not cloned; sessions and builds skip this repository.'}
            {repository.lastBuildStatus === 'configured' && ' Its setup command finished cleanly last time.'}
            {repository.lastBuildStatus === 'failed' && ' Its setup command failed last time:'}
          </Txt>
          {repository.lastBuildStatus === 'failed' && repository.lastBuildError && (
            <Txt as="p" font="mono" variant="meta" className="text-destructive whitespace-pre-wrap">
              {repository.lastBuildError}
            </Txt>
          )}
          <div className="flex flex-col gap-1">
            <Txt as="span" variant="meta" tone="muted">
              Setup: runs in this checkout while the template builds.
            </Txt>
            <CommittedInput
              label={`Setup command for ${label}`}
              value={repository.setupCommand ?? ''}
              placeholder="e.g. pnpm i && pnpm build"
              disabled={disabled}
              onCommit={value => onCommands({ setupCommand: value || null })}
            />
          </div>
          <div className="flex flex-col gap-1">
            <Txt as="span" variant="meta" tone="muted">
              Teardown: runs when the session is retired, and again if setup fails.
            </Txt>
            <CommittedInput
              label={`Teardown command for ${label}`}
              value={repository.teardownCommand ?? ''}
              placeholder="e.g. docker compose down"
              disabled={disabled}
              onCommit={value => onCommands({ teardownCommand: value || null })}
            />
          </div>
        </div>
      )}
    </div>
  );
}

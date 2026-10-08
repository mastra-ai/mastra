import { Badge } from '@mastra/playground-ui/components/Badge';
import { Button } from '@mastra/playground-ui/components/Button';
import { ContentBlock, ContentBlocks } from '@mastra/playground-ui/components/ContentBlocks';
import { Switch } from '@mastra/playground-ui/components/Switch';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { ChevronDown, ChevronUp, GripVertical } from 'lucide-react';
import { useState } from 'react';

import type {
  FactoryEnvironmentRepository,
  FactoryEnvironmentRepositoryPatch,
} from '../../../workspaces/services/environment';
import { CommittedInput, type SaveEnvironment } from './CommittedInput';

/**
 * The route validates positions as a permutation of 1..n over the rows it is
 * sent, so every repository change ships the whole list, renumbered in display
 * order. Dead links (no repository row behind them) are left out: the factory
 * skips them and they cannot be reordered or configured.
 */
export function repositoriesPatch(
  ordered: FactoryEnvironmentRepository[],
  change?: Partial<FactoryEnvironmentRepositoryPatch> & { projectRepositoryId: string },
): FactoryEnvironmentRepositoryPatch[] {
  return ordered
    .filter(repository => repository.slug !== null)
    .map((repository, index) => {
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

function move<T>(list: T[], from: number, to: number): T[] {
  if (to < 0 || to >= list.length) return list;
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item as T);
  return next;
}

/** The ordered repository list: drag or move to reorder, include or exclude, expand for setup, teardown and status. */
export function RepositoriesBlock({
  repositories,
  disabled,
  onSave,
}: {
  repositories: FactoryEnvironmentRepository[];
  disabled: boolean;
  onSave: SaveEnvironment;
}) {
  const ordered = [...repositories].sort((a, b) => a.position - b.position);
  const save = (next: FactoryEnvironmentRepository[], change?: Parameters<typeof repositoriesPatch>[1]) =>
    onSave({ repositories: repositoriesPatch(next, change) });

  return (
    <div className="flex flex-col gap-2">
      <Txt as="h3" variant="label">
        Repositories
      </Txt>
      <Txt as="p" variant="meta" tone="muted">
        Cloned in this order; the first one is where chats start. Excluded repositories stay linked but are not cloned.
      </Txt>
      <ContentBlocks
        items={ordered}
        onChange={next => {
          // A drop in place, or one that only crosses dead links, changes nothing the route would see.
          const same = (list: FactoryEnvironmentRepository[]) =>
            list
              .filter(r => r.slug !== null)
              .map(r => r.projectRepositoryId)
              .join('\n');
          if (disabled || same(next) === same(ordered)) return;
          void save(next);
        }}
        className="flex flex-col gap-2"
      >
        {ordered.map((repository, index) => (
          <ContentBlock key={repository.projectRepositoryId} draggableId={repository.projectRepositoryId} index={index}>
            {dragHandleProps => (
              <RepositoryRow
                repository={repository}
                index={index}
                count={ordered.length}
                disabled={disabled}
                dragHandleProps={dragHandleProps}
                onMove={to => void save(move(ordered, index, to))}
                onToggle={inEnvironment =>
                  void save(ordered, { projectRepositoryId: repository.projectRepositoryId, inEnvironment })
                }
                onCommands={commands =>
                  save(ordered, { projectRepositoryId: repository.projectRepositoryId, ...commands })
                }
              />
            )}
          </ContentBlock>
        ))}
      </ContentBlocks>
    </div>
  );
}

const STATUS_BADGE: Record<
  FactoryEnvironmentRepository['lastBuildStatus'],
  { label: string; variant: 'neutral' | 'success' | 'destructive' }
> = {
  unbuilt: { label: 'Unbuilt', variant: 'neutral' },
  configured: { label: 'Configured', variant: 'success' },
  failed: { label: 'Last build failed', variant: 'destructive' },
};

function RepositoryRow({
  repository,
  index,
  count,
  disabled,
  dragHandleProps,
  onMove,
  onToggle,
  onCommands,
}: {
  repository: FactoryEnvironmentRepository;
  index: number;
  count: number;
  disabled: boolean;
  dragHandleProps: React.HTMLAttributes<HTMLElement> | null;
  onMove: (to: number) => void;
  onToggle: (inEnvironment: boolean) => void;
  onCommands: (commands: { setupCommand?: string | null; teardownCommand?: string | null }) => Promise<unknown>;
}) {
  const [expanded, setExpanded] = useState(false);
  const label = repository.slug ?? 'Repository unavailable';
  const dead = repository.slug === null;
  const status = STATUS_BADGE[repository.lastBuildStatus];
  const rowDisabled = disabled || dead;

  return (
    <div className="border-border1 rounded-lg border" aria-disabled={dead || undefined}>
      <div className="flex items-center gap-2 px-3 py-2">
        <span {...dragHandleProps} className="text-muted-foreground flex items-center" aria-label={`Drag ${label}`}>
          <GripVertical className="size-4" aria-hidden />
        </span>
        <Txt as="span" font="mono" variant="body-sm" tone={dead ? 'muted' : 'ink'} className="min-w-0 flex-1 truncate">
          {label}
        </Txt>
        <Badge size="sm" variant={status.variant}>
          {status.label}
        </Badge>
        <Button
          variant="ghost"
          size="sm"
          aria-label={`Move ${label} up`}
          disabled={rowDisabled || index === 0}
          onClick={() => onMove(index - 1)}
        >
          <ChevronUp aria-hidden />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          aria-label={`Move ${label} down`}
          disabled={rowDisabled || index === count - 1}
          onClick={() => onMove(index + 1)}
        >
          <ChevronDown aria-hidden />
        </Button>
        <Switch
          aria-label={`Include ${label} in the environment`}
          checked={repository.inEnvironment}
          disabled={rowDisabled}
          onCheckedChange={value => onToggle(value)}
        />
        <Button
          variant="ghost"
          size="sm"
          aria-label={`${expanded ? 'Hide' : 'Show'} details for ${label}`}
          aria-expanded={expanded}
          disabled={dead}
          onClick={() => setExpanded(v => !v)}
        >
          {expanded ? 'Hide' : 'Details'}
        </Button>
      </div>
      {expanded && !dead && (
        <div className="border-border1 flex flex-col gap-3 border-t px-3 py-3">
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
              disabled={rowDisabled}
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
              disabled={rowDisabled}
              onCommit={value => onCommands({ teardownCommand: value || null })}
            />
          </div>
        </div>
      )}
    </div>
  );
}

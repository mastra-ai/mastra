import { Badge } from '@mastra/playground-ui/components/Badge';
import { ContentBlock, ContentBlocks } from '@mastra/playground-ui/components/ContentBlocks';
import { Switch } from '@mastra/playground-ui/components/Switch';
import { Tooltip, TooltipContent, TooltipTrigger } from '@mastra/playground-ui/components/Tooltip';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { GithubIcon } from '@mastra/playground-ui/icons/GithubIcon';
import { SettingsContainer, SettingsRow } from '@mastra/playground-ui/new/settings';
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

/** The ordered repository list: one card each, drag to reorder, include or exclude; the header opens setup and teardown. */
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
    <ContentBlocks
      items={live}
      onChange={next => {
        // A drop in place changes nothing the route would see.
        const order = (list: FactoryEnvironmentRepository[]) => list.map(r => r.projectRepositoryId).join('\n');
        if (disabled || order(next) === order(live)) return;
        void save(next);
      }}
      className="flex min-w-0 flex-col gap-4"
    >
      {live.map((repository, index) => (
        <ContentBlock key={repository.projectRepositoryId} draggableId={repository.projectRepositoryId} index={index}>
          {dragHandleProps => (
            <RepositoryRow
              repository={repository}
              position={index + 1}
              provider={providers[repository.projectRepositoryId] ?? 'github'}
              disabled={disabled}
              dragHandleProps={dragHandleProps}
              onToggle={inEnvironment =>
                void save(live, { projectRepositoryId: repository.projectRepositoryId, inEnvironment })
              }
              onCommands={commands => save(live, { projectRepositoryId: repository.projectRepositoryId, ...commands })}
            />
          )}
        </ContentBlock>
      ))}
    </ContentBlocks>
  );
}

/** Keeps a click on a control inside the header from toggling the card. */
const stop = (event: React.SyntheticEvent) => event.stopPropagation();

function RepositoryRow({
  repository,
  position,
  provider,
  disabled,
  dragHandleProps,
  onToggle,
  onCommands,
}: {
  repository: FactoryEnvironmentRepository;
  position: number;
  provider: 'github' | 'gitlab';
  disabled: boolean;
  dragHandleProps: React.HTMLAttributes<HTMLElement> | null;
  onToggle: (inEnvironment: boolean) => void;
  onCommands: (commands: { setupCommand?: string | null; teardownCommand?: string | null }) => Promise<unknown>;
}) {
  const label = repository.slug ?? '';
  const [expanded, setExpanded] = useState(false);
  const toggleExpanded = () => setExpanded(v => !v);

  return (
    <SettingsContainer className="group/row">
      <div
        role="button"
        tabIndex={0}
        aria-expanded={expanded}
        aria-label={`${expanded ? 'Hide' : 'Show'} commands for ${label}`}
        className="hover:bg-surface3 flex cursor-pointer items-center gap-3 px-4 py-3"
        onClick={toggleExpanded}
        onKeyDown={event => {
          if (event.target !== event.currentTarget) return;
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            toggleExpanded();
          }
        }}
      >
        <Tooltip disableHoverablePopup>
          <TooltipTrigger
            render={
              <span
                {...dragHandleProps}
                className="text-muted-foreground flex size-5 shrink-0 cursor-grab items-center justify-center"
                aria-label={`Drag ${label}`}
                onClick={stop}
                onPointerDown={event => {
                  stop(event);
                  dragHandleProps?.onPointerDown?.(event);
                }}
              />
            }
          >
            <Txt as="span" variant="caption" tone="muted" font="mono" className="group-hover/row:hidden">
              {position}
            </Txt>
            <GripVertical className="hidden size-4 group-hover/row:block" aria-hidden />
          </TooltipTrigger>
          <TooltipContent>Drag to reorder</TooltipContent>
        </Tooltip>
        <span className="min-w-0 flex-1">
          <Txt as="span" tone={repository.inEnvironment ? 'ink' : 'muted'} className="flex items-center gap-1.5">
            {provider === 'gitlab' ? (
              <GitLabIcon className="text-foreground size-3.5 shrink-0" />
            ) : (
              <GithubIcon className="text-foreground size-3.5 shrink-0" />
            )}
            <span className="min-w-0 truncate">{label}</span>
          </Txt>
        </span>
        {repository.lastBuildStatus === 'failed' && (
          <Badge size="sm" variant="destructive">
            Last build failed
          </Badge>
        )}
        <span className="flex items-center gap-2" onClick={stop}>
          <Txt as="span" variant="caption" tone="muted">
            {repository.inEnvironment ? 'Cloned' : 'Not cloned'}
          </Txt>
          <Tooltip disableHoverablePopup>
            <TooltipTrigger
              render={
                <Switch
                  aria-label={`Clone ${label} into every session`}
                  checked={repository.inEnvironment}
                  disabled={disabled}
                  onCheckedChange={value => onToggle(value)}
                />
              }
            />
            <TooltipContent>Include in the environment</TooltipContent>
          </Tooltip>
        </span>
        <ChevronDown
          aria-hidden
          className={`text-muted-foreground size-4 shrink-0 transition-transform ${expanded ? 'rotate-180' : ''}`}
        />
      </div>
      {expanded && repository.lastBuildStatus === 'failed' && repository.lastBuildError && (
        <Txt as="p" font="mono" variant="meta" className="text-destructive px-4 py-2 whitespace-pre-wrap">
          {repository.lastBuildError}
        </Txt>
      )}
      {expanded && (
        <>
          <SettingsRow label="Setup" description="Runs in this checkout after it is cloned, before the agent starts.">
            <div className="w-full lg:max-w-96">
              <CommittedInput
                label={`Setup command for ${label}`}
                value={repository.setupCommand ?? ''}
                placeholder="e.g. pnpm i && pnpm build"
                disabled={disabled}
                onCommit={value => onCommands({ setupCommand: value || null })}
              />
            </div>
          </SettingsRow>
          <SettingsRow label="Teardown" description="Runs when the session is retired, and again if setup fails.">
            <div className="w-full lg:max-w-96">
              <CommittedInput
                label={`Teardown command for ${label}`}
                value={repository.teardownCommand ?? ''}
                placeholder="e.g. docker compose down"
                disabled={disabled}
                onCommit={value => onCommands({ teardownCommand: value || null })}
              />
            </div>
          </SettingsRow>
        </>
      )}
    </SettingsContainer>
  );
}

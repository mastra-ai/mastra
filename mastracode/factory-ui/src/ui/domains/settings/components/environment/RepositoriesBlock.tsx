import { Badge } from '@mastra/playground-ui/components/Badge';
import { Button, buttonVariants } from '@mastra/playground-ui/components/Button';
import { ContentBlock, ContentBlocks } from '@mastra/playground-ui/components/ContentBlocks';
import { Notice } from '@mastra/playground-ui/components/Notice';
import { Switch } from '@mastra/playground-ui/components/Switch';
import { InfoTooltip, Tooltip, TooltipContent, TooltipTrigger } from '@mastra/playground-ui/components/Tooltip';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { focusRing } from '@mastra/playground-ui/primitives/transitions';
import { SettingsItem, SettingsItemIcon, SettingsRow } from '@mastra/playground-ui/new/settings';
import { cn } from '@mastra/playground-ui/utils/cn';
import { ChevronDown, GripVertical, Trash2, Unlink } from 'lucide-react';
import { useId, useState } from 'react';

import type {
  FactoryEnvironmentRepository,
  FactoryEnvironmentRepositoryPatch,
} from '../../../workspaces/services/environment';
import { SettingsIntegrationIcon } from '../brand-icons/SettingsIntegrationIcon';
import { CommittedInput } from './CommittedInput';
import type { SaveEnvironment } from './CommittedInput';

// Number every link 1..n (dead links last) and send only ids + positions so concurrent edits survive.
export function reorderPatch(ordered: FactoryEnvironmentRepository[]): FactoryEnvironmentRepositoryPatch[] {
  return ordered.map((repository, index) => ({
    projectRepositoryId: repository.projectRepositoryId,
    position: index + 1,
  }));
}

export type RepositoryProviders = Record<string, 'github' | 'gitlab'>;

function splitRows(repositories: FactoryEnvironmentRepository[]) {
  const ordered = [...repositories].sort((a, b) => a.position - b.position);
  return {
    live: ordered.filter(repository => repository.slug !== null),
    dead: ordered.filter(repository => repository.slug === null),
  };
}

export function RepositoriesBlock({
  repositories,
  providers,
  disabled,
  onSave,
  onRemove,
  removingId,
  removeError,
}: {
  repositories: FactoryEnvironmentRepository[];
  providers: RepositoryProviders;
  disabled: boolean;
  onSave: SaveEnvironment;
  onRemove: (projectRepositoryId: string) => void;
  removingId?: string;
  removeError?: { projectRepositoryId: string; message: string };
}) {
  const { live, dead } = splitRows(repositories);
  const change = (patch: FactoryEnvironmentRepositoryPatch) => onSave({ repositories: [patch] });

  return (
    <>
      {live.length > 0 && (
        <ContentBlocks
          items={live}
          onChange={next => {
            const order = (list: FactoryEnvironmentRepository[]) => list.map(r => r.projectRepositoryId).join('\n');
            if (disabled || order(next) === order(live)) return;
            void onSave({ repositories: reorderPatch([...next, ...dead]) });
          }}
          className="flex min-w-0 flex-col"
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
                  position={index + 1}
                  last={index === live.length - 1}
                  provider={providers[repository.projectRepositoryId] ?? 'github'}
                  disabled={disabled}
                  dragHandleProps={dragHandleProps}
                  onToggle={inEnvironment =>
                    void change({ projectRepositoryId: repository.projectRepositoryId, inEnvironment })
                  }
                  onCommands={commands => change({ projectRepositoryId: repository.projectRepositoryId, ...commands })}
                  onRemove={() => onRemove(repository.projectRepositoryId)}
                  removing={removingId === repository.projectRepositoryId}
                  removeError={
                    removeError?.projectRepositoryId === repository.projectRepositoryId
                      ? removeError.message
                      : undefined
                  }
                />
              )}
            </ContentBlock>
          ))}
        </ContentBlocks>
      )}
      {dead.map(repository => (
        <DeadRepositoryRow
          key={repository.projectRepositoryId}
          disabled={disabled}
          onRemove={() => onRemove(repository.projectRepositoryId)}
          removing={removingId === repository.projectRepositoryId}
          removeError={
            removeError?.projectRepositoryId === repository.projectRepositoryId ? removeError.message : undefined
          }
        />
      ))}
    </>
  );
}

const UNAVAILABLE_LABEL = 'Unavailable repository';

function DeadRepositoryRow({
  disabled,
  onRemove,
  removing,
  removeError,
}: {
  disabled: boolean;
  onRemove: () => void;
  removing: boolean;
  removeError?: string;
}) {
  return (
    <div role="group" aria-label={UNAVAILABLE_LABEL} className="flex flex-col gap-2">
      <SettingsItem
        media={
          <SettingsItemIcon>
            <Unlink />
          </SettingsItemIcon>
        }
        title={
          <Txt as="span" variant="caption" tone="muted">
            {UNAVAILABLE_LABEL}
          </Txt>
        }
      >
        <Button
          variant="ghost"
          size="sm"
          icon={<Trash2 />}
          aria-label={`Remove ${UNAVAILABLE_LABEL}`}
          disabled={disabled}
          onClick={onRemove}
        >
          {removing ? 'Removing…' : 'Remove'}
        </Button>
      </SettingsItem>
      {removeError && <Notice variant="destructive">{removeError}</Notice>}
    </div>
  );
}

function RepositoryRow({
  repository,
  position,
  last,
  provider,
  disabled,
  dragHandleProps,
  onToggle,
  onCommands,
  onRemove,
  removing,
  removeError,
}: {
  repository: FactoryEnvironmentRepository;
  position: number;
  /** The rows share one card cell (the drag list), so each takes the card's row spacing itself. */
  last: boolean;
  provider: 'github' | 'gitlab';
  disabled: boolean;
  dragHandleProps: React.HTMLAttributes<HTMLElement> | null;
  onToggle: (inEnvironment: boolean) => void;
  onCommands: (commands: { setupCommand?: string | null; teardownCommand?: string | null }) => Promise<unknown>;
  onRemove: () => void;
  removing: boolean;
  removeError?: string;
}) {
  const label = repository.slug ?? '';
  const [expanded, setExpanded] = useState(false);
  const detailsId = useId();

  return (
    <div
      role="group"
      aria-label={label}
      className={cn(
        'flex flex-col gap-2 py-3.25',
        position === 1 && 'pt-0',
        last && 'pb-0',
        position > 1 && 'border-border border-t',
      )}
    >
      <SettingsItem
        media={
          <>
            {/* Native buttons block @hello-pangea/dnd drags. */}
            <Tooltip disableHoverablePopup>
              <TooltipTrigger
                render={
                  <span
                    {...dragHandleProps}
                    className={cn(
                      buttonVariants({ variant: 'ghost', size: 'icon-sm' }),
                      'shrink-0',
                      disabled && 'pointer-events-none',
                    )}
                    aria-label={`Drag ${label}`}
                    aria-disabled={disabled}
                    tabIndex={disabled ? -1 : dragHandleProps?.tabIndex}
                  >
                    <GripVertical className="size-4 shrink-0" aria-hidden />
                  </span>
                }
              />
              <TooltipContent>Clone order: {position}. Drag to reorder.</TooltipContent>
            </Tooltip>
            <SettingsItemIcon>
              <SettingsIntegrationIcon provider={provider} />
            </SettingsItemIcon>
          </>
        }
        title={
          <button
            type="button"
            aria-expanded={expanded}
            aria-controls={detailsId}
            aria-label={`${expanded ? 'Hide' : 'Show'} settings for ${label}`}
            onClick={() => setExpanded(value => !value)}
            className={cn(
              'flex max-w-full items-center gap-1.5 rounded-sm text-left',
              !repository.inEnvironment && 'text-muted-foreground',
              focusRing,
            )}
          >
            <span className="min-w-0 truncate" title={label}>
              {label}
            </span>
            <ChevronDown aria-hidden className={cn('size-4 shrink-0', expanded && 'rotate-180')} />
          </button>
        }
        description={repository.inEnvironment ? undefined : 'Skipped'}
      >
        {repository.lastBuildStatus === 'failed' && (
          <Badge size="sm" variant="destructive">
            Last build failed
          </Badge>
        )}
        <Button
          variant="ghost"
          size="sm"
          icon={<Trash2 />}
          aria-label={`Remove ${label}`}
          disabled={disabled}
          onClick={onRemove}
        >
          {removing ? 'Removing…' : 'Remove'}
        </Button>
      </SettingsItem>
      {removeError && <Notice variant="destructive">{removeError}</Notice>}
      {expanded && (
        <div
          id={detailsId}
          className="border-border divide-border mt-1.25 flex flex-col divide-y border-t *:py-3.25 *:last:pb-0"
        >
          <SettingsRow
            label={
              <span className="inline-flex items-center gap-1">
                Pre-clone
                <InfoTooltip aria-label="About pre-clone">
                  Clone this repository into the sandbox before new sessions start. Turning this off keeps it linked,
                  but skips automatic cloning.
                </InfoTooltip>
              </span>
            }
          >
            <Switch
              aria-label={`Clone ${label} into every session`}
              checked={repository.inEnvironment}
              disabled={disabled}
              onCheckedChange={onToggle}
            />
          </SettingsRow>
          <SettingsRow label="Default branch" viewOnly>
            {repository.defaultBranch ?? 'Unknown'}
          </SettingsRow>
          {repository.lastBuildStatus === 'failed' && repository.lastBuildError && (
            <Notice variant="destructive">
              <pre className="wrap-anywhere whitespace-pre-wrap">{repository.lastBuildError}</pre>
            </Notice>
          )}
          <SettingsRow label="Setup" description="Runs in this checkout after it is cloned, before the agent starts.">
            <CommittedInput
              label={`Setup command for ${label}`}
              value={repository.setupCommand ?? ''}
              placeholder="e.g. pnpm i && pnpm build"
              disabled={disabled}
              onCommit={value => onCommands({ setupCommand: value || null })}
            />
          </SettingsRow>
          <SettingsRow label="Teardown" description="Runs when the session is retired, and again if setup fails.">
            <CommittedInput
              label={`Teardown command for ${label}`}
              value={repository.teardownCommand ?? ''}
              placeholder="e.g. docker compose down"
              disabled={disabled}
              onCommit={value => onCommands({ teardownCommand: value || null })}
            />
          </SettingsRow>
        </div>
      )}
    </div>
  );
}

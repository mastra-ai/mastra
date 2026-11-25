import { useId, useState } from 'react';
import type { HTMLAttributes } from 'react';

import { Badge } from '@/ds/components/Badge';
import { Button, buttonVariants } from '@/ds/components/Button';
import { CommittedInput } from '@/ds/components/CommittedInput';
import { ContentBlock, ContentBlocks } from '@/ds/components/ContentBlocks';
import { Notice } from '@/ds/components/Notice';
import { Switch } from '@/ds/components/Switch';
import { InfoTooltip, Tooltip, TooltipContent, TooltipTrigger } from '@/ds/components/Tooltip';
import { Txt } from '@/ds/components/Txt';
import { IconBrokenChainLink3 } from '@/ds/icons/central/IconBrokenChainLink3';
import { IconChevronDownMedium } from '@/ds/icons/central/IconChevronDownMedium';
import { IconDotGrid2x3 } from '@/ds/icons/central/IconDotGrid2x3';
import { GithubIcon } from '@/ds/icons/GithubIcon';
import { GitlabIcon } from '@/ds/icons/GitlabIcon';
import { TrashIcon } from '@/ds/icons/TrashIcon';
import { SettingsItem, SettingsItemIcon, SettingsRow } from '@/ds/new/settings';
import { focusRing } from '@/ds/primitives/transitions';
import { cn } from '@/lib/utils';

export type RepositoryProvider = 'github' | 'gitlab';

export interface RepositoryListItem {
  id: string;
  /** `owner/name`; `null` when the repository is no longer reachable. */
  label: string | null;
  provider?: RepositoryProvider;
  /** Whether the repository is cloned before sessions start. */
  preClone: boolean;
  defaultBranch?: string | null;
  setupCommand?: string | null;
  teardownCommand?: string | null;
  lastBuildFailed?: boolean;
  lastBuildError?: string | null;
}

export type RepositoryCommands = { setupCommand?: string | null; teardownCommand?: string | null };

export interface RepositoryListProps {
  /** In clone order. */
  repositories: RepositoryListItem[];
  disabled?: boolean;
  /** Hides the Teardown row for hosts that never retire a checkout. */
  teardown?: boolean;
  /** Receives every id in the new clone order: reachable repositories first, unavailable ones last. */
  onReorder: (ids: string[]) => void;
  onPreCloneChange: (id: string, preClone: boolean) => void;
  onCommandsChange: (id: string, commands: RepositoryCommands) => Promise<unknown>;
  onRemove: (id: string) => void;
  removingId?: string;
  removeError?: { id: string; message: string };
}

const UNAVAILABLE_LABEL = 'Unavailable repository';

/** A linked repository list: drag to set clone order, expand a row for pre-clone, branch, and setup/teardown commands. */
export function RepositoryList({
  repositories,
  disabled = false,
  teardown = true,
  onReorder,
  onPreCloneChange,
  onCommandsChange,
  onRemove,
  removingId,
  removeError,
}: RepositoryListProps) {
  const live = repositories.filter(repository => repository.label !== null);
  const dead = repositories.filter(repository => repository.label === null);
  const errorFor = (id: string) => (removeError?.id === id ? removeError.message : undefined);

  return (
    <>
      {live.length > 0 && (
        <ContentBlocks
          items={live}
          onChange={next => {
            const order = (list: RepositoryListItem[]) => list.map(repository => repository.id).join('\n');
            if (disabled || order(next) === order(live)) return;
            onReorder([...next, ...dead].map(repository => repository.id));
          }}
          className="flex min-w-0 flex-col divide-y divide-border *:py-3.25 *:first:pt-0 *:last:pb-0"
        >
          {live.map((repository, index) => (
            <ContentBlock key={repository.id} draggableId={repository.id} index={index}>
              {dragHandleProps => (
                <RepositoryRow
                  repository={repository}
                  position={index + 1}
                  disabled={disabled}
                  teardown={teardown}
                  dragHandleProps={dragHandleProps}
                  onPreCloneChange={preClone => onPreCloneChange(repository.id, preClone)}
                  onCommandsChange={commands => onCommandsChange(repository.id, commands)}
                  onRemove={() => onRemove(repository.id)}
                  removing={removingId === repository.id}
                  removeError={errorFor(repository.id)}
                />
              )}
            </ContentBlock>
          ))}
        </ContentBlocks>
      )}
      {dead.map(repository => (
        <DeadRepositoryRow
          key={repository.id}
          disabled={disabled}
          onRemove={() => onRemove(repository.id)}
          removing={removingId === repository.id}
          removeError={errorFor(repository.id)}
        />
      ))}
    </>
  );
}

/** The provider's mark, sized for a settings list row. */
export function RepositoryProviderIcon({ provider, className }: { provider: RepositoryProvider; className?: string }) {
  const Icon = provider === 'gitlab' ? GitlabIcon : GithubIcon;
  return <Icon aria-hidden="true" focusable="false" className={cn('size-4 shrink-0', className)} />;
}

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
            <IconBrokenChainLink3 />
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
          icon={<TrashIcon />}
          aria-label={`Remove ${UNAVAILABLE_LABEL}`}
          disabled={disabled}
          onClick={onRemove}
          loading={removing}
        >
          Remove
        </Button>
      </SettingsItem>
      {removeError && <Notice variant="destructive">{removeError}</Notice>}
    </div>
  );
}

function RepositoryRow({
  repository,
  position,
  disabled,
  teardown,
  dragHandleProps,
  onPreCloneChange,
  onCommandsChange,
  onRemove,
  removing,
  removeError,
}: {
  repository: RepositoryListItem;
  position: number;
  disabled: boolean;
  teardown: boolean;
  dragHandleProps: HTMLAttributes<HTMLElement> | null;
  onPreCloneChange: (preClone: boolean) => void;
  onCommandsChange: (commands: RepositoryCommands) => Promise<unknown>;
  onRemove: () => void;
  removing: boolean;
  removeError?: string;
}) {
  const label = repository.label ?? '';
  const [expanded, setExpanded] = useState(false);
  const detailsId = useId();

  return (
    <div role="group" aria-label={label} className="flex flex-col gap-2">
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
                    <IconDotGrid2x3 className="size-icon-md shrink-0" aria-hidden />
                  </span>
                }
              />
              <TooltipContent>Clone order: {position}. Drag to reorder.</TooltipContent>
            </Tooltip>
            <SettingsItemIcon>
              <RepositoryProviderIcon provider={repository.provider ?? 'github'} />
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
              !repository.preClone && 'text-muted-foreground',
              focusRing,
            )}
          >
            <span className="min-w-0 truncate" title={label}>
              {label}
            </span>
            <IconChevronDownMedium aria-hidden className={cn('size-icon-md shrink-0', expanded && 'rotate-180')} />
          </button>
        }
        description={repository.preClone ? undefined : 'Skipped'}
      >
        {repository.lastBuildFailed && (
          <Badge size="sm" variant="destructive">
            Last build failed
          </Badge>
        )}
        <Button
          variant="ghost"
          size="sm"
          icon={<TrashIcon />}
          aria-label={`Remove ${label}`}
          disabled={disabled}
          onClick={onRemove}
          loading={removing}
        >
          Remove
        </Button>
      </SettingsItem>
      {removeError && <Notice variant="destructive">{removeError}</Notice>}
      {expanded && (
        <div
          id={detailsId}
          className="mt-1.25 flex flex-col divide-y divide-border border-t border-border *:py-3.25 *:last:pb-0"
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
              checked={repository.preClone}
              disabled={disabled}
              onCheckedChange={onPreCloneChange}
            />
          </SettingsRow>
          <SettingsRow label="Default branch" viewOnly>
            {repository.defaultBranch ?? 'Unknown'}
          </SettingsRow>
          {repository.lastBuildFailed && repository.lastBuildError && (
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
              onCommit={value => onCommandsChange({ setupCommand: value || null })}
            />
          </SettingsRow>
          {teardown && (
            <SettingsRow label="Teardown" description="Runs when the session is retired, and again if setup fails.">
              <CommittedInput
                label={`Teardown command for ${label}`}
                value={repository.teardownCommand ?? ''}
                placeholder="e.g. docker compose down"
                disabled={disabled}
                onCommit={value => onCommandsChange({ teardownCommand: value || null })}
              />
            </SettingsRow>
          )}
        </div>
      )}
    </div>
  );
}

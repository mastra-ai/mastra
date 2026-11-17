import { Button } from '@mastra/playground-ui/components/Button';
import { DiffStat } from '@mastra/playground-ui/components/DiffStat';
import { Skeleton } from '@mastra/playground-ui/components/Skeleton';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { useCopyToClipboard } from '@mastra/playground-ui/hooks/use-copy-to-clipboard';
import { focusRing } from '@mastra/playground-ui/primitives/transitions';
import { cn } from '@mastra/playground-ui/utils/cn';
import { pluralize } from '@mastra/playground-ui/utils/string';
import { useId } from 'react';
import type { ReactNode } from 'react';

import { SkeletonRows } from '../../../ui/SkeletonRows';
import type { RepositoryProvider } from './changes/tree/change-tree';
import { REPOSITORY_PROVIDER_ICONS } from './repositoryProviderIcons';
import { IconBranch } from '@mastra/playground-ui/icons/central/IconBranch';
import { IconChanges } from '@mastra/playground-ui/icons/central/IconChanges';
import { IconCheckmark2Medium } from '@mastra/playground-ui/icons/central/IconCheckmark2Medium';
import { IconSquareBehindSquare1 } from '@mastra/playground-ui/icons/central/IconSquareBehindSquare1';
import { IconChevronRightMedium } from '@mastra/playground-ui/icons/central/IconChevronRightMedium';
import { IconMerged } from '@mastra/playground-ui/icons/central/IconMerged';

interface WorkspaceBranch {
  branch: string;
  baseBranch: string;
  repository?: string;
  provider?: RepositoryProvider;
}

interface WorkspaceRepositoryCounts {
  total: number;
  changed: number;
  unreadable: number;
}

interface WorkspaceChangeStats {
  files: number;
  additions?: number;
  deletions?: number;
  repositories?: WorkspaceRepositoryCounts;
}

export type WorkspaceChangesSummary =
  | { state: 'unread' }
  | { state: 'loading' }
  | { state: 'failed' }
  | { state: 'read'; stats: WorkspaceChangeStats };

function filesLabel({ files, repositories }: WorkspaceChangeStats): string {
  const label = pluralize(files, 'file');
  if (!repositories || files === 0) return label;
  return `${label} in ${repositories.changed} of ${repositories.total} repos`;
}

function unreadableLabel({ repositories }: WorkspaceChangeStats): string | undefined {
  return repositories?.unreadable ? `${pluralize(repositories.unreadable, 'repo')} unreadable` : undefined;
}

function changesName(changes: WorkspaceChangesSummary): string {
  if (changes.state === 'loading') return 'Changes, loading';
  if (changes.state === 'failed') return 'Changes, unavailable';
  if (changes.state === 'read')
    return ['Changes', filesLabel(changes.stats), unreadableLabel(changes.stats)].filter(Boolean).join(', ');
  return 'Changes';
}

const rowClass = 'flex h-control-sm min-w-0 items-center gap-1.5';

const branchIcon = <IconBranch aria-hidden className="text-muted-foreground size-icon-sm shrink-0" />;

function BranchCopyButton({ branch }: { branch: string }) {
  const { isCopied, handleCopy } = useCopyToClipboard({ text: branch });
  const CopyIcon = isCopied ? IconCheckmark2Medium : IconSquareBehindSquare1;
  return (
    <button
      type="button"
      aria-label={`Copy branch ${branch}`}
      onClick={handleCopy}
      className={cn(
        'group/branch relative flex min-w-0 cursor-pointer items-center gap-1.5 rounded-sm pr-5',
        focusRing,
      )}
    >
      {branchIcon}
      <Txt as="span" variant="body-sm" tone="ink" className="min-w-0 truncate">
        {branch}
      </Txt>
      <CopyIcon
        aria-hidden
        className={cn(
          'text-muted-foreground absolute right-0 size-3.5',
          !isCopied && 'pointer-fine:opacity-0 group-hover/branch:opacity-100 group-focus-visible/branch:opacity-100',
        )}
      />
    </button>
  );
}

export function WorkspaceSection({
  loading,
  workspace,
  changes,
  action,
  changeRequest,
  onOpen,
  autoFocus,
}: {
  loading: boolean;
  workspace?: WorkspaceBranch;
  changes: WorkspaceChangesSummary;
  action?: ReactNode;
  changeRequest?: ReactNode;
  onOpen: () => void;
  autoFocus?: boolean;
}) {
  const linesId = useId();
  const stats = changes.state === 'read' ? changes.stats : undefined;
  const unreadable = stats && unreadableLabel(stats);
  const lines =
    stats && stats.files > 0 && stats.additions !== undefined && stats.deletions !== undefined
      ? { additions: stats.additions, deletions: stats.deletions }
      : undefined;
  const ProviderIcon = workspace?.provider && REPOSITORY_PROVIDER_ICONS[workspace.provider];
  return (
    <section aria-label="Workspace" className="flex min-w-0 shrink-0 flex-col p-1.5">
      <div className={cn(rowClass, 'pl-2')}>
        {loading ? (
          <>
            {branchIcon}
            <SkeletonRows label="Loading workspace details" rows={1} rowClassName="h-3 w-48" className="grow" />
          </>
        ) : workspace ? (
          <BranchCopyButton branch={workspace.branch} />
        ) : (
          <>
            {branchIcon}
            <Txt as="span" variant="caption" tone="muted" className="min-w-0 truncate">
              Branch details unavailable
            </Txt>
          </>
        )}
        <span className="ml-auto flex shrink-0">{action}</span>
      </div>
      {workspace ? (
        <div className={cn(rowClass, 'gap-3 px-2')}>
          {workspace.repository ? (
            <Txt as="span" variant="caption" tone="muted" className="flex min-w-0 items-center gap-1.5">
              {ProviderIcon ? (
                <span aria-hidden className="flex shrink-0">
                  <ProviderIcon className="size-3.5" />
                </span>
              ) : null}
              <span className="truncate">{workspace.repository}</span>
            </Txt>
          ) : null}
          <Txt as="span" variant="caption" tone="muted" className="flex shrink-0 items-center gap-1.5">
            <IconMerged aria-hidden className="size-icon-sm" />
            into {workspace.baseBranch}
          </Txt>
        </div>
      ) : null}
      {changeRequest}
      <Button
        variant="ghost"
        size="sm"
        className="w-full justify-start"
        autoFocus={autoFocus}
        aria-label={changesName(changes)}
        aria-describedby={lines ? linesId : undefined}
        onClick={onOpen}
      >
        <IconChanges aria-hidden />
        Changes
        {changes.state === 'loading' ? (
          <Skeleton aria-hidden className="h-3 w-12 motion-reduce:before:animate-none" />
        ) : null}
        {changes.state === 'failed' ? (
          <Txt as="span" variant="caption" tone="muted">
            Unavailable
          </Txt>
        ) : null}
        {stats ? (
          <Txt as="span" variant="caption" tone="muted" className="tabular-nums">
            {filesLabel(stats)}
          </Txt>
        ) : null}
        {unreadable ? (
          <Txt as="span" variant="caption" tone="muted">
            {unreadable}
          </Txt>
        ) : null}
        {lines ? (
          <Txt as="span" variant="caption" id={linesId}>
            <DiffStat additions={lines.additions} deletions={lines.deletions} />
          </Txt>
        ) : null}
        <IconChevronRightMedium aria-hidden className="ml-auto" />
      </Button>
    </section>
  );
}

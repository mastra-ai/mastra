import { Button } from '@mastra/playground-ui/components/Button';
import { CopyButton } from '@mastra/playground-ui/components/CopyButton';
import { DiffStat } from '@mastra/playground-ui/components/DiffStat';
import { Skeleton } from '@mastra/playground-ui/components/Skeleton';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { cn } from '@mastra/playground-ui/utils/cn';
import { pluralize } from '@mastra/playground-ui/utils/string';
import { ChevronRight, FileDiff, GitBranch, GitMerge } from 'lucide-react';
import { useId } from 'react';
import type { ReactNode } from 'react';

import { SkeletonRows } from '../../../ui/SkeletonRows';
import type { RepositoryProvider } from './changes/tree/change-tree';
import { REPOSITORY_PROVIDER_ICONS } from './repositoryProviderIcons';

export interface WorkspaceBranch {
  branch: string;
  baseBranch: string;
  repository?: string;
  provider?: RepositoryProvider;
}

export interface WorkspaceChangeStats {
  files: number;
  additions?: number;
  deletions?: number;
}

export type WorkspaceChangesSummary =
  | { state: 'unread' }
  | { state: 'loading' }
  | { state: 'failed' }
  | { state: 'read'; stats: WorkspaceChangeStats };

function changesName(changes: WorkspaceChangesSummary): string {
  if (changes.state === 'loading') return 'Changes, loading';
  if (changes.state === 'failed') return 'Changes, unavailable';
  if (changes.state === 'read') return `Changes, ${pluralize(changes.stats.files, 'file')}`;
  return 'Changes';
}

const rowClass = 'flex h-control-sm min-w-0 items-center gap-1.5';

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
  const lines =
    stats && stats.files > 0 && stats.additions !== undefined && stats.deletions !== undefined
      ? { additions: stats.additions, deletions: stats.deletions }
      : undefined;
  const ProviderIcon = workspace?.provider && REPOSITORY_PROVIDER_ICONS[workspace.provider];
  return (
    <section aria-label="Workspace" className="flex min-w-0 shrink-0 flex-col p-1.5">
      <div className={cn(rowClass, 'pl-2')}>
        <GitBranch aria-hidden className="text-muted-foreground size-3.5 shrink-0" />
        {loading ? (
          <SkeletonRows label="Loading workspace details" rows={1} rowClassName="h-3 w-48" className="grow" />
        ) : workspace ? (
          <>
            <Txt as="span" variant="body-sm" tone="ink" className="min-w-0 truncate" title={workspace.branch}>
              {workspace.branch}
            </Txt>
            <CopyButton content={workspace.branch} tooltip="Copy branch name" variant="ghost" className="shrink-0" />
          </>
        ) : (
          <Txt as="span" variant="caption" tone="muted" className="min-w-0 truncate">
            Branch details unavailable
          </Txt>
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
            <GitMerge aria-hidden className="size-3.5" />
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
        <FileDiff aria-hidden />
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
            {pluralize(stats.files, 'file')}
          </Txt>
        ) : null}
        {lines ? (
          <Txt as="span" variant="caption" id={linesId}>
            <DiffStat additions={lines.additions} deletions={lines.deletions} />
          </Txt>
        ) : null}
        <ChevronRight aria-hidden className="ml-auto" />
      </Button>
    </section>
  );
}

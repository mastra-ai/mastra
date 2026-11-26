import { Skeleton } from '@mastra/playground-ui/components/Skeleton';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { useCopyToClipboard } from '@mastra/playground-ui/hooks/use-copy-to-clipboard';
import { focusRing } from '@mastra/playground-ui/primitives/transitions';
import { cn } from '@mastra/playground-ui/utils/cn';
import type { PullRequestStatus } from '@mastra/factory/work-items/change-requests';
import type { ReactNode } from 'react';

import type { WorkspaceChangeRequest } from '../context/WorkspacePanelContext';
import type { RepositoryProvider } from './changes/tree/change-tree';
import { WorkspaceChangesCard, WorkspaceChangesCardSkeleton } from './WorkspaceChangesCard';
import type { WorkspaceChangesSummary } from './WorkspaceChangesCard';
import { REPOSITORY_PROVIDER_ICONS } from './repositoryProviderIcons';
import { IconArrowRight } from '@mastra/playground-ui/icons/central/IconArrowRight';
import { IconBranch } from '@mastra/playground-ui/icons/central/IconBranch';
import { IconCheckmark2Medium } from '@mastra/playground-ui/icons/central/IconCheckmark2Medium';
import { IconSquareBehindSquare1 } from '@mastra/playground-ui/icons/central/IconSquareBehindSquare1';

interface WorkspaceBranch {
  branch: string;
  baseBranch: string;
  repository?: string;
  provider?: RepositoryProvider;
}

/** Keeps a branch's tail readable: generated branches differ at the end, not the start. */
function MiddleTruncate({ text, tail }: { text: string; tail: number }) {
  if (text.length <= tail + 4) return <span className="min-w-0 truncate">{text}</span>;
  return (
    <span className="flex min-w-0">
      <span className="min-w-0 truncate">{text.slice(0, -tail)}</span>
      <span className="shrink-0">{text.slice(-tail)}</span>
    </span>
  );
}

function BranchCopyButton({ branch }: { branch: string }) {
  const { isCopied, handleCopy } = useCopyToClipboard({ text: branch });
  const CopyIcon = isCopied ? IconCheckmark2Medium : IconSquareBehindSquare1;
  return (
    <button
      type="button"
      aria-label={`Copy branch ${branch}`}
      title={branch}
      onClick={handleCopy}
      className={cn('group/branch flex min-w-0 cursor-pointer items-center gap-1.5 rounded-sm', focusRing)}
    >
      <Txt as="span" variant="body-sm" tone="ink" className="flex min-w-0">
        <MiddleTruncate text={branch} tail={12} />
      </Txt>
      <CopyIcon
        aria-hidden
        className={cn(
          'text-muted-foreground size-icon-xs shrink-0',
          !isCopied && 'pointer-fine:opacity-0 group-hover/branch:opacity-100 group-focus-visible/branch:opacity-100',
        )}
      />
    </button>
  );
}

const rowClass = 'flex min-w-0 items-center gap-1.5 pl-2';
const sectionClass = 'flex min-w-0 shrink-0 flex-col gap-1.5 p-1.5';

function RepositoryName({ slug, provider }: { slug: string; provider?: RepositoryProvider }) {
  const ProviderIcon = provider && REPOSITORY_PROVIDER_ICONS[provider];
  const owner = slug.includes('/') ? slug.slice(0, slug.lastIndexOf('/') + 1) : '';
  return (
    <div className={cn(rowClass, 'h-6')} title={slug}>
      <span aria-hidden className="text-muted-foreground [&>svg]:size-icon-xs flex shrink-0">
        {ProviderIcon ? <ProviderIcon /> : <IconBranch />}
      </span>
      <Txt as="span" variant="caption" tone="muted" className="min-w-0 truncate">
        {owner}
        <span className="text-foreground">{slug.slice(owner.length)}</span>
      </Txt>
    </div>
  );
}

const ELBOW_TONES: Record<PullRequestStatus | 'none', string> = {
  open: 'text-success-indicator',
  merged: 'text-badge-purple-indicator',
  closed: 'text-destructive-foreground',
  draft: 'text-muted-foreground',
  none: 'text-border-strong',
};

/** Drops from the head branch and turns toward its base, tinted by the pull request joining them. */
function Elbow({ status }: { status: PullRequestStatus | 'none' }) {
  return (
    <svg
      aria-hidden
      width={14}
      height={22}
      viewBox="0 0 14 22"
      fill="none"
      className={cn('shrink-0', ELBOW_TONES[status])}
    >
      <path d="M3.5 0.75V5Q3.5 11.75 9.25 11.75H13.25" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" />
    </svg>
  );
}

function BranchEdge({ baseBranch, changeRequest }: { baseBranch: string; changeRequest?: WorkspaceChangeRequest }) {
  return (
    <div className={cn(rowClass, 'h-6')}>
      <Elbow status={changeRequest ? (changeRequest.status ?? 'draft') : 'none'} />
      {changeRequest?.badge}
      <IconArrowRight aria-hidden className="text-muted-foreground size-icon-xs shrink-0" />
      <Txt as="span" variant="caption" tone="muted" className="flex min-w-0" title={baseBranch}>
        <span className="sr-only">into </span>
        <MiddleTruncate text={baseBranch} tail={10} />
      </Txt>
    </div>
  );
}

function BranchRowsSkeleton() {
  return (
    <>
      <div className={cn(rowClass, 'h-7')}>
        <IconBranch aria-hidden className="text-muted-foreground size-icon-xs shrink-0" />
        <Skeleton className="h-3.5 w-1/2 motion-reduce:before:animate-none" />
      </div>
      <div className={cn(rowClass, 'h-6')}>
        <Elbow status="none" />
        <IconArrowRight aria-hidden className="text-muted-foreground size-icon-xs shrink-0" />
        <Skeleton className="h-3 w-1/5 motion-reduce:before:animate-none" />
      </div>
    </>
  );
}

function BranchUnavailable({ loading }: { loading: boolean }) {
  if (loading) {
    return (
      <div role="status" aria-label="Loading workspace details" className="flex flex-col">
        <BranchRowsSkeleton />
      </div>
    );
  }
  return (
    <div className={cn(rowClass, 'h-7')}>
      <IconBranch aria-hidden className="text-muted-foreground size-icon-sm shrink-0" />
      <Txt as="span" variant="caption" tone="muted" className="min-w-0 truncate">
        Branch details unavailable
      </Txt>
    </div>
  );
}

export function WorkspaceSectionSkeleton() {
  return (
    <section aria-hidden className={sectionClass}>
      <div className="flex min-w-0 flex-col">
        <div className={cn(rowClass, 'h-6')}>
          <Skeleton className="size-icon-xs shrink-0 rounded-full motion-reduce:before:animate-none" />
          <Skeleton className="h-3 w-1/3 motion-reduce:before:animate-none" />
        </div>
        <BranchRowsSkeleton />
      </div>
      <WorkspaceChangesCardSkeleton />
    </section>
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
  changeRequest?: WorkspaceChangeRequest;
  onOpen: () => void;
  autoFocus?: boolean;
}) {
  return (
    <section aria-label="Workspace" className={sectionClass}>
      <div className="flex min-w-0 items-start gap-1.5">
        <div className="flex min-w-0 grow flex-col">
          {workspace?.repository ? <RepositoryName slug={workspace.repository} provider={workspace.provider} /> : null}
          {workspace && !loading ? (
            <>
              <div className={cn(rowClass, 'h-7')}>
                <IconBranch aria-hidden className="text-muted-foreground size-icon-xs shrink-0" />
                <BranchCopyButton branch={workspace.branch} />
              </div>
              <BranchEdge baseBranch={workspace.baseBranch} changeRequest={changeRequest} />
            </>
          ) : (
            <>
              <BranchUnavailable loading={loading} />
              {changeRequest ? <div className="flex h-6 min-w-0 items-center pl-2">{changeRequest.badge}</div> : null}
            </>
          )}
        </div>
        {action ? <span className="flex shrink-0 items-center">{action}</span> : null}
      </div>
      <WorkspaceChangesCard changes={changes} onOpen={onOpen} autoFocus={autoFocus} />
    </section>
  );
}

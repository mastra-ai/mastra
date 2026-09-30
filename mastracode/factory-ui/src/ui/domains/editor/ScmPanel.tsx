import { PatchDiff } from '@pierre/diffs/react';
import { Button } from '@mastra/playground-ui/components/Button';
import { Spinner } from '@mastra/playground-ui/components/Spinner';
import { Tooltip, TooltipContent, TooltipTrigger } from '@mastra/playground-ui/components/Tooltip';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { cn } from '@mastra/playground-ui/utils/cn';
import { Check, ChevronDown, ChevronRight, Minus, Plus } from 'lucide-react';
import { useState } from 'react';

import type { ScmEntry } from '../../../api/types';
import {
  useScmCommitMutation,
  useScmDiff,
  useScmStageHunkMutation,
  useScmStageMutation,
  useScmStatus,
} from '../../../hooks/use-scm';

/** One hunk of a unified diff plus the file header needed to apply it alone. */
interface DiffHunk {
  header: string;
  patch: string;
}

/**
 * Split a `git diff` for a single file into independently applicable patches:
 * the file header (everything before the first `@@`) plus one hunk each.
 */
export function splitDiffHunks(diff: string): DiffHunk[] {
  if (!diff.trim()) return [];
  const lines = diff.split('\n');
  const firstHunk = lines.findIndex(line => line.startsWith('@@'));
  if (firstHunk === -1) return [];
  const fileHeader = lines.slice(0, firstHunk).join('\n');
  const hunks: DiffHunk[] = [];
  let current: string[] | null = null;
  for (const line of lines.slice(firstHunk)) {
    if (line.startsWith('@@')) {
      if (current) hunks.push({ header: current[0]!, patch: `${fileHeader}\n${current.join('\n')}\n` });
      current = [line];
    } else if (current) {
      current.push(line);
    }
  }
  if (current) {
    // Drop a trailing blank line left by the final newline split.
    while (current.length > 1 && current[current.length - 1] === '') current.pop();
    hunks.push({ header: current[0]!, patch: `${fileHeader}\n${current.join('\n')}\n` });
  }
  return hunks;
}

interface HunkCardProps {
  hunk: DiffHunk;
  workspacePath: string;
  staging: boolean;
  onStage(patch: string): void;
}

const PIERRE_DIFF_OPTIONS = {
  theme: { light: 'pierre-light', dark: 'pierre-dark' },
  diffStyle: 'unified',
  hideLineNumbers: true,
} as const;

/**
 * One expandable hunk: header, syntax-highlighted diff preview via Pierre's
 * PatchDiff, and a Stage-hunk action. Preview lets the user see exactly what
 * they're about to stage instead of guessing from the `@@` header alone.
 */
function HunkCard({ hunk, workspacePath, staging, onStage }: HunkCardProps) {
  void workspacePath;
  return (
    <div className="border-border-subtle mb-1 overflow-hidden rounded border">
      <div className="bg-fill-subtle/40 flex items-center gap-1.5 px-2 py-1">
        <span className="text-meta text-muted-foreground min-w-0 flex-1 truncate font-mono" title={hunk.header}>
          {hunk.header}
        </span>
        <button
          type="button"
          disabled={staging}
          onClick={() => onStage(hunk.patch)}
          className="text-meta text-muted-foreground hover:text-foreground border-border shrink-0 rounded border px-1.5 disabled:opacity-50"
        >
          Stage hunk
        </button>
      </div>
      <div className="text-caption overflow-x-auto font-mono">
        <PatchDiff patch={hunk.patch} options={PIERRE_DIFF_OPTIONS} />
      </div>
    </div>
  );
}

const STATUS_LABELS: Record<string, string> = {
  M: 'modified',
  A: 'added',
  D: 'deleted',
  R: 'renamed',
  C: 'copied',
  U: 'conflicted',
  '?': 'untracked',
};

function EntryRow({
  entry,
  workspacePath,
  side,
  onOpen,
}: {
  entry: ScmEntry;
  workspacePath: string;
  side: 'staged' | 'unstaged';
  onOpen(path: string): void;
}) {
  const [expanded, setExpanded] = useState(false);
  const stage = useScmStageMutation('stage');
  const unstage = useScmStageMutation('unstage');
  const stageHunk = useScmStageHunkMutation();
  // Hunks come from the unstaged diff, so only the unstaged side expands.
  const canExpand = side === 'unstaged' && entry.status !== '?' && entry.status !== 'D';
  const diff = useScmDiff(workspacePath, entry.path, { enabled: expanded && canExpand });
  const hunks = expanded && diff.data ? splitDiffHunks(diff.data.diff) : [];
  const busy = stage.isPending || unstage.isPending || stageHunk.isPending;

  return (
    <div>
      <div className="hover:bg-fill-hover group flex items-center gap-1 rounded px-1 py-0.5">
        {canExpand ? (
          <button
            type="button"
            aria-label={expanded ? 'Collapse hunks' : 'Expand hunks'}
            onClick={() => setExpanded(previous => !previous)}
            className="text-muted-foreground hover:text-foreground shrink-0"
          >
            {expanded ? <ChevronDown className="size-3" /> : <ChevronRight className="size-3" />}
          </button>
        ) : (
          <span className="size-3 shrink-0" />
        )}
        <button
          type="button"
          onClick={() => onOpen(entry.path)}
          title={entry.path}
          className="text-body-sm text-muted-foreground hover:text-foreground min-w-0 flex-1 truncate text-left"
        >
          {entry.path}
        </button>
        <span className="text-meta text-muted-foreground shrink-0 uppercase" title={STATUS_LABELS[entry.status]}>
          {entry.status}
        </span>
        <Tooltip>
          <TooltipTrigger
            render={
              <button
                type="button"
                aria-label={side === 'unstaged' ? `Stage ${entry.path}` : `Unstage ${entry.path}`}
                disabled={busy}
                onClick={() =>
                  side === 'unstaged'
                    ? stage.mutate({ workspacePath, paths: [entry.path] })
                    : unstage.mutate({ workspacePath, paths: [entry.path] })
                }
                className="text-muted-foreground hover:text-foreground shrink-0 opacity-0 group-hover:opacity-100 disabled:opacity-30"
              >
                {side === 'unstaged' ? <Plus className="size-3.5" /> : <Minus className="size-3.5" />}
              </button>
            }
          />
          <TooltipContent>{side === 'unstaged' ? 'Stage file' : 'Unstage file'}</TooltipContent>
        </Tooltip>
      </div>
      {expanded && (
        <div className="pb-1 pl-5">
          {diff.isPending ? (
            <div className="text-caption text-muted-foreground flex items-center gap-2 py-1">
              <Spinner className="size-3" /> Reading diff…
            </div>
          ) : hunks.length === 0 ? (
            <div className="text-caption text-muted-foreground py-1">No stageable hunks.</div>
          ) : (
            hunks.map((hunk, index) => (
              <HunkCard
                key={index}
                hunk={hunk}
                workspacePath={workspacePath}
                staging={stageHunk.isPending}
                onStage={patch => stageHunk.mutate({ workspacePath, patch })}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
}

interface ScmPanelProps {
  workspacePath: string;
  onOpen(path: string): void;
}

/** Git staging + commit panel: review agent work, stage it, land it. */
export function ScmPanel({ workspacePath, onOpen }: ScmPanelProps) {
  const status = useScmStatus(workspacePath);
  const stage = useScmStageMutation('stage');
  const unstage = useScmStageMutation('unstage');
  const commit = useScmCommitMutation();
  const [message, setMessage] = useState('');
  const [feedback, setFeedback] = useState<string | null>(null);

  if (status.isPending) {
    return (
      <div className="text-caption text-muted-foreground flex items-center gap-2 px-2 py-3">
        <Spinner className="size-3.5" /> Reading git status…
      </div>
    );
  }
  if (!status.data?.available) {
    return <div className="text-caption text-muted-foreground px-2 py-3">Not a git checkout.</div>;
  }

  const { staged, unstaged, branch } = status.data;

  async function performCommit() {
    const trimmed = message.trim();
    if (!trimmed || staged.length === 0 || commit.isPending) return;
    setFeedback(null);
    try {
      const result = await commit.mutateAsync({ workspacePath, message: trimmed });
      if (result.ok) {
        setMessage('');
        setFeedback('Committed.');
      } else {
        setFeedback(result.output || 'Commit failed.');
      }
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : 'Commit failed.');
    }
  }

  return (
    <div className="flex min-h-0 flex-col gap-2 overflow-y-auto p-1">
      <div className="border-border rounded-md border p-1.5">
        <textarea
          value={message}
          onChange={event => setMessage(event.target.value)}
          onKeyDown={event => {
            if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
              event.preventDefault();
              void performCommit();
            }
          }}
          placeholder={branch ? `Commit to ${branch}…` : 'Commit message…'}
          rows={2}
          className="text-body-sm placeholder:text-placeholder w-full resize-none bg-transparent outline-none"
        />
        <div className="flex items-center justify-between gap-2 pt-1">
          {feedback ? (
            <Txt variant="meta" className="text-muted-foreground min-w-0 truncate" title={feedback}>
              {feedback}
            </Txt>
          ) : (
            <span />
          )}
          <Button
            type="button"
            size="sm"
            disabled={!message.trim() || staged.length === 0 || commit.isPending}
            onClick={() => void performCommit()}
          >
            {commit.isPending ? <Spinner className="size-3.5" /> : <Check className="size-3.5" />}
            Commit
          </Button>
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between px-1">
          <Txt variant="meta" className="text-muted-foreground uppercase">
            Staged ({staged.length})
          </Txt>
          {staged.length > 0 && (
            <button
              type="button"
              disabled={unstage.isPending}
              onClick={() => unstage.mutate({ workspacePath, paths: staged.map(entry => entry.path) })}
              className="text-meta text-muted-foreground hover:text-foreground disabled:opacity-50"
            >
              Unstage all
            </button>
          )}
        </div>
        {staged.length === 0 ? (
          <div className="text-caption text-muted-foreground px-1 py-1">Nothing staged.</div>
        ) : (
          staged.map(entry => (
            <EntryRow
              key={`staged-${entry.path}`}
              entry={entry}
              workspacePath={workspacePath}
              side="staged"
              onOpen={onOpen}
            />
          ))
        )}
      </div>

      <div>
        <div className="flex items-center justify-between px-1">
          <Txt variant="meta" className="text-muted-foreground uppercase">
            Changes ({unstaged.length})
          </Txt>
          {unstaged.length > 0 && (
            <button
              type="button"
              disabled={stage.isPending}
              onClick={() => stage.mutate({ workspacePath, paths: unstaged.map(entry => entry.path) })}
              className="text-meta text-muted-foreground hover:text-foreground disabled:opacity-50"
            >
              Stage all
            </button>
          )}
        </div>
        {unstaged.length === 0 ? (
          <div className={cn('text-caption text-muted-foreground px-1 py-1')}>No unstaged changes.</div>
        ) : (
          unstaged.map(entry => (
            <EntryRow
              key={`unstaged-${entry.path}`}
              entry={entry}
              workspacePath={workspacePath}
              side="unstaged"
              onOpen={onOpen}
            />
          ))
        )}
      </div>
    </div>
  );
}

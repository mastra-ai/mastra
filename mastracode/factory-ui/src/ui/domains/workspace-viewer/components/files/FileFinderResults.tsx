import { ScrollArea } from '@mastra/playground-ui/components/ScrollArea';
import { Skeleton } from '@mastra/playground-ui/components/Skeleton';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { cn } from '@mastra/playground-ui/utils/cn';
import type { ReactNode } from 'react';

import type { WorkspaceChangeStatus } from '../../../../../api/types';
import { SkeletonRows } from '../../../../ui/SkeletonRows';
import { ChangeStatusLetter } from '../changes/ChangeStatusLetter';
import { WakeSandbox } from '../WakeSandbox';
import { getFileIcon } from './file-icons';
import type { FileFinder } from './useFileFinder';

/** `matched` indexes the whole path; `text` starts at `from` in it. */
function Marked({ text, from, matched }: { text: string; from: number; matched: readonly number[] }) {
  const parts: ReactNode[] = [];
  let start = 0;
  for (const at of matched) {
    const i = at - from;
    if (i < 0 || i >= text.length) continue;
    if (i > start) parts.push(text.slice(start, i));
    parts.push(
      <mark key={i} className="text-foreground bg-transparent font-semibold">
        {text[i]}
      </mark>,
    );
    start = i + 1;
  }
  parts.push(text.slice(start));
  return parts;
}

function scrollIntoNearest(option: HTMLElement | null) {
  option?.scrollIntoView({ block: 'nearest' });
}

function Centered({ children }: { children: ReactNode }) {
  return <div className="flex min-h-0 flex-1 items-center justify-center p-4 text-center">{children}</div>;
}

interface FileFinderResultsProps {
  workspacePath: string;
  finder: FileFinder;
  changes: ReadonlyMap<string, WorkspaceChangeStatus>;
}

const resultRowClass = 'flex h-7 w-full min-w-0 shrink-0 items-center gap-1.5 rounded-sm px-1';

export function FileFinderResults({ workspacePath, finder, changes }: FileFinderResultsProps) {
  const { index, found, active, setActive } = finder;
  if (index.isLoading || (index.isFetching && found.total === 0)) {
    return (
      <SkeletonRows label="Indexing files" rows={8} className="gap-0 p-1.5">
        <div aria-hidden className={resultRowClass}>
          <Skeleton className="size-icon-sm shrink-0 rounded-sm motion-reduce:before:animate-none" />
          <Skeleton className="h-3 w-1/2 motion-reduce:before:animate-none" />
        </div>
      </SkeletonRows>
    );
  }
  if (index.error) {
    return (
      <Centered>
        <Txt as="span" variant="caption" className="text-destructive-foreground">
          {index.error.message}
        </Txt>
      </Centered>
    );
  }
  if (index.data && !index.data.available) {
    return (
      <Centered>
        <WakeSandbox workspacePath={workspacePath} />
      </Centered>
    );
  }
  if (found.total === 0) {
    const term = finder.searched.trim();
    return (
      <Centered>
        <Txt as="span" variant="caption" tone="muted">
          {index.data?.truncated
            ? `No match for “${term}” among ${index.data.paths.length.toLocaleString()} indexed files; the rest of this workspace isn't indexed.`
            : `No files match “${term}”`}
        </Txt>
      </Centered>
    );
  }

  const notices = [
    ...(found.total > found.matches.length
      ? [`Showing ${found.matches.length} of ${found.total.toLocaleString()}. Keep typing to narrow.`]
      : []),
    ...(index.data?.truncated
      ? [`Searching ${index.data.paths.length.toLocaleString()} files; the rest of this workspace isn't indexed.`]
      : []),
  ];
  return (
    <>
      <ScrollArea className="min-h-0 flex-1">
        <div id={finder.listboxId} role="listbox" aria-label="Files found" className="flex flex-col p-1.5">
          {found.matches.map(({ path, matched }, at) => {
            const nameStart = path.lastIndexOf('/') + 1;
            const status = changes.get(path);
            return (
              <button
                key={path}
                ref={at === active ? scrollIntoNearest : undefined}
                id={finder.optionId(at)}
                type="button"
                role="option"
                tabIndex={-1}
                aria-selected={at === active}
                title={path}
                className={cn(
                  resultRowClass,
                  'text-caption cursor-pointer text-left',
                  at === active && 'bg-fill-hover',
                )}
                onMouseDown={event => event.preventDefault()}
                onPointerMove={() => {
                  if (at !== active) setActive(at);
                }}
                onClick={() => finder.open(path)}
              >
                <span aria-hidden className="[&>svg]:size-icon-sm flex shrink-0 items-center">
                  {getFileIcon(path)}
                </span>
                <span className="text-muted-foreground max-w-full shrink-0 truncate">
                  <Marked text={path.slice(nameStart)} from={nameStart} matched={matched} />
                </span>
                <span className="text-subtle-foreground min-w-0 flex-1 truncate">
                  <Marked text={path.slice(0, Math.max(0, nameStart - 1))} from={0} matched={matched} />
                </span>
                {status ? <ChangeStatusLetter status={status} /> : null}
              </button>
            );
          })}
        </div>
      </ScrollArea>
      {notices.length > 0 ? (
        <Txt as="p" variant="caption" tone="faint" className="border-border border-t px-3 py-2">
          {notices.join(' ')}
        </Txt>
      ) : null}
    </>
  );
}

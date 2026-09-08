import { Avatar } from '@mastra/playground-ui/components/Avatar';
import { Button } from '@mastra/playground-ui/components/Button';
import { Skeleton } from '@mastra/playground-ui/components/Skeleton';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { useState } from 'react';

import { useRepositoryCommits } from '../../../../hooks/useRepositoryCommits';
import { relativeTime } from '../../../../lib/date/relativeTime';
import type { RepositoryCommit } from '../services/commits';
import { PANEL, TIMESTAMP } from './panel';
import { RAIL_ROW_BODY } from './Timeline';

const COMMITS_FETCHED = 20;
const COMMITS_COLLAPSED = 7;

/** What GitHub itself shows, and what pastes back into `git show`. */
const SHORT_SHA = 7;

const ROW_HEIGHT = 'h-8';

/** Rows touch, so each draws the line across its own height — halved at the ends, where it stops at the mark. */
const RAIL_SEGMENT = 'bg-border2 absolute left-[0.875rem] w-px -translate-x-1/2';

function segment(first: boolean, last: boolean) {
  if (first && last) return null;
  if (first) return 'top-1/2 bottom-0';
  if (last) return 'top-0 bottom-1/2';
  return 'inset-y-0';
}

/** The ring is filled with the page colour so the rail does not show through its hole. */
function CommitMark({ head }: { head: boolean }) {
  return head ? (
    <span className="border-accent1 bg-surface2 size-2.5 rounded-full border-2" aria-label="Tip of the branch" />
  ) : (
    <span className="bg-border2 size-1.5 rounded-full" aria-hidden />
  );
}

function CommitRow({ commit, first, last }: { commit: RepositoryCommit; first: boolean; last: boolean }) {
  const author = commit.author ?? 'Unknown';
  const line = segment(first, last);

  return (
    <li className="relative grid grid-cols-[1.75rem_minmax(0,1fr)] gap-x-3">
      {line ? <span aria-hidden className={`${RAIL_SEGMENT} ${line}`} /> : null}
      <span className={`grid w-7 place-items-center ${ROW_HEIGHT}`}>
        <CommitMark head={first} />
      </span>
      <a
        href={commit.url}
        target="_blank"
        rel="noreferrer"
        className={`${RAIL_ROW_BODY} flex items-center ${ROW_HEIGHT}`}
      >
        <Txt as="span" variant="ui-sm" className="flex min-w-0 flex-1 items-center gap-2 pr-4">
          <Avatar src={commit.avatarUrl ?? undefined} name={author} size="sm" />
          <span className="text-icon6 min-w-0 truncate font-medium">{commit.message}</span>
        </Txt>
        <span className={`${TIMESTAMP} text-icon3 shrink-0 font-mono`}>{commit.sha.slice(0, SHORT_SHA)}</span>
        {commit.committedAt ? (
          <time dateTime={commit.committedAt} className={`${TIMESTAMP} w-14 shrink-0 pl-3 text-right`}>
            {relativeTime(commit.committedAt)}
          </time>
        ) : null}
      </a>
    </li>
  );
}

function Note({ children }: { children: string }) {
  return (
    <div className={`${PANEL} px-3 py-6`}>
      <Txt as="p" variant="ui-sm" className="text-icon3 m-0 text-center">
        {children}
      </Txt>
    </div>
  );
}

/** The connected repository's default branch, newest first — the one thing on Overview that comes from GitHub. */
export function CommitRail({ projectRepositoryId }: { projectRepositoryId: string | undefined }) {
  const [expanded, setExpanded] = useState(false);
  const query = useRepositoryCommits(projectRepositoryId, COMMITS_FETCHED);

  // No repository means the query never fetches, so it stays pending for good.
  if (!projectRepositoryId) return <Note>No repository linked yet</Note>;
  if (query.isPending) return <Skeleton className="h-40 w-full rounded-xl" />;
  if (query.isError) return <Note>Could not reach GitHub for the commit history.</Note>;

  const commits = query.data?.commits ?? [];
  if (commits.length === 0) return <Note>No commits yet</Note>;

  const shown = expanded ? commits : commits.slice(0, COMMITS_COLLAPSED);
  const hidden = commits.length - shown.length;

  return (
    <div className="flex flex-col items-start gap-1">
      <ul className="m-0 flex w-full list-none flex-col p-0">
        {shown.map((commit, index) => (
          <CommitRow key={commit.sha} commit={commit} first={index === 0} last={index === shown.length - 1} />
        ))}
      </ul>
      {hidden > 0 ? (
        <Button variant="ghost" size="xs" className="ml-8" onClick={() => setExpanded(true)}>
          Show {hidden} more
        </Button>
      ) : null}
    </div>
  );
}

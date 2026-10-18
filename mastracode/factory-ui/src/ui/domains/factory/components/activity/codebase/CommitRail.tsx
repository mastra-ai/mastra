import { Avatar } from '@mastra/playground-ui/components/Avatar';
import { Notice } from '@mastra/playground-ui/components/Notice';
import { Txt } from '@mastra/playground-ui/components/Txt';

import { useRepositoryCommits } from '../../../../../../hooks/useRepositoryCommits';
import { SkeletonRows } from '../../../../../ui/SkeletonRows';
import { clockTime, dayHeading, groupByDay } from '../../../activity';
import type { RepositoryCommit } from '../../../services/commits';
import { DayHeading, RAIL_ROW_BODY } from '../../Timeline';
import { CommitRailEmptyState } from './CommitRailEmptyState';

/** Half of GitHub's page cap: a few days of a busy repository, one rate-limited call. */
const COMMITS_FETCHED = 50;

/** What GitHub itself shows, and what pastes back into `git show`. */
const SHORT_SHA = 7;

const ROW_HEIGHT = 'h-8';

/** Rows touch, so each draws the line across its own height — halved at the ends, where it stops at the mark. */
const RAIL_SEGMENT = 'bg-border-strong absolute left-[0.875rem] w-px -translate-x-1/2';

function segment(first: boolean, last: boolean) {
  if (first && last) return null;
  if (first) return 'top-1/2 bottom-0';
  if (last) return 'top-0 bottom-1/2';
  return 'inset-y-0';
}

/** The ring is filled with the page colour so the rail does not show through its hole. */
function CommitMark({ head }: { head: boolean }) {
  return head ? (
    <span
      className="border-badge-green-indicator bg-background size-2.5 rounded-full border-2"
      aria-label="Tip of the branch"
    />
  ) : (
    <span className="bg-border-strong size-1.5 rounded-full" aria-hidden />
  );
}

interface DatedCommit {
  commit: RepositoryCommit;
  at: number;
}

function CommitRow({ commit, at, head, first, last }: DatedCommit & { head: boolean; first: boolean; last: boolean }) {
  const author = commit.author ?? 'Unknown';
  const line = segment(first, last);

  return (
    <li className="relative grid grid-cols-[1.75rem_minmax(0,1fr)] gap-x-3">
      {line ? <span aria-hidden className={`${RAIL_SEGMENT} ${line}`} /> : null}
      <span className={`grid w-7 place-items-center ${ROW_HEIGHT}`}>
        <CommitMark head={head} />
      </span>
      <a
        href={commit.url}
        target="_blank"
        rel="noreferrer"
        className={`${RAIL_ROW_BODY} flex items-center gap-3 ${ROW_HEIGHT}`}
      >
        <span className="flex min-w-0 flex-1 items-center gap-2">
          <Avatar src={commit.avatarUrl ?? undefined} name={author} size="sm" />
          <Txt as="span" variant="column" tone="ink" className="min-w-0 truncate">
            {commit.message}
          </Txt>
        </span>
        <Txt as="span" variant="meta" font="mono" tone="muted" className="shrink-0">
          {commit.sha.slice(0, SHORT_SHA)}
        </Txt>
        {commit.committedAt === null ? null : (
          <Txt
            as="time"
            variant="meta"
            tone="muted"
            font="mono"
            dateTime={commit.committedAt}
            className="w-16 shrink-0 text-right"
          >
            {clockTime(at)}
          </Txt>
        )}
      </a>
    </li>
  );
}

export function CommitRail({
  projectRepositoryId,
  factoryProjectId,
}: {
  projectRepositoryId: string | undefined;
  factoryProjectId: string;
}) {
  const query = useRepositoryCommits(projectRepositoryId, COMMITS_FETCHED);

  // No repository means the query never fetches, so it stays pending for good.
  if (!projectRepositoryId) return <CommitRailEmptyState linked={false} factoryProjectId={factoryProjectId} />;
  if (query.isPending) return <SkeletonRows label="Loading commits" rows={6} rowClassName="h-8 w-full" />;
  if (query.isError) return <Notice variant="destructive">Could not reach GitHub for the commit history.</Notice>;

  const commits = query.data.commits;
  if (commits.length === 0) return <CommitRailEmptyState linked factoryProjectId={factoryProjectId} />;

  const nowMs = Date.now();
  const tipSha = commits[0]?.sha;
  // GitHub dates every commit in practice; one without a date stays under the day of the commit above it.
  let previousAt = nowMs;
  const dated = commits.map(commit => {
    const parsed = Date.parse(commit.committedAt ?? '');
    previousAt = Number.isNaN(parsed) ? previousAt : parsed;
    return { commit, at: previousAt };
  });

  return (
    <div className="flex flex-col gap-6">
      {groupByDay(dated).map(day => {
        const heading = dayHeading(day.dayMs, nowMs);
        return (
          <section key={day.dayMs} aria-label={heading} className="flex flex-col gap-2">
            <DayHeading>{heading}</DayHeading>
            <ul className="m-0 flex w-full list-none flex-col p-0">
              {day.items.map((entry, index) => (
                <CommitRow
                  key={entry.commit.sha}
                  {...entry}
                  head={entry.commit.sha === tipSha}
                  first={index === 0}
                  last={index === day.items.length - 1}
                />
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

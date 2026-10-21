import { Avatar } from '@mastra/playground-ui/components/Avatar';
import { DropdownMenu } from '@mastra/playground-ui/components/DropdownMenu';
import { Tooltip, TooltipTrigger } from '@mastra/playground-ui/components/Tooltip';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { cn } from '@mastra/playground-ui/utils/cn';
import { GitCommitHorizontal } from 'lucide-react';
import { useMemo } from 'react';
import type { CSSProperties } from 'react';

import { clockTime } from '../../../../activity';
import type { RepositoryCommit } from '../../../../services/commits';
import type { TimeWindow } from '../time/timeViewport';
import { edgeFade } from '../track/edgeFade';
import type { EdgeFade } from '../track/edgeFade';
import { DetailLinesTooltipContent, TrackChipBody } from '../track/TrackChip';
import { TRACK_CHIP_CLASS, TRACK_CHIP_HEIGHT_PX, trackChipStyle } from '../track/trackChipStyles';
import { commitChips, datedCommits } from './commitChips';
import type { CommitAuthor, DatedCommit } from './commitChips';

const GITHUB_SHORT_SHA_LENGTH = 7;
// Padding, avatar, gap and about four characters.
const MIN_CHIP_LABEL_WIDTH_PX = 68;
const CHIP_TOP = `calc(50% - ${TRACK_CHIP_HEIGHT_PX / 2}px)`;
const CHIP_CLASS = cn('group text-foreground', TRACK_CHIP_CLASS);
const CHIP_SURFACE_CLASS = 'border-border bg-card group-hover:bg-surface-panel border transition-colors';

function commitDetails({ commit, atMs }: DatedCommit): string[] {
  const sha = commit.sha.slice(0, GITHUB_SHORT_SHA_LENGTH);
  return [commit.message, `${commit.author ?? 'Unknown author'} · ${sha}`, clockTime(atMs)];
}

function AuthorFaces({ authors }: { authors: CommitAuthor[] }) {
  const [onlyAuthor] = authors;
  if (onlyAuthor === undefined) {
    return <GitCommitHorizontal aria-hidden className="text-muted-foreground size-3.5 shrink-0" />;
  }
  if (authors.length === 1) return <Avatar name={onlyAuthor.name} src={onlyAuthor.avatarUrl} size="inline" />;
  return (
    <Avatar.Group size="inline" className="shrink-0">
      {authors.map(author => (
        <Avatar key={author.name} name={author.name} src={author.avatarUrl} />
      ))}
    </Avatar.Group>
  );
}

function SingleCommitChip({
  dated,
  authors,
  style,
  fade,
}: {
  dated: DatedCommit;
  authors: CommitAuthor[];
  style: CSSProperties;
  fade: EdgeFade;
}) {
  const details = commitDetails(dated);
  return (
    <Tooltip disableHoverablePopup>
      <TooltipTrigger
        render={
          <a
            href={dated.commit.url}
            target="_blank"
            rel="noreferrer"
            aria-label={`Commit ${details.join(', ')}`}
            className={CHIP_CLASS}
            style={style}
          >
            <TrackChipBody fade={fade} surfaceClassName={CHIP_SURFACE_CLASS}>
              <AuthorFaces authors={authors} />
              <Txt as="span" variant="caption" className="min-w-0 truncate">
                {dated.commit.message}
              </Txt>
            </TrackChipBody>
          </a>
        }
      />
      <DetailLinesTooltipContent lines={details} />
    </Tooltip>
  );
}

function ClusterCommitItems({ commits }: { commits: DatedCommit[] }) {
  return commits.toReversed().map(dated => (
    <DropdownMenu.Item
      key={dated.commit.sha}
      render={
        <a href={dated.commit.url} target="_blank" rel="noreferrer">
          <span className="min-w-0 flex-1 truncate">{dated.commit.message}</span>
          <Txt as="span" variant="caption" tone="muted" className="tabular-nums">
            {clockTime(dated.atMs)}
          </Txt>
        </a>
      }
    />
  ));
}

function CommitClusterChip({
  commits,
  authors,
  style,
  fade,
}: {
  commits: DatedCommit[];
  authors: CommitAuthor[];
  style: CSSProperties;
  fade: EdgeFade;
}) {
  return (
    <DropdownMenu>
      <DropdownMenu.Trigger
        render={<button type="button" aria-label={`${commits.length} commits`} className={CHIP_CLASS} style={style} />}
      >
        <TrackChipBody fade={fade} surfaceClassName={CHIP_SURFACE_CLASS}>
          <AuthorFaces authors={authors} />
          <Txt as="span" variant="caption" className="tabular-nums">
            {commits.length}
          </Txt>
        </TrackChipBody>
      </DropdownMenu.Trigger>
      <DropdownMenu.Content align="start" className="max-w-96">
        <ClusterCommitItems commits={commits} />
      </DropdownMenu.Content>
    </DropdownMenu>
  );
}

export function CommitMarks({
  commits,
  timeWindow,
  widthPx,
}: {
  commits: RepositoryCommit[];
  timeWindow: TimeWindow;
  widthPx: number;
}) {
  const dated = useMemo(() => datedCommits(commits), [commits]);
  return commitChips(dated, timeWindow, widthPx).map(chip => {
    const rightPx = chip.leftPx + chip.widthPx;
    const fade = edgeFade(chip.leftPx, rightPx, timeWindow, widthPx, MIN_CHIP_LABEL_WIDTH_PX);
    const style = trackChipStyle(CHIP_TOP, { leftPx: chip.leftPx, rightPx }, fade);
    const [first] = chip.commits;
    if (chip.commits.length === 1) {
      return <SingleCommitChip key={first.commit.sha} dated={first} authors={chip.authors} style={style} fade={fade} />;
    }
    return (
      <CommitClusterChip
        key={first.commit.sha}
        commits={chip.commits}
        authors={chip.authors}
        style={style}
        fade={fade}
      />
    );
  });
}

import { commitTimeMs } from '../../../../services/commits';
import type { RepositoryCommit } from '../../../../services/commits';
import { windowPercent } from '../time/timeViewport';
import type { TimeWindow } from '../time/timeViewport';
import { TRACK_CHIP_GAP_PX, liveEdgeLeftPx } from '../track/trackChipStyles';

// Padding, avatar, gap and two 12px tabular digits; closer neighbours fold into one chip.
const MIN_CHIP_WIDTH_PX = 52;
const MAX_CHIP_WIDTH_PX = 224;
// An `inline` avatar is 16px and each one in a group tucks a quarter under its neighbour.
const GROUPED_AVATAR_STEP_PX = 12;
const MAX_CHIP_AVATARS = 3;

export interface DatedCommit {
  commit: RepositoryCommit;
  atMs: number;
}

export interface CommitAuthor {
  name: string;
  avatarUrl: string | undefined;
}

interface CommitCluster {
  leftPx: number;
  commits: DatedCommit[];
}

interface CommitChip extends CommitCluster {
  widthPx: number;
  authors: CommitAuthor[];
}

export function datedCommits(commits: RepositoryCommit[]): DatedCommit[] {
  return commits
    .flatMap(commit => {
      const atMs = commitTimeMs(commit);
      return atMs === undefined ? [] : [{ commit, atMs }];
    })
    .sort((left, right) => left.atMs - right.atMs);
}

function distinctAuthors(commits: DatedCommit[]): CommitAuthor[] {
  const authorsByName = new Map<string, CommitAuthor>();
  for (const { commit } of commits) {
    if (commit.author === null || authorsByName.has(commit.author)) continue;
    authorsByName.set(commit.author, { name: commit.author, avatarUrl: commit.avatarUrl ?? undefined });
  }
  return [...authorsByName.values()];
}

function sizedChip(cluster: CommitCluster, roomPx: number): CommitChip {
  if (cluster.commits.length === 1) {
    return {
      ...cluster,
      authors: distinctAuthors(cluster.commits),
      widthPx: Math.max(MIN_CHIP_WIDTH_PX, Math.min(MAX_CHIP_WIDTH_PX, roomPx)),
    };
  }
  const avatarsThatFit = 1 + Math.floor((roomPx - MIN_CHIP_WIDTH_PX) / GROUPED_AVATAR_STEP_PX);
  const authors = distinctAuthors(cluster.commits).slice(0, Math.max(1, Math.min(MAX_CHIP_AVATARS, avatarsThatFit)));
  const extraAvatarsPx = Math.max(0, authors.length - 1) * GROUPED_AVATAR_STEP_PX;
  return { ...cluster, authors, widthPx: MIN_CHIP_WIDTH_PX + extraAvatarsPx };
}

export function commitChips(commits: DatedCommit[], timeWindow: TimeWindow, widthPx: number): CommitChip[] {
  if (widthPx === 0) return [];
  const clusters: CommitCluster[] = [];
  for (const dated of commits) {
    const atPx = (windowPercent(dated.atMs, timeWindow) / 100) * widthPx;
    const leftPx = liveEdgeLeftPx(atPx, MIN_CHIP_WIDTH_PX, timeWindow, widthPx);
    const last = clusters.at(-1);
    if (last !== undefined && leftPx - last.leftPx < MIN_CHIP_WIDTH_PX + TRACK_CHIP_GAP_PX) last.commits.push(dated);
    else clusters.push({ leftPx, commits: [dated] });
  }
  const lastChipEndPx = timeWindow.endsAtNow ? widthPx + TRACK_CHIP_GAP_PX : Infinity;
  const chips: CommitChip[] = [];
  clusters.forEach((cluster, index) => {
    const reachesView = cluster.leftPx + MAX_CHIP_WIDTH_PX > 0 && cluster.leftPx < widthPx;
    if (!reachesView) return;
    const roomPx = (clusters[index + 1]?.leftPx ?? lastChipEndPx) - cluster.leftPx - TRACK_CHIP_GAP_PX;
    const chip = sizedChip(cluster, roomPx);
    if (chip.leftPx + chip.widthPx > 0) chips.push(chip);
  });
  return chips;
}

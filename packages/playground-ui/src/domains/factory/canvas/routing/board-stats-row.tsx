import { Txt } from '@/ds/components/Txt';

export interface BoardStats {
  /** Items of the dry run's sample this board would take. */
  takes: number;
  /** Items its rules matched that a board earlier in the order took first. */
  lost: number;
  sampled: number;
}

/** What the board would have taken of the dry run's sample, and lost to boards earlier in the order. */
export function BoardStatsRow({ stats }: { stats: BoardStats }) {
  return (
    <li className="flex h-5.5 items-center justify-between gap-1.5">
      <Txt as="span" variant="caption" tone="muted">
        Last {stats.sampled} items
      </Txt>
      <Txt as="span" variant="caption" tone="muted">
        {stats.takes === 0 ? 'None land here' : `${stats.takes} land here`},{' '}
        {stats.lost === 0 ? 'none lost to earlier boards' : `${stats.lost} lost to earlier boards`}
      </Txt>
    </li>
  );
}

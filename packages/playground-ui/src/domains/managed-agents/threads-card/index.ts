import { ThreadFilterMenu } from './thread-filter-menu';
import { ThreadRow } from './thread-row';
import { ThreadsCardList } from './threads-card-list';
import { ThreadsCardRoot } from './threads-card-root';

export const ThreadsCard = Object.assign(ThreadsCardRoot, {
  List: ThreadsCardList,
  Row: ThreadRow,
  FilterMenu: ThreadFilterMenu,
});
export type { ThreadFilterAgent, ThreadFilterMenuProps, ThreadVisibilityFilter } from './thread-filter-menu';
export type { ThreadRowAgent, ThreadRowProps } from './thread-row';
export type { ThreadsCardListProps } from './threads-card-list';
export type { ThreadsCardProps } from './threads-card-root';

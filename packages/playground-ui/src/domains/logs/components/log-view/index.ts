import { LogViewList } from '../log-view-list';
import { LogsLevelToggles } from '../logs-level-toggles';
import { LogViewEmpty, LogViewFill } from './log-view-fill';
import { LogViewFilters } from './log-view-filters';
import {
  LogViewActions,
  LogViewCopy,
  LogViewCount,
  LogViewHeader,
  LogViewRefresh,
  LogViewTitle,
} from './log-view-header';
import { LogViewRoot } from './log-view-root';

export const LogView = Object.assign(LogViewRoot, {
  Header: LogViewHeader,
  Title: LogViewTitle,
  LevelToggles: LogsLevelToggles,
  Filters: LogViewFilters,
  Actions: LogViewActions,
  Count: LogViewCount,
  Copy: LogViewCopy,
  Refresh: LogViewRefresh,
  List: LogViewList,
  Empty: LogViewEmpty,
  Fill: LogViewFill,
});

export type { LogViewHeight, LogViewRootProps } from './log-view-root';
export type { LogViewRefreshProps } from './log-view-header';
export type { LogViewFiltersProps } from './log-view-filters';
export type { LogViewEmptyProps } from './log-view-fill';
export { LOG_VIEW_SEARCH_FIELD, filterLogsByFields, logViewSearchText } from './log-view-filter-fields';
export type { LogViewListHandle, LogViewListProps, LogViewNextPage, LogViewOrder } from '../log-view-list';

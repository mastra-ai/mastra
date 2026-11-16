import { SESSION_ROW_SORTS } from '@mastra/factory/routes/contracts';
import type { DropdownMenuRadioOption } from '@mastra/playground-ui/components/DropdownMenu';

export type SessionSort = (typeof SESSION_ROW_SORTS)[number];

export const DEFAULT_SESSION_SORT: SessionSort = 'activity';

const SESSION_SORT_LABELS: Record<SessionSort, string> = {
  activity: 'Activity',
  updated: 'Last updated',
  created: 'Last created',
};

export const SESSION_SORT_OPTIONS: readonly DropdownMenuRadioOption<SessionSort>[] = SESSION_ROW_SORTS.map(value => ({
  value,
  label: SESSION_SORT_LABELS[value],
}));

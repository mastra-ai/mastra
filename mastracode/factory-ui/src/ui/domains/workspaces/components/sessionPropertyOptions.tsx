import type { DropdownMenuRadioOption } from '@mastra/playground-ui/components/DropdownMenu';
import {
  Activity,
  CalendarDays,
  CalendarRange,
  CheckCircle2,
  Circle,
  CircleDashed,
  Clock3,
  Hand,
  History,
  Infinity,
  List,
  LoaderCircle,
  PlusCircle,
  SquareKanban,
  UserRound,
  UserRoundCheck,
  UsersRound,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

import {
  ALL_SESSION_OWNERS,
  MY_SESSIONS,
  SESSION_STATUS_OPTIONS,
  SESSION_UPDATED_OPTIONS,
  sessionOwnerOptions,
} from '../services/sessionFilters';
import { SESSION_GROUP_BY_OPTIONS } from '../services/sessionGroups';
import type { SessionListRow } from '../services/sessionRows';
import { SESSION_SORT_OPTIONS } from '../services/sessionSort';

function withIcons<V extends string>(options: readonly DropdownMenuRadioOption<V>[], icons: Record<V, LucideIcon>) {
  return options.map(option => {
    const Icon = icons[option.value];
    return { ...option, icon: <Icon aria-hidden /> };
  });
}

export const SESSION_SORT_MENU_OPTIONS = withIcons(SESSION_SORT_OPTIONS, {
  activity: Activity,
  updated: History,
  created: PlusCircle,
});

export const SESSION_STATUS_MENU_OPTIONS = withIcons(SESSION_STATUS_OPTIONS, {
  all: CircleDashed,
  waiting: Hand,
  working: Activity,
  initializing: LoaderCircle,
  idle: Circle,
  done: CheckCircle2,
});

export const SESSION_UPDATED_MENU_OPTIONS = withIcons(SESSION_UPDATED_OPTIONS, {
  all: Infinity,
  '24h': Clock3,
  '7d': CalendarDays,
  '30d': CalendarRange,
});

export const SESSION_GROUP_MENU_OPTIONS = withIcons(SESSION_GROUP_BY_OPTIONS, {
  board: SquareKanban,
  status: CircleDashed,
  owner: UsersRound,
  none: List,
});

const OWNER_ICONS: Partial<Record<string, LucideIcon>> = {
  [ALL_SESSION_OWNERS]: UsersRound,
  [MY_SESSIONS]: UserRoundCheck,
};

export function sessionOwnerMenuOptions(rows: readonly SessionListRow[], viewerUserId: string | undefined) {
  return sessionOwnerOptions(rows, viewerUserId).map(option => {
    const Icon = OWNER_ICONS[option.value] ?? UserRound;
    return { ...option, icon: <Icon aria-hidden /> };
  });
}

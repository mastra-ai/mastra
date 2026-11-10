import type { DropdownMenuRadioOption } from '@mastra/playground-ui/components/DropdownMenu';
import { CalendarRange, Circle, LoaderCircle, PlusCircle } from 'lucide-react';
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
import { IconCalendarDays } from '@mastra/playground-ui/icons/central/IconCalendarDays';
import { IconCheckCircle2 } from '@mastra/playground-ui/icons/central/IconCheckCircle2';
import { IconCircleDashed } from '@mastra/playground-ui/icons/central/IconCircleDashed';
import { IconElectrocardiogram } from '@mastra/playground-ui/icons/central/IconElectrocardiogram';
import { IconHistory } from '@mastra/playground-ui/icons/central/IconHistory';
import { IconInfinity } from '@mastra/playground-ui/icons/central/IconInfinity';
import { IconListBullets } from '@mastra/playground-ui/icons/central/IconListBullets';
import { IconUser } from '@mastra/playground-ui/icons/central/IconUser';
import { IconClock } from '@mastra/playground-ui/icons/central/IconClock';
import { IconHand5Finger } from '@mastra/playground-ui/icons/central/IconHand5Finger';
import { IconKanbanView } from '@mastra/playground-ui/icons/central/IconKanbanView';
import { IconUserAdded } from '@mastra/playground-ui/icons/central/IconUserAdded';
import { IconUserDuo } from '@mastra/playground-ui/icons/central/IconUserDuo';

function withIcons<V extends string>(options: readonly DropdownMenuRadioOption<V>[], icons: Record<V, LucideIcon>) {
  return options.map(option => {
    const Icon: LucideIcon = icons[option.value];
    return { ...option, icon: <Icon aria-hidden /> };
  });
}

export const SESSION_SORT_MENU_OPTIONS = withIcons(SESSION_SORT_OPTIONS, {
  activity: IconElectrocardiogram,
  updated: IconHistory,
  created: PlusCircle,
});

export const SESSION_STATUS_MENU_OPTIONS = withIcons(SESSION_STATUS_OPTIONS, {
  all: IconCircleDashed,
  waiting: IconHand5Finger,
  working: IconElectrocardiogram,
  initializing: LoaderCircle,
  idle: Circle,
  done: IconCheckCircle2,
});

export const SESSION_UPDATED_MENU_OPTIONS = withIcons(SESSION_UPDATED_OPTIONS, {
  all: IconInfinity,
  '24h': IconClock,
  '7d': IconCalendarDays,
  '30d': CalendarRange,
});

export const SESSION_GROUP_MENU_OPTIONS = withIcons(SESSION_GROUP_BY_OPTIONS, {
  board: IconKanbanView,
  status: IconCircleDashed,
  owner: IconUserDuo,
  none: IconListBullets,
});

const OWNER_ICONS: Partial<Record<string, LucideIcon>> = {
  [ALL_SESSION_OWNERS]: IconUserDuo,
  [MY_SESSIONS]: IconUserAdded,
};

export function sessionOwnerMenuOptions(rows: readonly SessionListRow[], viewerUserId: string | undefined) {
  return sessionOwnerOptions(rows, viewerUserId).map(option => {
    const Icon = OWNER_ICONS[option.value] ?? IconUser;
    return { ...option, icon: <Icon aria-hidden /> };
  });
}

import {
  SESSION_ROW_ALL_OWNERS,
  SESSION_ROW_ALL_SOURCES,
  SESSION_ROW_MY_SESSIONS,
} from '@mastra/factory/session/session-row-query';
import type { DropdownMenuRadioOption } from '@mastra/playground-ui/components/DropdownMenu';
import { SlackIcon } from '@mastra/playground-ui/icons/SlackIcon';
import type { LucideIcon } from 'lucide-react';
import type { ComponentType, SVGProps } from 'react';

import {
  SESSION_STATUS_OPTIONS,
  SESSION_UPDATED_OPTIONS,
  sessionOwnerOptions,
  sessionSourceOptions,
} from '../services/sessionFilters';
import { SESSION_GROUP_BY_OPTIONS } from '../services/sessionGroups';
import type { SessionGroupHeading, SessionGroupIcon } from '../services/sessionGroups';
import type { SessionOwner } from '../services/sessionRows';
import { SESSION_SORT_OPTIONS } from '../services/sessionSort';
import { IconCalendarDays } from '@mastra/playground-ui/icons/central/IconCalendarDays';
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
import { IconCirclePlus } from '@mastra/playground-ui/icons/central/IconCirclePlus';
import { IconCircleCheck } from '@mastra/playground-ui/icons/central/IconCircleCheck';
import { IconFormCircle } from '@mastra/playground-ui/icons/central/IconFormCircle';
import { IconLoadingCircle } from '@mastra/playground-ui/icons/central/IconLoadingCircle';

function withIcons<V extends string>(options: readonly DropdownMenuRadioOption<V>[], icons: Record<V, LucideIcon>) {
  return options.map(option => {
    const Icon: LucideIcon = icons[option.value];
    return { ...option, icon: <Icon aria-hidden /> };
  });
}

export const SESSION_SORT_MENU_OPTIONS = withIcons(SESSION_SORT_OPTIONS, {
  activity: IconElectrocardiogram,
  updated: IconHistory,
  created: IconCirclePlus,
});

export const SESSION_STATUS_MENU_OPTIONS = withIcons(SESSION_STATUS_OPTIONS, {
  all: IconCircleDashed,
  waiting: IconHand5Finger,
  working: IconElectrocardiogram,
  initializing: IconLoadingCircle,
  idle: IconFormCircle,
  done: IconCircleCheck,
});

export const SESSION_UPDATED_MENU_OPTIONS = withIcons(SESSION_UPDATED_OPTIONS, {
  all: IconInfinity,
  '24h': IconClock,
  '7d': IconCalendarDays,
  '30d': IconCalendarDays,
});

export const SESSION_GROUP_MENU_OPTIONS = withIcons(SESSION_GROUP_BY_OPTIONS, {
  board: IconKanbanView,
  status: IconCircleDashed,
  owner: IconUserDuo,
  none: IconListBullets,
});

const OWNER_ICONS: Partial<Record<string, LucideIcon>> = {
  [SESSION_ROW_ALL_OWNERS]: IconUserDuo,
  [SESSION_ROW_MY_SESSIONS]: IconUserAdded,
};

export function sessionOwnerMenuOptions(owners: readonly SessionOwner[], viewerUserId: string | undefined) {
  return sessionOwnerOptions(owners, viewerUserId).map(option => {
    const Icon = OWNER_ICONS[option.value] ?? IconUser;
    return { ...option, icon: <Icon aria-hidden /> };
  });
}

const SOURCE_ICONS: Partial<Record<SessionGroupIcon, ComponentType<SVGProps<SVGSVGElement>>>> = {
  board: IconKanbanView,
  user: IconUser,
  slack: SlackIcon,
};

export function sessionSourceMenuOptions(sources: readonly SessionGroupHeading[]) {
  const iconOf = new Map(sources.map(source => [source.key, SOURCE_ICONS[source.icon]]));
  return sessionSourceOptions(sources).map(option => {
    const Icon =
      option.value === SESSION_ROW_ALL_SOURCES ? IconListBullets : (iconOf.get(option.value) ?? IconKanbanView);
    return { ...option, icon: <Icon aria-hidden /> };
  });
}

import {
  CalendarClock,
  Clock,
  CornerDownRight,
  GitBranch,
  Layers,
  List,
  Network,
  PlayCircle,
  RefreshCw,
  Repeat,
  Repeat1,
  Timer,
  Workflow,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export const BADGE_COLORS = {
  sleep: '#A855F7',
  forEach: '#F97316',
  map: '#F97316',
  parallel: '#3B82F6',
  suspend: '#EC4899',
  after: '#14B8A6',
  workflow: '#8B5CF6',
  when: '#ECB047',
  dountil: '#8B5CF6',
  dowhile: '#06B6D4',
  until: '#F59E0B',
  while: '#10B981',
  if: '#3B82F6',
  else: '#6B7280',
} as const;

export const BADGE_ICONS = {
  sleep: Timer,
  sleepUntil: CalendarClock,
  forEach: List,
  map: List,
  parallel: Workflow,
  suspend: PlayCircle,
  after: Clock,
  workflow: Layers,
  when: Network,
  dountil: Repeat1,
  dowhile: Repeat,
  until: Timer,
  while: RefreshCw,
  if: GitBranch,
  else: CornerDownRight,
} as const;

export interface ConditionIconConfig {
  icon: LucideIcon | undefined;
  color: string | undefined;
}

export const getConditionIconAndColor = (type?: string): ConditionIconConfig => {
  switch (type) {
    case 'when':
      return { icon: BADGE_ICONS.when, color: BADGE_COLORS.when };
    case 'dountil':
      return { icon: BADGE_ICONS.dountil, color: BADGE_COLORS.dountil };
    case 'dowhile':
      return { icon: BADGE_ICONS.dowhile, color: BADGE_COLORS.dowhile };
    case 'until':
      return { icon: BADGE_ICONS.until, color: BADGE_COLORS.until };
    case 'while':
      return { icon: BADGE_ICONS.while, color: BADGE_COLORS.while };
    case 'if':
      return { icon: BADGE_ICONS.if, color: BADGE_COLORS.if };
    case 'else':
      return { icon: BADGE_ICONS.else, color: BADGE_COLORS.else };
    default:
      return { icon: undefined, color: undefined };
  }
};

export interface WorkflowNodeBadgeInfo {
  isSleepNode: boolean;
  isForEachNode: boolean;
  isMapNode: boolean;
  isNestedWorkflow: boolean;
  hasSpecialBadge: boolean;
}

export interface WorkflowCardBadgesProps {
  duration?: number;
  date?: Date;
  isForEach?: boolean;
  mapConfig?: string;
  canSuspend?: boolean;
  isParallel?: boolean;
  stepGraph?: unknown;
}

export const getNodeBadgeInfo = ({
  duration,
  date,
  isForEach,
  mapConfig,
  canSuspend,
  isParallel,
  stepGraph,
}: WorkflowCardBadgesProps): WorkflowNodeBadgeInfo => {
  const isSleepNode = Boolean(duration || date);
  const isForEachNode = Boolean(isForEach);
  const isMapNode = Boolean(mapConfig && !isForEach);
  const isNestedWorkflow = Boolean(stepGraph);
  const hasSpecialBadge =
    isSleepNode || Boolean(canSuspend || isParallel) || isForEachNode || isMapNode || isNestedWorkflow;

  return {
    isSleepNode,
    isForEachNode,
    isMapNode,
    isNestedWorkflow,
    hasSpecialBadge,
  };
};

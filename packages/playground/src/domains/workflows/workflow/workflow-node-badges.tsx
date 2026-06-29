import {
  Timer,
  CalendarClock,
  List,
  Workflow,
  PlayCircle,
  Network,
  Repeat,
  RefreshCw,
  GitBranch,
  CornerDownRight,
  Repeat1,
  Clock,
  Layers,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

// Badge colors for different node types
export const BADGE_COLORS = {
  sleep: '#A855F7', // Purple
  forEach: '#F97316', // Orange
  map: '#F97316', // Orange
  parallel: '#3B82F6', // Blue
  suspend: '#EC4899', // Pink
  after: '#14B8A6', // Teal
  workflow: '#8B5CF6', // Purple
  // Condition colors
  when: '#ECB047', // Orange
  dountil: '#8B5CF6', // Purple
  dowhile: '#06B6D4', // Cyan
  until: '#F59E0B', // Amber
  while: '#10B981', // Green
  if: '#3B82F6', // Blue
  else: '#6B7280', // Gray
} as const;

// Badge icons for different node types
export const BADGE_ICONS = {
  sleep: Timer,
  sleepUntil: CalendarClock,
  forEach: List,
  map: List,
  parallel: Workflow,
  suspend: PlayCircle,
  after: Clock,
  workflow: Layers,
  // Condition icons
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

export const getConditionIconAndColor = (type: string): ConditionIconConfig => {
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

export interface NodeBadgeInfo {
  isSleepNode: boolean;
  isForEachNode: boolean;
  isMapNode: boolean;
  isNestedWorkflow: boolean;
  hasSpecialBadge: boolean;
}

export const getNodeBadgeInfo = (data: {
  duration?: number;
  date?: Date;
  isForEach?: boolean;
  mapConfig?: string;
  canSuspend?: boolean;
  isParallel?: boolean;
  stepGraph?: any;
}): NodeBadgeInfo => {
  const isSleepNode = Boolean(data.duration || data.date);
  const isForEachNode = Boolean(data.isForEach);
  const isMapNode = Boolean(data.mapConfig && !data.isForEach);
  const isNestedWorkflow = Boolean(data.stepGraph);
  const hasSpecialBadge =
    isSleepNode || data.canSuspend || data.isParallel || isForEachNode || isMapNode || isNestedWorkflow;

  return {
    isSleepNode,
    isForEachNode,
    isMapNode,
    isNestedWorkflow,
    hasSpecialBadge,
  };
};

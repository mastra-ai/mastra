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

export interface WorkflowCardIndicator {
  id: string;
  label: string;
  icon: LucideIcon;
  color: string;
}

const CONDITION_LABELS: Record<string, string> = {
  when: 'When condition',
  dountil: 'Do until condition',
  dowhile: 'Do while condition',
  until: 'Until condition',
  while: 'While condition',
  if: 'If condition',
  else: 'Else condition',
  and: 'And condition',
  or: 'Or condition',
  not: 'Not condition',
};

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
    case 'and':
    case 'or':
    case 'not':
      return { icon: BADGE_ICONS.when, color: BADGE_COLORS.when };
    default:
      return { icon: undefined, color: undefined };
  }
};

export const getConditionIndicator = (type?: string): WorkflowCardIndicator | undefined => {
  const { icon, color } = getConditionIconAndColor(type);

  if (!type || !icon || !color) {
    return undefined;
  }

  return {
    id: `condition-${type}`,
    label: CONDITION_LABELS[type] ?? `${type} condition`,
    icon,
    color,
  };
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

export const getNodeIndicators = (props: WorkflowCardBadgesProps): WorkflowCardIndicator[] => {
  const { isSleepNode, isForEachNode, isMapNode, isNestedWorkflow } = getNodeBadgeInfo(props);
  const indicators: WorkflowCardIndicator[] = [];

  if (isSleepNode) {
    indicators.push({
      id: props.date ? 'sleep-until' : 'sleep',
      label: props.date ? 'Sleep until step' : 'Sleep step',
      icon: props.date ? BADGE_ICONS.sleepUntil : BADGE_ICONS.sleep,
      color: BADGE_COLORS.sleep,
    });
  }

  if (props.canSuspend) {
    indicators.push({
      id: 'suspend',
      label: 'Suspend/resume step',
      icon: BADGE_ICONS.suspend,
      color: BADGE_COLORS.suspend,
    });
  }

  if (props.isParallel) {
    indicators.push({
      id: 'parallel',
      label: 'Parallel step',
      icon: BADGE_ICONS.parallel,
      color: BADGE_COLORS.parallel,
    });
  }

  if (isNestedWorkflow) {
    indicators.push({
      id: 'workflow',
      label: 'Nested workflow step',
      icon: BADGE_ICONS.workflow,
      color: BADGE_COLORS.workflow,
    });
  }

  if (isForEachNode) {
    indicators.push({
      id: 'foreach',
      label: 'Foreach step',
      icon: BADGE_ICONS.forEach,
      color: BADGE_COLORS.forEach,
    });
  }

  if (isMapNode) {
    indicators.push({
      id: 'map',
      label: 'Map step',
      icon: BADGE_ICONS.map,
      color: BADGE_COLORS.map,
    });
  }

  return indicators;
};

export const getWorkflowCardAccentColor = (indicators: WorkflowCardIndicator[]): string | undefined =>
  indicators[0]?.color;

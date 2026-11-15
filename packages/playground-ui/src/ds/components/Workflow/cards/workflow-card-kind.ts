import { Workflow } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { WorkflowStepCardViewProps } from '../types';
import type { BadgeVariant } from '@/ds/components/Badge';
import { IconArrowRightLeft } from '@/ds/icons/central/IconArrowRightLeft';
import { IconArrowsRepeat } from '@/ds/icons/central/IconArrowsRepeat';
import { IconBranch } from '@/ds/icons/central/IconBranch';
import { IconCalendarClock } from '@/ds/icons/central/IconCalendarClock';
import { IconCodeBrackets } from '@/ds/icons/central/IconCodeBrackets';
import { IconFork } from '@/ds/icons/central/IconFork';
import { IconMaintenance } from '@/ds/icons/central/IconMaintenance';
import { IconRobot } from '@/ds/icons/central/IconRobot';
import { IconStopwatch } from '@/ds/icons/central/IconStopwatch';

export type WorkflowTypeBadgeProps = Pick<
  WorkflowStepCardViewProps,
  'nodeKind' | 'isForEach' | 'isNestedWorkflowStep' | 'stepGraph' | 'isParallel' | 'mapConfig' | 'date' | 'duration'
>;

export function getWorkflowCardBadge(props: WorkflowTypeBadgeProps): {
  label: string;
  Icon: LucideIcon;
  tone: BadgeVariant;
  indicator?: string;
} {
  if (props.isForEach) return { label: 'For each', tone: 'orange', Icon: IconArrowsRepeat, indicator: 'foreach' };
  if (props.isNestedWorkflowStep || props.stepGraph)
    return { label: 'Workflow', tone: 'purple', Icon: Workflow, indicator: 'workflow' };
  if (props.isParallel && !props.nodeKind)
    return { label: 'Parallel', tone: 'blue', Icon: IconFork, indicator: 'parallel' };
  if (props.nodeKind === 'map' || props.mapConfig)
    return { label: 'Map', tone: 'orange', Icon: IconArrowRightLeft, indicator: 'map' };
  if (props.nodeKind === 'wait-until' || props.date)
    return { label: 'Wait until', tone: 'purple', Icon: IconCalendarClock, indicator: 'sleep-until' };
  if (props.nodeKind === 'delay' || props.duration !== undefined)
    return { label: 'Delay', tone: 'purple', Icon: IconStopwatch, indicator: 'sleep' };
  if (props.nodeKind === 'agent') return { label: 'Agent', tone: 'cyan', Icon: IconRobot };
  if (props.nodeKind === 'tool') return { label: 'Tool', tone: 'pink', Icon: IconMaintenance };
  if (props.nodeKind === 'classifier') return { label: 'Classifier', tone: 'blue', Icon: IconBranch };
  return { label: 'Step', tone: 'neutral', Icon: IconCodeBrackets };
}

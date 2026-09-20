import { ArrowRightLeft, Bot, Braces, CalendarClock, GitFork, Repeat2, Timer, Workflow, Wrench } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { WorkflowStepCardViewProps } from '../types';
import type { BadgeVariant } from '@/ds/components/Badge';

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
  if (props.isForEach) return { label: 'For each', tone: 'orange', Icon: Repeat2, indicator: 'foreach' };
  if (props.isNestedWorkflowStep || props.stepGraph)
    return { label: 'Workflow', tone: 'purple', Icon: Workflow, indicator: 'workflow' };
  if (props.isParallel && !props.nodeKind)
    return { label: 'Parallel', tone: 'blue', Icon: GitFork, indicator: 'parallel' };
  if (props.nodeKind === 'map' || props.mapConfig)
    return { label: 'Map', tone: 'orange', Icon: ArrowRightLeft, indicator: 'map' };
  if (props.nodeKind === 'wait-until' || props.date)
    return { label: 'Wait until', tone: 'purple', Icon: CalendarClock, indicator: 'sleep-until' };
  if (props.nodeKind === 'delay' || props.duration !== undefined)
    return { label: 'Delay', tone: 'purple', Icon: Timer, indicator: 'sleep' };
  if (props.nodeKind === 'agent') return { label: 'Agent', tone: 'cyan', Icon: Bot };
  if (props.nodeKind === 'tool') return { label: 'Tool', tone: 'pink', Icon: Wrench };
  return { label: 'Step', tone: 'neutral', Icon: Braces };
}

import type { WorkflowRunStatus } from '@mastra/core/workflows';
import { Spinner } from '@mastra/playground-ui';
import { Check, CirclePause, CircleSlash, Clock, X } from 'lucide-react';

export interface WorkflowRunStatusInlineProps {
  status: WorkflowRunStatus;
}

/**
 * Compact inline run status — icon + colored label, no chip background.
 * Used in dense schedule rows + trigger history rows where filled badges
 * compete with surrounding text.
 */
export function WorkflowRunStatusInline({ status }: WorkflowRunStatusInlineProps) {
  const { icon, color } = getStatusVisual(status);
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap text-ui-sm ${color}`}>
      <span className="inline-flex shrink-0 items-center" aria-hidden>
        {icon}
      </span>
      <span>{status}</span>
    </span>
  );
}

function getStatusVisual(status: WorkflowRunStatus): { icon: React.ReactNode; color: string } {
  switch (status) {
    case 'success':
      return { icon: <Check size={14} />, color: 'text-accent1' };
    case 'failed':
      return { icon: <X size={14} />, color: 'text-accent2' };
    case 'running':
      return { icon: <Spinner />, color: 'text-neutral3' };
    case 'suspended':
      return { icon: <CirclePause size={14} />, color: 'text-accent3' };
    case 'canceled':
      return { icon: <CircleSlash size={14} />, color: 'text-neutral3' };
    case 'pending':
    case 'waiting':
      return { icon: <Clock size={14} />, color: 'text-neutral3' };
    default:
      return { icon: null, color: 'text-neutral3' };
  }
}

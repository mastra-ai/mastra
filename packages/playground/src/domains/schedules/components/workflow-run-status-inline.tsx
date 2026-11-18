import type { WorkflowRunStatus } from '@mastra/core/workflows';
import { Spinner } from '@mastra/playground-ui/components/Spinner';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { IconCheckmark2Medium } from '@mastra/playground-ui/icons/central/IconCheckmark2Medium';
import { IconCircleBanSign } from '@mastra/playground-ui/icons/central/IconCircleBanSign';
import { IconClock } from '@mastra/playground-ui/icons/central/IconClock';
import { IconCrossMedium } from '@mastra/playground-ui/icons/central/IconCrossMedium';
import { IconPause } from '@mastra/playground-ui/icons/central/IconPause';

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
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap ${color}`}>
      <span className="inline-flex shrink-0 items-center" aria-hidden>
        {icon}
      </span>
      <Txt as="span" variant="caption">
        {status}
      </Txt>
    </span>
  );
}

function getStatusVisual(status: WorkflowRunStatus): { icon: React.ReactNode; color: string } {
  switch (status) {
    case 'success':
      return { icon: <IconCheckmark2Medium className="size-icon-sm" />, color: 'text-success-indicator' };
    case 'failed':
      return { icon: <IconCrossMedium className="size-icon-sm" />, color: 'text-destructive-foreground' };
    case 'running':
      return { icon: <Spinner />, color: 'text-muted-foreground' };
    case 'suspended':
      return { icon: <IconPause className="size-icon-sm" />, color: 'text-info-indicator' };
    case 'canceled':
      return { icon: <IconCircleBanSign className="size-icon-sm" />, color: 'text-muted-foreground' };
    case 'pending':
    case 'waiting':
      return { icon: <IconClock className="size-icon-sm" />, color: 'text-muted-foreground' };
    default:
      return { icon: null, color: 'text-muted-foreground' };
  }
}

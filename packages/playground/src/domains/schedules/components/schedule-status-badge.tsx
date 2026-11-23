import type { ScheduleStatus } from '@mastra/client-js';
import { Txt } from '@mastra/playground-ui/components/Txt';

const STATUS_DOT_COLOR: Record<ScheduleStatus, string> = {
  active: 'bg-success-indicator',
  paused: 'bg-info-indicator',
  completed: 'bg-muted-foreground',
};

const STATUS_TEXT_COLOR: Record<ScheduleStatus, string> = {
  active: 'text-success-indicator',
  paused: 'text-info-indicator',
  completed: 'text-muted-foreground',
};

/**
 * Compact inline status — colored dot + label, no chip background.
 */
export const ScheduleStatusText = ({ status }: { status: ScheduleStatus }) => {
  return (
    <span className="inline-flex items-center gap-2 whitespace-nowrap">
      <span className={`h-1.5 w-1.5 rounded-full ${STATUS_DOT_COLOR[status]}`} aria-hidden />
      <Txt as="span" variant="caption" className={STATUS_TEXT_COLOR[status]}>
        {status}
      </Txt>
    </span>
  );
};

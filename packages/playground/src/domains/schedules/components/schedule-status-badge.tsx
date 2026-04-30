import type { ScheduleStatus } from '@mastra/client-js';

const STATUS_DOT_COLOR: Record<ScheduleStatus, string> = {
  active: 'bg-accent1',
  paused: 'bg-accent3',
};

const STATUS_TEXT_COLOR: Record<ScheduleStatus, string> = {
  active: 'text-accent1',
  paused: 'text-accent3',
};

/**
 * Compact inline status — colored dot + label, no chip background.
 */
export const ScheduleStatusText = ({ status }: { status: ScheduleStatus }) => {
  return (
    <span className="inline-flex items-center gap-2 whitespace-nowrap">
      <span className={`h-1.5 w-1.5 rounded-full ${STATUS_DOT_COLOR[status]}`} aria-hidden />
      <span className={`text-ui-sm ${STATUS_TEXT_COLOR[status]}`}>{status}</span>
    </span>
  );
};

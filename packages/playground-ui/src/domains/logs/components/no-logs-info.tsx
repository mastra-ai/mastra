import { format } from 'date-fns';
import { CircleSlashIcon, ExternalLinkIcon } from 'lucide-react';
import type { LogsDatePreset } from '../log-filters';
import { Button } from '@/ds/components/Button';
import { EmptyState } from '@/ds/components/EmptyState';

const PRESET_LABELS: Record<Exclude<LogsDatePreset, 'all' | 'custom'>, string> = {
  'last-24h': 'the last 24 hours',
  'last-3d': 'the last 3 days',
  'last-7d': 'the last 7 days',
  'last-14d': 'the last 14 days',
  'last-30d': 'the last 30 days',
};

export interface NoLogsInfoProps {
  datePreset?: LogsDatePreset;
  dateFrom?: Date;
  dateTo?: Date;
}

const DATE_FORMAT = 'MMM d, yyyy HH:mm';

const LEVEL_TIP = 'Pick a wider range or lower the logging level — verbose entries (debug, info) may be filtered out.';

function describeRange({ datePreset, dateFrom, dateTo }: NoLogsInfoProps): { title: string; description: string } {
  if (datePreset && datePreset !== 'all' && datePreset !== 'custom') {
    return {
      title: `No logs for ${PRESET_LABELS[datePreset]}`,
      description: LEVEL_TIP,
    };
  }
  if (dateFrom && dateTo) {
    return {
      title: `No logs between ${format(dateFrom, DATE_FORMAT)} and ${format(dateTo, DATE_FORMAT)}`,
      description: LEVEL_TIP,
    };
  }
  if (dateFrom) {
    return {
      title: `No logs since ${format(dateFrom, DATE_FORMAT)}`,
      description: LEVEL_TIP,
    };
  }
  return {
    title: 'No logs yet',
    description: 'Logs will appear here once agents, workflows, or tools are executed.',
  };
}

export const NoLogsInfo = ({ datePreset, dateFrom, dateTo }: NoLogsInfoProps = {}) => {
  const { title, description } = describeRange({ datePreset, dateFrom, dateTo });
  return (
    <div className="flex h-full items-center justify-center">
      <EmptyState
        iconSlot={<CircleSlashIcon />}
        titleSlot={title}
        descriptionSlot={description}
        actionSlot={
          <Button
            variant="ghost"
            as="a"
            href="https://mastra.ai/en/docs/observability/logging"
            target="_blank"
            rel="noopener noreferrer"
          >
            Logging Documentation <ExternalLinkIcon />
          </Button>
        }
      />
    </div>
  );
};

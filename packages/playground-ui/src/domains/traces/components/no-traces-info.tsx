import { format } from 'date-fns';
import { CircleSlashIcon, ExternalLinkIcon } from 'lucide-react';
import type { TraceDatePreset } from '../types';
import { Button } from '@/ds/components/Button';
import { EmptyState } from '@/ds/components/EmptyState';

const PRESET_LABELS: Record<Exclude<TraceDatePreset, 'all' | 'custom'>, string> = {
  'last-24h': 'the last 24 hours',
  'last-3d': 'the last 3 days',
  'last-7d': 'the last 7 days',
  'last-14d': 'the last 14 days',
  'last-30d': 'the last 30 days',
};

export interface NoTracesInfoProps {
  datePreset?: TraceDatePreset;
  dateFrom?: Date;
  dateTo?: Date;
}

const DATE_FORMAT = 'MMM d, yyyy HH:mm';

const RANGE_TIP = 'Pick a wider time range — older traces may fall outside the current window.';

function describeRange({ datePreset, dateFrom, dateTo }: NoTracesInfoProps): { title: string; description: string } {
  if (datePreset && datePreset !== 'all' && datePreset !== 'custom') {
    return {
      title: `No traces for ${PRESET_LABELS[datePreset]}`,
      description: RANGE_TIP,
    };
  }
  if (dateFrom && dateTo) {
    return {
      title: `No traces between ${format(dateFrom, DATE_FORMAT)} and ${format(dateTo, DATE_FORMAT)}`,
      description: RANGE_TIP,
    };
  }
  if (dateFrom) {
    return {
      title: `No traces since ${format(dateFrom, DATE_FORMAT)}`,
      description: RANGE_TIP,
    };
  }
  return {
    title: 'No traces yet',
    description: 'Traces will appear here once agents, workflows, or tools are executed.',
  };
}

export const NoTracesInfo = ({ datePreset, dateFrom, dateTo }: NoTracesInfoProps = {}) => {
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
            href="https://mastra.ai/en/docs/observability/tracing/overview"
            target="_blank"
            rel="noopener noreferrer"
          >
            Tracing Documentation <ExternalLinkIcon />
          </Button>
        }
      />
    </div>
  );
};

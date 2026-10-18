import type { TraceDatePreset } from '../types';
import { EmptyState } from '@/ds/components/EmptyState';
import { formatDate } from '@/utils/date-format';

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
      title: `No traces between ${formatDate(dateFrom, 'date-time')} and ${formatDate(dateTo, 'date-time')}`,
      description: RANGE_TIP,
    };
  }
  if (dateFrom) {
    return {
      title: `No traces since ${formatDate(dateFrom, 'date-time')}`,
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
  return <EmptyState titleSlot={title} descriptionSlot={description} variant="fill" />;
};

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
  /** What the empty list holds. Defaults to `traces`. */
  resource?: 'traces' | 'spans' | 'threads';
  datePreset?: TraceDatePreset;
  dateFrom?: Date;
  dateTo?: Date;
}

function describeRange({ resource = 'traces', datePreset, dateFrom, dateTo }: NoTracesInfoProps): {
  title: string;
  description: string;
} {
  const rangeTip = `Pick a wider time range — older ${resource} may fall outside the current window.`;
  if (datePreset && datePreset !== 'all' && datePreset !== 'custom') {
    return {
      title: `No ${resource} for ${PRESET_LABELS[datePreset]}`,
      description: rangeTip,
    };
  }
  if (dateFrom && dateTo) {
    return {
      title: `No ${resource} between ${formatDate(dateFrom, 'date-time')} and ${formatDate(dateTo, 'date-time')}`,
      description: rangeTip,
    };
  }
  if (dateFrom) {
    return {
      title: `No ${resource} since ${formatDate(dateFrom, 'date-time')}`,
      description: rangeTip,
    };
  }
  return {
    title: `No ${resource} yet`,
    description: `${resource.charAt(0).toUpperCase()}${resource.slice(1)} will appear here once agents, workflows, or tools are executed.`,
  };
}

export const NoTracesInfo = (props: NoTracesInfoProps = {}) => {
  const { title, description } = describeRange(props);
  return <EmptyState titleSlot={title} descriptionSlot={description} variant="fill" />;
};

import type { VolumeRow } from '@mastra/react/hooks/metrics';
import { HorizontalBars } from '../../../../ds/components/HorizontalBars/horizontal-bars';
import { MetricsCard } from '../../../../ds/components/MetricsCard/metrics-card';
import { CHART_COLORS } from '../metrics-utils';
import { formatCompactNumber } from '@/lib/cost';

export interface TracesVolumeBarsProps {
  rows: VolumeRow[];
  emptyMessage: string;
  onRowClick?: (row: VolumeRow) => void;
  onErrorSegmentClick?: (row: VolumeRow) => void;
}

export function TracesVolumeBars({ rows, emptyMessage, onRowClick, onErrorSegmentClick }: TracesVolumeBarsProps) {
  if (rows.length === 0) return <MetricsCard.NoData message={emptyMessage} />;

  return (
    <HorizontalBars
      data={rows.map(row => {
        const values = [row.completed, row.errors];
        // A row-level click swallows segment clicks, so split navigation across
        // segments when the errors segment has its own target.
        if (onErrorSegmentClick) {
          return {
            name: row.name,
            values,
            onClicks: [onRowClick ? () => onRowClick(row) : undefined, () => onErrorSegmentClick(row)],
          };
        }
        return { name: row.name, values, onClick: onRowClick ? () => onRowClick(row) : undefined };
      })}
      segments={[
        { label: 'Completed', color: CHART_COLORS.blueDark },
        { label: 'Errors', color: CHART_COLORS.pink },
      ]}
      maxVal={Math.max(...rows.map(row => row.completed + row.errors))}
      fmt={formatCompactNumber}
    />
  );
}

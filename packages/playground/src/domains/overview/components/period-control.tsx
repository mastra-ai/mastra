import { SegmentedControl, SegmentedControlItem } from '@mastra/playground-ui/components/SegmentedControl';
import { overviewRanges } from '../overview-period';
import type { OverviewRange } from '../overview-period';

export function PeriodControl({
  range,
  onRangeChange,
}: {
  range: OverviewRange;
  onRangeChange: (range: OverviewRange) => void;
}) {
  return (
    <SegmentedControl aria-label="Period" size="sm" value={range} onValueChange={onRangeChange}>
      {overviewRanges.map(option => (
        <SegmentedControlItem key={option} value={option}>
          {option}
        </SegmentedControlItem>
      ))}
    </SegmentedControl>
  );
}

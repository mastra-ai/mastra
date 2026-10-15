import { ChevronDownIcon } from 'lucide-react';
import { TRACE_GROUP_BY_DIMENSION_LABELS } from '../trace-group-by';
import type { TraceGroupByDimension } from '../trace-group-by';
import { Button } from '@/ds/components/Button';
import { DropdownMenu } from '@/ds/components/DropdownMenu';

const NONE = 'none';

export interface TracesGroupByMenuProps {
  /** The active dimension; undefined shows the trace list. */
  value: TraceGroupByDimension | undefined;
  /** Dimensions to offer, from `getOfferedTraceGroupByDimensions`. */
  dimensions: readonly TraceGroupByDimension[];
  onChange: (dimension: TraceGroupByDimension | undefined) => void;
  /** Disables the menu and explains why, e.g. in a list mode the grouped view can't represent. */
  disabledReason?: string;
}

/** "Group by" switcher for the Traces table: the trace list, or one row per value of a dimension. */
export function TracesGroupByMenu({ value, dimensions, onChange, disabledReason }: TracesGroupByMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenu.Trigger asChild>
        <Button
          size="md"
          variant="default"
          disabled={!!disabledReason}
          tooltip={disabledReason}
          icon={<ChevronDownIcon />}
        >
          Group by: {value ? TRACE_GROUP_BY_DIMENSION_LABELS[value] : 'None'}
        </Button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Content align="start">
        <DropdownMenu.RadioGroup
          value={value ?? NONE}
          onValueChange={next => onChange(dimensions.find(dimension => dimension === next))}
        >
          <DropdownMenu.RadioItem value={NONE}>None</DropdownMenu.RadioItem>
          {dimensions.map(dimension => (
            <DropdownMenu.RadioItem key={dimension} value={dimension}>
              {TRACE_GROUP_BY_DIMENSION_LABELS[dimension]}
            </DropdownMenu.RadioItem>
          ))}
        </DropdownMenu.RadioGroup>
      </DropdownMenu.Content>
    </DropdownMenu>
  );
}

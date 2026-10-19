import { Columns3Icon } from 'lucide-react';
import { Fragment } from 'react';
import { TRACE_GROUP_BY_MEASURE_LABELS, TRACE_GROUP_COLUMN_SECTIONS } from '../trace-group-by';
import type { TraceGroupByMeasure } from '../trace-group-by';
import { Button } from '@/ds/components/Button';
import { DropdownMenu } from '@/ds/components/DropdownMenu';

type TraceGroupColumnsMenuProps = {
  /** Visible measure columns. */
  columns: readonly TraceGroupByMeasure[];
  /** Measures the server can compute, from `getOfferedTraceGroupColumns`. */
  offered: readonly TraceGroupByMeasure[];
  onToggleColumn: (measure: TraceGroupByMeasure) => void;
  onReset: () => void;
};

/** Columns menu of the grouped Traces view: pick which measures each group shows. */
export function TraceGroupColumnsMenu({ columns, offered, onToggleColumn, onReset }: TraceGroupColumnsMenuProps) {
  const sections = TRACE_GROUP_COLUMN_SECTIONS.map(section => ({
    ...section,
    measures: section.measures.filter(measure => offered.includes(measure)),
  })).filter(section => section.measures.length > 0);

  return (
    <DropdownMenu>
      <DropdownMenu.Trigger
        render={
          <Button variant="ghost" size="md" icon={<Columns3Icon aria-hidden />}>
            Columns
          </Button>
        }
      />
      <DropdownMenu.Content align="end" className="max-h-[70vh] min-w-56 overflow-y-auto">
        {sections.map((section, index) => (
          <Fragment key={section.label}>
            {index > 0 && <DropdownMenu.Separator />}
            <DropdownMenu.Label>{section.label}</DropdownMenu.Label>
            {section.measures.map(measure => (
              <DropdownMenu.CheckboxItem
                key={measure}
                checked={columns.includes(measure)}
                // Every group has a trace count; it anchors the table and the default sort.
                disabled={measure === 'count'}
                onCheckedChange={() => onToggleColumn(measure)}
              >
                {TRACE_GROUP_BY_MEASURE_LABELS[measure]}
              </DropdownMenu.CheckboxItem>
            ))}
          </Fragment>
        ))}
        <DropdownMenu.Separator />
        <DropdownMenu.Item onSelect={onReset}>Reset to defaults</DropdownMenu.Item>
      </DropdownMenu.Content>
    </DropdownMenu>
  );
}

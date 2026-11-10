import { Button } from '@mastra/playground-ui/components/Button';
import { DropdownMenu } from '@mastra/playground-ui/components/DropdownMenu';
import { IconColumns3 } from '@mastra/playground-ui/icons/central/IconColumns3';
import { COLUMN_LABELS, TOGGLEABLE_COLUMNS } from '../hooks/use-scores-columns';
import type { ScoresColumnsState } from '../hooks/use-scores-columns';

export function ScoresColumnsMenu({ visibleColumns, toggleColumn }: Omit<ScoresColumnsState, 'columns'>) {
  return (
    <DropdownMenu>
      <DropdownMenu.Trigger asChild>
        <Button icon={<IconColumns3 />}>Columns</Button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Content align="end">
        <DropdownMenu.Label>Toggle columns</DropdownMenu.Label>
        {TOGGLEABLE_COLUMNS.map(col => (
          <DropdownMenu.CheckboxItem key={col} checked={visibleColumns.has(col)} onClick={() => toggleColumn(col)}>
            {COLUMN_LABELS[col]}
          </DropdownMenu.CheckboxItem>
        ))}
      </DropdownMenu.Content>
    </DropdownMenu>
  );
}

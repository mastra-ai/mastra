import { Button } from '@mastra/playground-ui/components/Button';
import { DropdownMenu } from '@mastra/playground-ui/components/DropdownMenu';
import { Columns3Icon } from 'lucide-react';
import { COLUMN_LABELS, TOGGLEABLE_COLUMNS } from '../hooks/use-scores-columns';
import type { ScoresColumnsState } from '../hooks/use-scores-columns';

export function ScoresColumnsMenu({ visibleColumns, toggleColumn }: Omit<ScoresColumnsState, 'columns'>) {
  return (
    <DropdownMenu>
      <DropdownMenu.Trigger asChild>
        <Button>
          <Columns3Icon />
          Columns
        </Button>
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

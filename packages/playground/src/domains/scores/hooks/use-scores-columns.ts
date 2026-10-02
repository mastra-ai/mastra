import { useCallback, useMemo, useState } from 'react';

export type ToggleableColumn = 'input' | 'entity';

export const TOGGLEABLE_COLUMNS: ToggleableColumn[] = ['input', 'entity'];

export const COLUMN_LABELS: Record<ToggleableColumn, string> = {
  input: 'Input',
  entity: 'Entity',
};

function buildColumns(visible: Set<ToggleableColumn>): string {
  const parts: string[] = ['auto', 'auto', 'minmax(0, 10rem)'];
  if (visible.has('entity')) parts.push('minmax(0, 14rem)');
  if (visible.has('input')) parts.push('minmax(0, 40rem)');
  return parts.join(' ');
}

export type ScoresColumnsState = {
  visibleColumns: Set<ToggleableColumn>;
  columns: string;
  toggleColumn: (col: ToggleableColumn) => void;
};

export function useScoresColumns(): ScoresColumnsState {
  const [hiddenColumns, setHiddenColumns] = useState<Set<ToggleableColumn>>(new Set());
  const visibleColumns = useMemo(
    () => new Set<ToggleableColumn>(TOGGLEABLE_COLUMNS.filter(c => !hiddenColumns.has(c))),
    [hiddenColumns],
  );
  const columns = useMemo(() => buildColumns(visibleColumns), [visibleColumns]);

  const toggleColumn = useCallback((col: ToggleableColumn) => {
    setHiddenColumns(prev => {
      const next = new Set(prev);
      if (next.has(col)) next.delete(col);
      else next.add(col);
      return next;
    });
  }, []);

  return { visibleColumns, columns, toggleColumn };
}

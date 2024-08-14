import { CellContext } from '@tanstack/react-table';

import { IconName } from '@/types/icons';

import { CellComponent } from './cell-component';
import { HeaderCell } from './header-cell';

export const fieldTypeToIconMap: Record<string, string> = {
  SINGLE_LINE_TEXT: 'text',
};

export const createColumnDef = ({ fields }: { fields: any[] }) => {
  const columnDef = fields.slice().map((field, index) => {
    const { name, displayName, type, id } = field;

    return {
      id,
      header: <HeaderCell icon={fieldTypeToIconMap[type] as IconName} header={displayName} />,
      cell: (cellContext: CellContext<any, unknown>) => {
        return <CellComponent field={field} cellContext={cellContext} index={index} />;
      },
      accessorKey: name,
      field,
      index,
      minSize: index === 0 ? 200 : 50,
    };
  });

  return columnDef;
};

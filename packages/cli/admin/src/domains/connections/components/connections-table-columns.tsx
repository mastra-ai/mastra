import { ColumnDef } from '@tanstack/react-table';

import { Text } from '@/components/ui/text';

import { formatDate } from '@/lib/date';

import { IntegrationConnection } from '@/domains/integrations/types';
import { HeaderCell } from '@/domains/records/components/columns/header-cell';

export const connectionsTableColumns = (): ColumnDef<IntegrationConnection>[] => [
  {
    id: 'reference',
    header: () => <HeaderCell header="Reference" />,
    cell: ({ row }) => {
      const { connectionId } = row.original;

      return (
        <div className="p-3">
          <Text size="sm" className="text-mastra-el-5">
            {connectionId}
          </Text>
        </div>
      );
    },
  },
  {
    id: 'date',
    header: () => <HeaderCell header="Connection Date" />,
    cell: ({ row }) => {
      const { createdAt } = row.original;
      return (
        <div className="p-3">
          <Text size="sm" className="text-mastra-el-5">
            {formatDate(createdAt, { month: '2-digit', year: 'numeric' })}
          </Text>
        </div>
      );
    },
  },
];

'use client';

import { useState } from 'react';

import { useConnections } from '@/domains/integrations/hooks/use-integration';
import { RecordTable } from '@/domains/records/components/record-table';
import { TableProvider } from '@/domains/records/context/table-context';

import { connectionsTableColumns } from './connections-table-columns';

const ConnectionsTable = ({ integrationName }: { integrationName: string }) => {
  const [rowSelection, setRowSelection] = useState({});
  const { connections } = useConnections({ name: integrationName });
  const columnDefs = connectionsTableColumns();

  return (
    <TableProvider
      rowSelection={rowSelection}
      setRowSelection={setRowSelection}
      columns={columnDefs}
      data={connections || []}
    >
      <RecordTable />
    </TableProvider>
  );
};

export default ConnectionsTable;

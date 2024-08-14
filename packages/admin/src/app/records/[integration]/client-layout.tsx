'use client';

import { createColumnDef } from '@/domains/records/columns/column-def';
import { TableProvider } from '@/domains/records/context/table-context';
import { RecordTable } from '@/domains/records/record-table';

export function ClientLayout({ integration, fields, data }: { integration: string; fields: any[]; data: any[] }) {
  const cols: any[] = fields ? createColumnDef({ fields }) : [];

  return (
    <section>
      <h1 className="text-sm gradient h-fit capitalize border-b-[0.5px] py-2 border-primary-border p-4">
        {integration}
      </h1>
      <TableProvider columns={cols} data={data}>
        <RecordTable />
      </TableProvider>
    </section>
  );
}

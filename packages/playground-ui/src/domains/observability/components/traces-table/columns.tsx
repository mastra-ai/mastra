import { Cell, TxtCell, DateTimeCell } from '@/ds/components/Table';
import { StatusBadge } from '@/ds/components/StatusBadge';
import { getShortId } from '@/ds/components/Text';
import { ColumnDef, Row } from '@tanstack/react-table';
import { TraceTableColumn } from './types';

const IdCell = ({ row }: { row: Row<TraceTableColumn> }) => {
  const shortId = getShortId(row.original.traceId) || 'n/a';
  return <TxtCell>{shortId}</TxtCell>;
};

const DateCell = ({ row }: { row: Row<TraceTableColumn> }) => {
  const createdAt = new Date(row.original.createdAt);
  return <DateTimeCell dateTime={createdAt} />;
};

const NameCell = ({ row }: { row: Row<TraceTableColumn> }) => {
  return <TxtCell>{row.original.name}</TxtCell>;
};

const EntityCell = ({ row }: { row: Row<TraceTableColumn> }) => {
  const entityName =
    row.original.entityName ||
    row.original.entityId ||
    row.original.attributes?.agentId ||
    row.original.attributes?.workflowId;
  return <TxtCell>{entityName}</TxtCell>;
};

const StatusCell = ({ row }: { row: Row<TraceTableColumn> }) => {
  const status = row.original.attributes?.status;

  const getStatusVariant = (status: string | undefined) => {
    switch (status) {
      case 'success':
      case 'ok':
        return 'success';
      case 'error':
      case 'failed':
        return 'error';
      case 'pending':
      case 'running':
        return 'info';
      default:
        return 'neutral';
    }
  };

  if (!status) {
    return <TxtCell>-</TxtCell>;
  }

  return (
    <Cell>
      <StatusBadge variant={getStatusVariant(status)} size="sm" withDot>
        {status}
      </StatusBadge>
    </Cell>
  );
};

export const columns: ColumnDef<TraceTableColumn>[] = [
  {
    header: 'ID',
    accessorKey: 'traceId',
    cell: IdCell,
    size: 100,
  },
  {
    header: 'Date & Time',
    accessorKey: 'createdAt',
    cell: DateCell,
    size: 140,
  },
  {
    header: 'Name',
    accessorKey: 'name',
    cell: NameCell,
  },
  {
    header: 'Entity',
    accessorKey: 'entityId',
    cell: EntityCell,
    size: 160,
  },
  {
    header: 'Status',
    accessorKey: 'status',
    cell: StatusCell,
    size: 100,
  },
];

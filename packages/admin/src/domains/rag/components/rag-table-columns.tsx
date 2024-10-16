'use client';

import { Row } from '@tanstack/react-table';

import IconButton from '@/components/ui/icon-button';
import { Text } from '@/components/ui/text';

import { useCopyToClipboard } from '@/lib/hooks/useCopyToClipboard';

import { VectorIndex } from '../types';

const Cell = ({ name }: { name: string | number }) => {
  return (
    <Text size="sm" weight="medium" className="text-mastra-el-5">
      {name}
    </Text>
  );
};

const HostCell = ({ name }: { name: string }) => {
  const [_, copy, copied] = useCopyToClipboard();
  return (
    <div className="flex items-center gap-2">
      <Text size="sm" weight="medium" className="text-mastra-el-5">
        {name}
      </Text>
      <IconButton
        icon={copied ? 'check-in-circle' : 'copy'}
        size="sm"
        className="p-0 hover:text-mastra-el-accent"
        onClick={() => {
          if (!copied) copy(name);
        }}
      />
    </div>
  );
};

export const ragTableColumns = [
  {
    id: 'name',
    header: 'Name',
    cell: ({ row }: { row: Row<VectorIndex> }) => {
      return <Cell name={row.original.name} />;
    },
  },
  {
    id: 'host',
    header: 'Host',
    cell: ({ row }: { row: Row<VectorIndex> }) => {
      return <HostCell name={row.original.host} />;
    },
  },
  {
    id: 'metric',
    header: 'Metric',
    cell: ({ row }: { row: Row<VectorIndex> }) => {
      return <Cell name={row.original.metric} />;
    },
  },
  {
    id: 'dimension',
    header: 'Dimenstion',
    cell: ({ row }: { row: Row<VectorIndex> }) => {
      return <Cell name={row.original.dimension} />;
    },
  },
];

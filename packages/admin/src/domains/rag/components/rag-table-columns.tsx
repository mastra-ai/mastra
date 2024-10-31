'use client';

import { Row } from '@tanstack/react-table';

import IconButton from '@/components/ui/icon-button';
import { Text } from '@/components/ui/text';

import { useCopyToClipboard } from '@/lib/hooks/useCopyToClipboard';

import { RagMetadata, VectorIndexWithMetadata } from '../types';

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
        Pinecone
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

const EntityTypeCell = ({ metadata }: { metadata: RagMetadata }) => {
  return (
    <Text size="xs" className="text-mastra-el-5 truncate max-w-[175px] bg-mastra-bg-5 w-fit rounded-full px-2 py-1">
      {metadata.name} {'>'} {metadata.fields.map(field => field)}
    </Text>
  );
};

const SourceCell = ({ name }: { name: string }) => {
  return (
    <Text size="xs" className="text-mastra-el-5 capitalize w-fit">
      {name}
    </Text>
  );
};

export const ragTableColumns = [
  {
    id: 'name',
    header: 'Name',
    cell: ({ row }: { row: Row<VectorIndexWithMetadata> }) => {
      return <Cell name={row.original.name} />;
    },
  },
  {
    id: 'vector-provider',
    header: 'Vector Provider',
    cell: ({ row }: { row: Row<VectorIndexWithMetadata> }) => {
      return <HostCell name={row.original.host} />;
    },
  },
  {
    id: 'source',
    header: 'Source',
    cell: ({ row }: { row: Row<VectorIndexWithMetadata> }) => {
      return <SourceCell name={row.original.metadata.integration} />;
    },
  },
  {
    id: 'entity-type',
    header: 'Entity Type',
    cell: ({ row }: { row: Row<VectorIndexWithMetadata> }) => {
      return <EntityTypeCell metadata={row.original.metadata} />;
    },
  },
];

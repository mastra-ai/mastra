import { Badge, EntryCell } from '@mastra/playground-ui';
import type { ColumnDef, Row } from '@tanstack/react-table';
import type { PromptBlockTableData } from './types';
import { useLinkComponent } from '@/lib/framework';

const NameCell = ({ row }: { row: Row<PromptBlockTableData> }) => {
  const { Link, paths } = useLinkComponent();
  const block = row.original;

  return (
    <EntryCell
      name={
        <Link className="w-full space-y-0" href={paths.cmsPromptBlockEditLink(block.id)}>
          {block.name}
        </Link>
      }
      description={block.description}
      meta={
        <>
          {block.activeVersionId && <Badge variant="success">Published</Badge>}
          {(block.hasDraft || !block.activeVersionId) && <Badge variant="info">Draft</Badge>}
        </>
      }
    />
  );
};

export const columns: ColumnDef<PromptBlockTableData>[] = [
  {
    header: 'Name',
    accessorKey: 'name',
    cell: NameCell,
  },
];

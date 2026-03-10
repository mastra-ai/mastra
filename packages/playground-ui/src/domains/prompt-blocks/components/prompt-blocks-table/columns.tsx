import { Badge } from '@/ds/components/Badge';
import { EntryCell } from '@/ds/components/Table';
import { ColumnDef, Row } from '@tanstack/react-table';
import { useLinkComponent } from '@/lib/framework';
import { PromptBlockTableData } from './types';

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

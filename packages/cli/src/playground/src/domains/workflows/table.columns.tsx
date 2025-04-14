import { Badge, Button, Cell, EntryCell, Icon, WorkflowIcon } from '@mastra/playground-ui';
import { Footprints } from 'lucide-react';
import { Link } from 'react-router';

const NameCell = ({ row }: { row: any }) => {
  return <EntryCell icon={<WorkflowIcon />} name={row.original.name} />;
};

export const workflowsTableColumns = [
  {
    id: 'name',
    header: 'Name',
    cell: NameCell,
    meta: {
      width: 'auto',
    },
  },
  {
    id: 'action',
    header: 'Action',
    size: 300,
    cell: ({ row }) => (
      <Cell>
        <div className="flex justify-end items-center gap-2">
          <Badge icon={<Footprints />}>
            {row.original.stepsCount} step{row.original.stepsCount > 1 ? 's' : ''}
          </Badge>

          <Button as={Link} to={`/workflows/${row.original.id}/graph`}>
            <Icon>
              <WorkflowIcon />
            </Icon>
            View Workflow
          </Button>
        </div>
      </Cell>
    ),
  },
];

import { Badge } from '@/ds/components/Badge';
import { Cell, EntryCell } from '@/ds/components/Table';
import { ColumnDef, Row } from '@tanstack/react-table';
import { AgentIcon } from '@/ds/icons/AgentIcon';
import { CodeIcon, Trash2, Loader2 } from 'lucide-react';
import { ToolCoinIcon } from '@/ds/icons/ToolCoinIcon';
import { Button } from '@/ds/components/Button';
import { AlertDialog } from '@/ds/components/AlertDialog';
import { useState } from 'react';

import { ToolWithAgents } from '../../utils/prepareToolsTable';
import { useLinkComponent } from '@/lib/framework';
import { useIntegrationMutations } from '@/domains/integrations/hooks';
import { toast } from '@/lib/toast';

const NameCell = ({ row }: { row: Row<ToolWithAgents> }) => {
  const { Link, paths } = useLinkComponent();

  const tool = row.original;

  return (
    <EntryCell
      name={
        <Link className="w-full space-y-0" href={paths.toolLink(tool.id)}>
          {tool.id}
        </Link>
      }
      description={tool.description}
    />
  );
};

export const columns: ColumnDef<ToolWithAgents>[] = [
  {
    header: 'Name',
    accessorKey: 'name',
    cell: NameCell,
  },
  {
    header: 'Source',
    accessorKey: 'source',
    cell: ({ row }) => {
      const tool = row.original;
      const source = (tool as any).source || 'code';

      const isCodeTool = source === 'code';

      return (
        <Cell>
          <Badge
            variant={isCodeTool ? 'default' : 'success'}
            icon={isCodeTool ? <CodeIcon size={14} /> : <ToolCoinIcon />}
          >
            {source}
          </Badge>
        </Cell>
      );
    },
  },
  {
    header: 'Attached entities',
    accessorKey: 'attachedEntities',
    cell: ({ row }) => {
      const tool = row.original;

      const agentsCount = tool.agents.length;

      return (
        <Cell>
          <Badge variant="default" icon={<AgentIcon className="text-accent1" />}>
            {agentsCount} agent{agentsCount > 1 ? 's' : ''}
          </Badge>
        </Cell>
      );
    },
  },
  {
    header: '',
    id: 'actions',
    size: 50,
    cell: ({ row }) => {
      const tool = row.original as ToolWithAgents & {
        integrationId?: string;
        cachedToolId?: string;
      };
      const integrationId = tool.integrationId;
      const cachedToolId = tool.cachedToolId;

      // Only show delete button for integration tools that have a cachedToolId
      if (!integrationId || !cachedToolId) {
        return (
          <Cell>
            <span />
          </Cell>
        );
      }

      return <DeleteToolCell integrationId={integrationId} cachedToolId={cachedToolId} />;
    },
  },
];

export type DeleteToolCellProps = {
  integrationId: string;
  cachedToolId: string;
};

const DeleteToolCell = ({ integrationId, cachedToolId }: DeleteToolCellProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const { deleteTool } = useIntegrationMutations(integrationId);

  const handleTriggerClick = (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent row click navigation
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await deleteTool.mutateAsync({ toolId: cachedToolId });
      toast.success('Tool removed successfully');
      setIsOpen(false);
    } catch (error) {
      toast.error(`Failed to remove tool: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <Cell>
      <AlertDialog open={isOpen} onOpenChange={setIsOpen}>
        <AlertDialog.Trigger asChild>
          <Button
            variant="ghost"
            size="md"
            onClick={handleTriggerClick}
            disabled={isDeleting}
            className="text-icon3 hover:text-destructive1 p-1"
            title="Remove tool"
          >
            {isDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
          </Button>
        </AlertDialog.Trigger>
        <AlertDialog.Content onClick={e => e.stopPropagation()}>
          <AlertDialog.Header>
            <AlertDialog.Title>Remove Tool</AlertDialog.Title>
            <AlertDialog.Description>
              Are you sure you want to remove this tool from the integration? The integration will remain active with
              its other tools.
            </AlertDialog.Description>
          </AlertDialog.Header>
          <AlertDialog.Footer>
            <AlertDialog.Cancel disabled={isDeleting}>Cancel</AlertDialog.Cancel>
            <AlertDialog.Action
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-destructive1 hover:bg-destructive1/90"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Removing...
                </>
              ) : (
                'Remove'
              )}
            </AlertDialog.Action>
          </AlertDialog.Footer>
        </AlertDialog.Content>
      </AlertDialog>
    </Cell>
  );
};

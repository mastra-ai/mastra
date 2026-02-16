import { useState } from 'react';
import { PlusIcon, XIcon } from 'lucide-react';

import { Icon, McpServerIcon } from '@/ds/icons';
import { Txt } from '@/ds/components/Txt';
import { Button } from '@/ds/components/Button';
import { Badge } from '@/ds/components/Badge';
import { Skeleton } from '@/ds/components/Skeleton';
import { Entity, EntityContent, EntityDescription, EntityName, EntityIcon } from '@/ds/components/Entity';
import { SideDialog } from '@/ds/components/SideDialog';
import { toast } from '@/lib/toast';

import { useStoredMCPClients, useStoredMCPClientMutations } from '../../hooks/use-stored-mcp-clients';
import { MCPClientCreateContent } from '../mcp-client-create';

export function MCPClientList() {
  const { data, isLoading } = useStoredMCPClients();
  const { deleteStoredMCPClient } = useStoredMCPClientMutations();
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  const handleDelete = async (id: string) => {
    try {
      await deleteStoredMCPClient.mutateAsync(id);
      toast.success('MCP client removed');
    } catch (error) {
      toast.error(`Failed to remove MCP client: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const clients = data?.mcpClients ?? [];

  return (
    <div className="flex flex-col gap-4 pb-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon size="lg" className="bg-surface4 rounded-md p-1 text-neutral6">
            <McpServerIcon />
          </Icon>
          <Txt variant="header-md" as="h2" className="font-medium text-neutral6">
            MCP Clients
          </Txt>
          {!isLoading && <Badge>{clients.length}</Badge>}
        </div>
        <Button variant="outline" size="sm" onClick={() => setIsCreateOpen(true)}>
          <PlusIcon className="h-3 w-3 mr-1" />
          Add MCP Client
        </Button>
      </div>

      {isLoading && (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-16 w-full rounded-lg" />
          <Skeleton className="h-16 w-full rounded-lg" />
        </div>
      )}

      {!isLoading && clients.length === 0 && (
        <div className="rounded-lg border border-border1 bg-surface3 py-8 text-center">
          <Txt className="text-neutral3">No MCP clients configured yet. Add one to get started.</Txt>
        </div>
      )}

      {!isLoading && clients.length > 0 && (
        <div className="flex flex-col gap-2">
          {clients.map(client => {
            const serverCount = Object.keys(client.servers ?? {}).length;
            return (
              <Entity key={client.id}>
                <EntityIcon>
                  <McpServerIcon className="group-hover/entity:text-accent6" />
                </EntityIcon>
                <EntityContent className="flex-1">
                  <EntityName>{client.name}</EntityName>
                  <EntityDescription>
                    {client.description || `${serverCount} server${serverCount !== 1 ? 's' : ''} configured`}
                  </EntityDescription>
                </EntityContent>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDelete(client.id)}
                  disabled={deleteStoredMCPClient.isPending}
                >
                  <XIcon className="h-3 w-3" />
                </Button>
              </Entity>
            );
          })}
        </div>
      )}

      <SideDialog
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        dialogTitle="Create a new MCP Client"
        dialogDescription="Configure an MCP client with server connection details."
      >
        <SideDialog.Top>
          <SideDialog.Heading>Create a new MCP Client</SideDialog.Heading>
        </SideDialog.Top>
        <MCPClientCreateContent onSuccess={() => setIsCreateOpen(false)} />
      </SideDialog>
    </div>
  );
}

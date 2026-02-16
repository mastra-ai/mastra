import { useState } from 'react';
import { useWatch } from 'react-hook-form';
import { PlusIcon, XIcon } from 'lucide-react';

import type { StoredMCPServerConfig } from '@mastra/client-js';

import { Icon, McpServerIcon } from '@/ds/icons';
import { Txt } from '@/ds/components/Txt';
import { Button } from '@/ds/components/Button';
import { Badge } from '@/ds/components/Badge';
import { Entity, EntityContent, EntityDescription, EntityName, EntityIcon } from '@/ds/components/Entity';
import { SideDialog } from '@/ds/components/SideDialog';

import { useAgentEditFormContext } from '@/domains/agents/context/agent-edit-form-context';
import { MCPClientCreateContent } from '../mcp-client-create';

export function MCPClientList() {
  const { form, readOnly } = useAgentEditFormContext();
  const mcpClients = useWatch({ control: form.control, name: 'mcpClients' }) ?? [];
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  const handleAdd = (config: { name: string; description?: string; servers: Record<string, StoredMCPServerConfig> }) => {
    const current = form.getValues('mcpClients') ?? [];
    form.setValue('mcpClients', [...current, config]);
    setIsCreateOpen(false);
  };

  const handleRemove = (index: number) => {
    const current = form.getValues('mcpClients') ?? [];
    form.setValue(
      'mcpClients',
      current.filter((_, i) => i !== index),
    );
  };

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
          <Badge>{mcpClients.length}</Badge>
        </div>
        {!readOnly && (
          <Button variant="outline" size="sm" onClick={() => setIsCreateOpen(true)}>
            <PlusIcon className="h-3 w-3 mr-1" />
            Add MCP Client
          </Button>
        )}
      </div>

      {mcpClients.length === 0 && (
        <div className="rounded-lg border border-border1 bg-surface3 py-8 text-center">
          <Txt className="text-neutral3">No MCP clients configured yet. Add one to get started.</Txt>
        </div>
      )}

      {mcpClients.length > 0 && (
        <div className="flex flex-col gap-2">
          {mcpClients.map((mcpClient, index) => {
            const serverCount = Object.keys(mcpClient.servers ?? {}).length;
            return (
              <Entity key={mcpClient.id ?? `pending-${index}`}>
                <EntityIcon>
                  <McpServerIcon className="group-hover/entity:text-accent6" />
                </EntityIcon>
                <EntityContent className="flex-1">
                  <EntityName>{mcpClient.name}</EntityName>
                  <EntityDescription>
                    {mcpClient.description || `${serverCount} server${serverCount !== 1 ? 's' : ''} configured`}
                  </EntityDescription>
                </EntityContent>
                {!readOnly && (
                  <Button variant="ghost" size="sm" onClick={() => handleRemove(index)}>
                    <XIcon className="h-3 w-3" />
                  </Button>
                )}
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
        <MCPClientCreateContent onAdd={handleAdd} />
      </SideDialog>
    </div>
  );
}

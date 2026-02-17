import { useMemo, useState } from 'react';
import { useWatch } from 'react-hook-form';
import { PlusIcon, XIcon } from 'lucide-react';

import type { StoredMCPServerConfig } from '@mastra/client-js';

import { McpServerIcon } from '@/ds/icons';
import { Txt } from '@/ds/components/Txt';
import { Button } from '@/ds/components/Button';
import { Section } from '@/ds/components/Section';
import { Entity, EntityContent, EntityDescription, EntityName, EntityIcon } from '@/ds/components/Entity';
import { SideDialog } from '@/ds/components/SideDialog';

import { useAgentEditFormContext } from '@/domains/agents/context/agent-edit-form-context';
import { MCPClientCreateContent, type MCPClientFormValues } from '../mcp-client-create';

function mcpClientToFormValues(mcpClient: {
  name: string;
  description?: string;
  servers: Record<string, StoredMCPServerConfig>;
}): MCPClientFormValues {
  const entries = Object.entries(mcpClient.servers ?? {});
  const [serverName, config] = entries[0] ?? ['default', { type: 'http' as const }];

  const serverType = (config as { type?: string }).type === 'stdio' ? ('stdio' as const) : ('http' as const);

  const httpConfig = config as { url?: string; timeout?: number };
  const stdioConfig = config as { command?: string; args?: string[]; env?: Record<string, string> };

  return {
    name: mcpClient.name,
    description: mcpClient.description ?? '',
    serverName,
    serverType,
    url: httpConfig.url ?? '',
    timeout: httpConfig.timeout ?? 30000,
    command: stdioConfig.command ?? '',
    args: Array.isArray(stdioConfig.args) ? stdioConfig.args.join('\n') : '',
    env: stdioConfig.env ? Object.entries(stdioConfig.env).map(([key, value]) => ({ key, value })) : [],
  };
}

export function MCPClientList() {
  const { form, readOnly } = useAgentEditFormContext();
  const mcpClients = useWatch({ control: form.control, name: 'mcpClients' }) ?? [];
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [viewIndex, setViewIndex] = useState<number | null>(null);

  const viewingClient = viewIndex !== null ? mcpClients[viewIndex] : null;
  const isViewingPersisted = Boolean(viewingClient?.id);
  const viewFormValues = useMemo(() => (viewingClient ? mcpClientToFormValues(viewingClient) : null), [viewingClient]);

  const handleAdd = (config: {
    name: string;
    description?: string;
    servers: Record<string, StoredMCPServerConfig>;
  }) => {
    const current = form.getValues('mcpClients') ?? [];
    form.setValue('mcpClients', [...current, config]);
    setIsCreateOpen(false);
  };

  const handleUpdate = (config: {
    name: string;
    description?: string;
    servers: Record<string, StoredMCPServerConfig>;
  }) => {
    if (viewIndex === null) return;
    const current = form.getValues('mcpClients') ?? [];
    const updated = [...current];
    updated[viewIndex] = { ...updated[viewIndex], ...config };
    form.setValue('mcpClients', updated);
    setViewIndex(null);
  };

  const handleRemove = (index: number) => {
    const current = form.getValues('mcpClients') ?? [];
    const removed = current[index];

    // Track persisted clients for deletion on save
    if (removed?.id) {
      const toDelete = form.getValues('mcpClientsToDelete') ?? [];
      form.setValue('mcpClientsToDelete', [...toDelete, removed.id]);
    }

    form.setValue(
      'mcpClients',
      current.filter((_, i) => i !== index),
    );
  };

  return (
    <>
      <Section>
        <Section.Header>
          <Section.Heading>
            <McpServerIcon />
            MCP Clients
          </Section.Heading>
          {!readOnly && (
            <Button variant="outline" size="sm" onClick={() => setIsCreateOpen(true)}>
              <PlusIcon className="h-3 w-3 mr-1" />
              Add MCP Client
            </Button>
          )}
        </Section.Header>

        {mcpClients.length === 0 && (
          <div className="rounded-lg border border-border1 bg-surface3 py-8 text-center">
            <Txt className="text-neutral3">No MCP clients configured yet. Add one to get started.</Txt>
          </div>
        )}

        {mcpClients.length > 0 && (
          <div className="grid gap-2 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
            {mcpClients.map((mcpClient, index) => {
              const serverCount = Object.keys(mcpClient.servers ?? {}).length;
              return (
                <Entity
                  key={mcpClient.id ?? `pending-${index}`}
                  className="items-center"
                  onClick={() => setViewIndex(index)}
                >
                  <EntityIcon>
                    <McpServerIcon />
                  </EntityIcon>
                  <EntityContent className="flex-1">
                    <EntityName>{mcpClient.name}</EntityName>
                    <EntityDescription>
                      {mcpClient.description || `${serverCount} server${serverCount !== 1 ? 's' : ''} configured`}
                    </EntityDescription>
                  </EntityContent>
                  {!readOnly && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e: React.MouseEvent<HTMLButtonElement>) => {
                        e.stopPropagation();
                        handleRemove(index);
                      }}
                    >
                      <XIcon className="h-3 w-3" />
                    </Button>
                  )}
                </Entity>
              );
            })}
          </div>
        )}
      </Section>

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

      <SideDialog
        isOpen={viewIndex !== null}
        onClose={() => setViewIndex(null)}
        dialogTitle={viewingClient?.name ?? 'MCP Client'}
        dialogDescription={isViewingPersisted ? 'View MCP client configuration.' : 'Edit MCP client configuration.'}
      >
        <SideDialog.Top>
          <SideDialog.Heading>{viewingClient?.name ?? 'MCP Client'}</SideDialog.Heading>
        </SideDialog.Top>
        {viewFormValues && (
          <MCPClientCreateContent
            readOnly={isViewingPersisted}
            initialValues={viewFormValues}
            onAdd={isViewingPersisted ? undefined : handleUpdate}
            submitLabel={isViewingPersisted ? undefined : 'Update MCP Client'}
          />
        )}
      </SideDialog>
    </>
  );
}

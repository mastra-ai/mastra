import { useMemo, useState } from 'react';
import { useWatch } from 'react-hook-form';
import { LaptopMinimal, PlusIcon, XIcon } from 'lucide-react';

import type { StoredMCPServerConfig } from '@mastra/client-js';

import { Icon, McpServerIcon } from '@/ds/icons';
import { Button } from '@/ds/components/Button';
import { Section } from '@/ds/components/Section';
import { Entity, EntityContent, EntityDescription, EntityName } from '@/ds/components/Entity';
import { SideDialog } from '@/ds/components/SideDialog';

import { useAgentEditFormContext } from '@/domains/agents/context/agent-edit-form-context';
import { MCPClientCreateContent, type MCPClientFormValues } from '../mcp-client-create';
import { SubSectionHeader } from '@/domains/cms/components/section/section-header';
import { EmptyState } from '@/ds/components/EmptyState';
import { SubSectionRoot } from '@/ds/components/Section/section-root';
import { stringToColor } from '@/lib/colors';

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
    selectedTools: Record<string, { description?: string }>;
  }) => {
    const current = form.getValues('mcpClients') ?? [];
    form.setValue('mcpClients', [...current, config]);

    if (Object.keys(config.selectedTools).length > 0) {
      const currentTools = form.getValues('tools') ?? {};
      const next = { ...currentTools };
      for (const [name, toolConfig] of Object.entries(config.selectedTools)) {
        next[name] = { description: toolConfig.description };
      }
      form.setValue('tools', next);
    }

    setIsCreateOpen(false);
  };

  const handleUpdate = (config: {
    name: string;
    description?: string;
    servers: Record<string, StoredMCPServerConfig>;
    selectedTools: Record<string, { description?: string }>;
  }) => {
    if (viewIndex === null) return;
    const current = form.getValues('mcpClients') ?? [];
    const oldClient = current[viewIndex];

    const currentTools = form.getValues('tools') ?? {};
    const next = { ...currentTools };

    // Remove old MCP tools
    for (const name of Object.keys(oldClient?.selectedTools ?? {})) {
      delete next[name];
    }
    // Add new MCP tools
    for (const [name, toolConfig] of Object.entries(config.selectedTools)) {
      next[name] = { description: toolConfig.description };
    }
    form.setValue('tools', next);

    const updated = [...current];
    updated[viewIndex] = { ...updated[viewIndex], ...config };
    form.setValue('mcpClients', updated);
    setViewIndex(null);
  };

  const handleRemove = (index: number) => {
    const current = form.getValues('mcpClients') ?? [];
    const removed = current[index];

    if (removed?.selectedTools) {
      const currentTools = form.getValues('tools') ?? {};
      const next = { ...currentTools };
      for (const name of Object.keys(removed.selectedTools)) {
        delete next[name];
      }
      form.setValue('tools', next);
    }

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
      <SubSectionRoot>
        <Section.Header>
          <SubSectionHeader title="MCP Clients" icon={<LaptopMinimal />} />

          {!readOnly && (
            <Button variant="ghost" size="sm" onClick={() => setIsCreateOpen(true)}>
              <Icon size="sm">
                <PlusIcon />
              </Icon>
              Add MCP Client
            </Button>
          )}
        </Section.Header>

        {mcpClients.length === 0 && (
          <div className="rounded-xl border border-border2 border-dashed py-8 text-center">
            <EmptyState
              className="!py-4"
              iconSlot={
                <div className="size-6 text-neutral3 rounded-full bg-surface3 p-2 flex items-center justify-center">
                  <LaptopMinimal className="size-6" />
                </div>
              }
              titleSlot="No MCP clients configured yet."
              descriptionSlot="Add one to get started."
              actionSlot={
                <Button variant="outline" size="sm" onClick={() => setIsCreateOpen(true)}>
                  <Icon size="sm">
                    <PlusIcon />
                  </Icon>
                  Add MCP Client
                </Button>
              }
            />
          </div>
        )}

        {mcpClients.length > 0 && (
          <div className="flex flex-col gap-1">
            {mcpClients.map((mcpClient, index) => {
              const serverCount = Object.keys(mcpClient.servers ?? {}).length;
              const bg = stringToColor(mcpClient.name);
              const text = stringToColor(mcpClient.name, 25);

              return (
                <Entity
                  key={mcpClient.id ?? `pending-${index}`}
                  className="items-center bg-surface2"
                  onClick={() => setViewIndex(index)}
                >
                  <div
                    className="size-11 rounded-lg flex items-center justify-center uppercase shrink-0"
                    style={{ backgroundColor: bg, color: text }}
                  >
                    <Icon>
                      <McpServerIcon />
                    </Icon>
                  </div>

                  <EntityContent>
                    <EntityName>{mcpClient.name}</EntityName>
                    <EntityDescription>
                      {mcpClient.description || `${serverCount} server${serverCount !== 1 ? 's' : ''} configured`}
                    </EntityDescription>
                  </EntityContent>

                  {!readOnly && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={(e: React.MouseEvent<HTMLButtonElement>) => {
                        e.stopPropagation();
                        handleRemove(index);
                      }}
                    >
                      <Icon>
                        <XIcon />
                      </Icon>
                      Remove
                    </Button>
                  )}
                </Entity>
              );
            })}
          </div>
        )}
      </SubSectionRoot>

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
            initialSelectedTools={viewingClient?.selectedTools}
            onAdd={readOnly ? undefined : handleUpdate}
            submitLabel={isViewingPersisted ? 'Update tool selection' : 'Update MCP Client'}
          />
        )}
      </SideDialog>
    </>
  );
}

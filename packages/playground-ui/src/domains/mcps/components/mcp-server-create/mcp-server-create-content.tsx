import { useCallback, useEffect, useState } from 'react';

import { Icon } from '@/ds/icons';
import { ToolsIcon } from '@/ds/icons/ToolsIcon';
import { Txt } from '@/ds/components/Txt';
import { Entity, EntityContent, EntityDescription, EntityIcon, EntityName } from '@/ds/components/Entity';
import { Switch } from '@/ds/components/Switch';
import { Input } from '@/ds/components/Input';
import { Button } from '@/ds/components/Button';
import { SideDialog } from '@/ds/components/SideDialog';
import { Spinner } from '@/ds/components/Spinner';
import { cn } from '@/lib/utils';
import { toast } from '@/lib/toast';

import { useTools } from '@/domains/tools';
import { useStoredMCPServer, useStoredMCPServerMutations } from '../../hooks/use-stored-mcp-servers';
import { useMCPServerForm, type MCPServerFormValues } from './use-mcp-server-form';

interface MCPServerCreateContentProps {
  editServerId?: string;
  onClose: () => void;
}

export function MCPServerCreateContent({ editServerId, onClose }: MCPServerCreateContentProps) {
  const isEdit = Boolean(editServerId);

  const { data: existingServer } = useStoredMCPServer(editServerId, { status: 'draft' });
  const { createStoredMCPServer, updateStoredMCPServer } = useStoredMCPServerMutations(editServerId);
  const { data: toolsData, isLoading: isToolsLoading } = useTools();

  const { form } = useMCPServerForm();

  const [selectedTools, setSelectedTools] = useState<Record<string, { description?: string }>>({});

  useEffect(() => {
    if (existingServer) {
      form.reset({
        name: existingServer.name,
        version: existingServer.version,
      });
      setSelectedTools(existingServer.tools ?? {});
    }
  }, [existingServer, form]);

  const tools = toolsData
    ? Object.entries(toolsData).map(([id, tool]) => ({
        name: id,
        description: tool.description,
      }))
    : [];

  const handleToggleTool = useCallback((toolName: string, description?: string) => {
    setSelectedTools(prev => {
      if (toolName in prev) {
        const next = { ...prev };
        delete next[toolName];
        return next;
      }
      return { ...prev, [toolName]: { description } };
    });
  }, []);

  const handleDescriptionChange = useCallback((toolName: string, description: string) => {
    setSelectedTools(prev => ({
      ...prev,
      [toolName]: { ...prev[toolName], description },
    }));
  }, []);

  const handleSubmit = async () => {
    const isValid = await form.trigger();
    if (!isValid) {
      toast.error('Please fill in all required fields');
      return;
    }

    const values = form.getValues();
    const mutation = isEdit && editServerId ? updateStoredMCPServer : createStoredMCPServer;
    const action = isEdit && editServerId ? 'updated' : 'created';

    mutation.mutate(
      {
        name: values.name,
        version: values.version,
        tools: selectedTools,
      },
      {
        onSuccess: () => {
          toast.success(`MCP server ${action} successfully`);
          onClose();
        },
        onError: () => {
          toast.error(`Failed to ${action.slice(0, -1)} MCP server`);
        },
      },
    );
  };

  const isSubmitting = createStoredMCPServer.isPending || updateStoredMCPServer.isPending;
  const selectedCount = Object.keys(selectedTools).length;

  return (
    <>
      <SideDialog.Header className="px-9 pt-6">
        <SideDialog.Heading>{isEdit ? 'Edit MCP Server' : 'Create MCP Server'}</SideDialog.Heading>
        <Button variant="primary" size="sm" onClick={handleSubmit} disabled={isSubmitting}>
          {isSubmitting ? 'Saving...' : isEdit ? 'Update' : 'Create'}
        </Button>
      </SideDialog.Header>

      <div className="overflow-y-auto p-9 flex flex-col gap-8">
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="mcp-server-name" className="text-neutral5 text-sm font-medium">
              Name
            </label>
            <Input id="mcp-server-name" placeholder="My MCP Server" {...form.register('name')} />
            {form.formState.errors.name && (
              <Txt variant="ui-sm" className="text-accent2">
                {form.formState.errors.name.message}
              </Txt>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="mcp-server-version" className="text-neutral5 text-sm font-medium">
              Version
            </label>
            <Input id="mcp-server-version" placeholder="1.0.0" {...form.register('version')} />
            {form.formState.errors.version && (
              <Txt variant="ui-sm" className="text-accent2">
                {form.formState.errors.version.message}
              </Txt>
            )}
          </div>
        </div>

        <div>
          <div className="text-neutral6 flex gap-2 items-center">
            <Icon size="lg" className="bg-surface4 rounded-md p-1">
              <ToolsIcon />
            </Icon>
            <Txt variant="header-md" as="h2" className="font-medium">
              Available Tools ({selectedCount}/{tools.length} selected)
            </Txt>
          </div>

          {isToolsLoading && (
            <div className="flex items-center gap-2 pt-4">
              <Spinner className="h-3 w-3" />
              <Txt className="text-neutral3">Loading tools...</Txt>
            </div>
          )}

          {!isToolsLoading && tools.length === 0 && (
            <Txt className="text-neutral3 pt-4">No tools available in this Mastra instance.</Txt>
          )}

          {!isToolsLoading && tools.length > 0 && (
            <div className="flex flex-col gap-2 pt-6">
              {tools.map(tool => {
                const isSelected = tool.name in selectedTools;

                return (
                  <Entity key={tool.name}>
                    <EntityIcon>
                      <ToolsIcon className="group-hover/entity:text-accent6" />
                    </EntityIcon>
                    <EntityContent>
                      <EntityName>{tool.name}</EntityName>
                      <EntityDescription>
                        <input
                          type="text"
                          disabled={!isSelected}
                          className={cn(
                            'border border-transparent appearance-none block w-full text-neutral3 bg-transparent',
                            isSelected && 'border-border1 border-dashed',
                          )}
                          value={
                            isSelected
                              ? (selectedTools[tool.name]?.description ?? tool.description ?? '')
                              : (tool.description ?? '')
                          }
                          onChange={e => handleDescriptionChange(tool.name, e.target.value)}
                        />
                      </EntityDescription>
                    </EntityContent>
                    <Switch
                      checked={isSelected}
                      onCheckedChange={() => handleToggleTool(tool.name, tool.description)}
                    />
                  </Entity>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

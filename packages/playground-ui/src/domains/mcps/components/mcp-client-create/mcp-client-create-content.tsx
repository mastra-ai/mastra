import { useRef, useState } from 'react';
import { useWatch } from 'react-hook-form';

import type { CreateStoredMCPClientParams } from '@mastra/client-js';

import { toast } from '@/lib/toast';

import { useStoredMCPClientMutations } from '../../hooks/use-stored-mcp-clients';
import { useMCPClientForm } from './use-mcp-client-form';
import { MCPClientEditLayout } from './mcp-client-edit-layout';
import { MCPClientFormSidebar } from './mcp-client-form-sidebar';
import { MCPClientToolPreview } from './mcp-client-tool-preview';

interface MCPClientCreateContentProps {
  onSuccess?: () => void;
}

export function MCPClientCreateContent({ onSuccess }: MCPClientCreateContentProps) {
  const { createStoredMCPClient } = useStoredMCPClientMutations();
  const { form } = useMCPClientForm();
  const containerRef = useRef<HTMLDivElement>(null);
  const [preFilledServerId, setPreFilledServerId] = useState<string | null>(null);

  const serverType = useWatch({ control: form.control, name: 'serverType' });
  const url = useWatch({ control: form.control, name: 'url' });

  const handlePreFillFromServer = (serverId: string) => {
    const host = window.MASTRA_SERVER_HOST;
    const port = window.MASTRA_SERVER_PORT;

    let baseUrl = null;
    if (host && port) {
      baseUrl = `http://${host}:${port}`;
    }

    const effectiveBaseUrl = baseUrl || 'http://localhost:4111';
    const serverUrl = `${effectiveBaseUrl}/api/mcp/${serverId}/mcp`;

    form.setValue('serverType', 'http');
    form.setValue('url', serverUrl);
    form.setValue('serverName', serverId);
    setPreFilledServerId(serverId);
  };

  const handlePublish = async () => {
    const isValid = await form.trigger();
    if (!isValid) {
      toast.error('Please fill in all required fields');
      return;
    }

    const values = form.getValues();

    try {
      const serverConfig: CreateStoredMCPClientParams['servers'] = {
        [values.serverName]: {
          type: values.serverType,
          ...(values.serverType === 'http'
            ? {
                url: values.url,
                timeout: values.timeout,
              }
            : {
                command: values.command,
                args: values.args
                  .split('\n')
                  .map(a => a.trim())
                  .filter(Boolean),
                env: values.env.reduce(
                  (acc, { key, value }) => {
                    if (key.trim()) {
                      acc[key.trim()] = value;
                    }
                    return acc;
                  },
                  {} as Record<string, string>,
                ),
              }),
        },
      };

      const createParams: CreateStoredMCPClientParams = {
        name: values.name,
        description: values.description || undefined,
        servers: serverConfig,
      };

      await createStoredMCPClient.mutateAsync(createParams);
      toast.success('MCP client created successfully');
      onSuccess?.();
    } catch (error) {
      toast.error(`Failed to create MCP client: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  return (
    <div ref={containerRef} className="h-full min-h-0 overflow-hidden">
      <MCPClientEditLayout
        leftSlot={
          <MCPClientFormSidebar
            form={form}
            onPublish={handlePublish}
            isSubmitting={createStoredMCPClient.isPending}
            onPreFillFromServer={handlePreFillFromServer}
            containerRef={containerRef}
          />
        }
      >
        <MCPClientToolPreview preFilledServerId={preFilledServerId} serverType={serverType} url={url} />
      </MCPClientEditLayout>
    </div>
  );
}

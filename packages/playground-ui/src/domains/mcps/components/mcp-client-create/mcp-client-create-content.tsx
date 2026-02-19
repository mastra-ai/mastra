import { useCallback, useEffect, useRef, useState } from 'react';
import { useWatch } from 'react-hook-form';

import type { StoredMCPServerConfig } from '@mastra/client-js';

import { toast } from '@/lib/toast';

import { useTryConnectMcp } from '../../hooks/use-try-connect-mcp';
import { useMCPClientForm, type MCPClientFormValues } from './use-mcp-client-form';
import { MCPClientEditLayout } from './mcp-client-edit-layout';
import { MCPClientFormSidebar } from './mcp-client-form-sidebar';
import { MCPClientToolPreview } from './mcp-client-tool-preview';

interface MCPClientCreateContentProps {
  onAdd?: (config: {
    name: string;
    description?: string;
    servers: Record<string, StoredMCPServerConfig>;
    selectedTools: Record<string, { description?: string }>;
  }) => void;
  readOnly?: boolean;
  initialValues?: MCPClientFormValues;
  initialSelectedTools?: Record<string, { description?: string }>;
  submitLabel?: string;
}

export function MCPClientCreateContent({
  onAdd,
  readOnly,
  initialValues,
  initialSelectedTools,
  submitLabel,
}: MCPClientCreateContentProps) {
  const { form } = useMCPClientForm(initialValues);
  const containerRef = useRef<HTMLDivElement>(null);

  const serverType = useWatch({ control: form.control, name: 'serverType' });
  const url = useWatch({ control: form.control, name: 'url' });

  const [selectedTools, setSelectedTools] = useState<Record<string, { description?: string }>>(
    initialSelectedTools ?? {},
  );

  const tryConnect = useTryConnectMcp();
  const hasAutoConnected = useRef(false);

  useEffect(() => {
    if (readOnly && serverType === 'http' && url.trim() && !hasAutoConnected.current) {
      hasAutoConnected.current = true;
      tryConnect.mutate(url);
    }
  }, [readOnly, serverType, url, tryConnect]);

  const handleTryConnect = useCallback(() => {
    if (serverType === 'http' && url.trim()) {
      tryConnect.mutate(url);
    }
  }, [serverType, url, tryConnect]);

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

  const handlePreFillFromServer = (serverId: string) => {
    const host = window.MASTRA_SERVER_HOST;
    const port = window.MASTRA_SERVER_PORT;
    const baseUrl = host && port ? `http://${host}:${port}` : 'http://localhost:4111';
    const serverUrl = `${baseUrl}/api/mcp/${serverId}/mcp`;

    form.setValue('serverType', 'http');
    form.setValue('url', serverUrl);
    form.setValue('serverName', serverId);
  };

  const handlePublish = async () => {
    if (!onAdd) return;

    const isValid = await form.trigger();
    if (!isValid) {
      toast.error('Please fill in all required fields');
      return;
    }

    const values = form.getValues();

    const serverConfig: Record<string, StoredMCPServerConfig> = {
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

    onAdd({
      name: values.name,
      description: values.description || undefined,
      servers: serverConfig,
      selectedTools,
    });
  };

  return (
    <div ref={containerRef} className="h-full min-h-0 overflow-hidden">
      <MCPClientEditLayout
        leftSlot={
          <MCPClientFormSidebar
            form={form}
            onPublish={handlePublish}
            isSubmitting={false}
            onPreFillFromServer={handlePreFillFromServer}
            containerRef={containerRef}
            readOnly={readOnly}
            showSubmit={!!onAdd}
            submitLabel={submitLabel}
            onTryConnect={handleTryConnect}
            isTryingConnect={tryConnect.isPending}
          />
        }
      >
        <MCPClientToolPreview
          serverType={serverType}
          url={url}
          tryConnect={tryConnect}
          selectedTools={selectedTools}
          onToggleTool={onAdd ? handleToggleTool : undefined}
          onDescriptionChange={onAdd ? handleDescriptionChange : undefined}
        />
      </MCPClientEditLayout>
    </div>
  );
}

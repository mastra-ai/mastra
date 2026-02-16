import { Icon, McpServerIcon } from '@/ds/icons';
import { ToolsIcon } from '@/ds/icons/ToolsIcon';
import { Txt } from '@/ds/components/Txt';
import { Spinner } from '@/ds/components/Spinner';
import { Entity, EntityContent, EntityDescription, EntityIcon, EntityName } from '@/ds/components/Entity';

import type { TryConnectMcpMutation } from '../../hooks/use-try-connect-mcp';

interface MCPClientToolPreviewProps {
  serverType: 'stdio' | 'http';
  url: string;
  tryConnect: TryConnectMcpMutation;
}

export function MCPClientToolPreview({ serverType, url, tryConnect }: MCPClientToolPreviewProps) {
  if (serverType === 'stdio') {
    return (
      <EmptyState>
        <Txt className="text-neutral3">
          Tool preview is available for HTTP servers. Stdio servers cannot be previewed.
        </Txt>
      </EmptyState>
    );
  }

  if (!url.trim()) {
    return (
      <EmptyState>
        <Txt className="text-neutral3">
          Enter a URL and click &quot;Try to connect&quot; to preview available tools.
        </Txt>
      </EmptyState>
    );
  }

  if (tryConnect.isIdle) {
    return (
      <EmptyState>
        <Txt className="text-neutral3">Click &quot;Try to connect&quot; to preview available tools.</Txt>
      </EmptyState>
    );
  }

  return (
    <div className="p-5">
      {tryConnect.isPending && (
        <div className="flex items-center gap-2">
          <Spinner className="h-3 w-3" />
          <Txt className="text-neutral3">Connecting...</Txt>
        </div>
      )}

      {tryConnect.isError && (
        <Txt variant="ui-sm" className="text-accent2">
          {tryConnect.error instanceof Error ? tryConnect.error.message : 'Connection failed'}
        </Txt>
      )}

      {tryConnect.isSuccess && tryConnect.data.tools.length === 0 && (
        <Txt className="text-neutral3">Connected successfully but no tools were found.</Txt>
      )}

      {tryConnect.isSuccess && tryConnect.data.tools.length > 0 && <ToolList tools={tryConnect.data.tools} />}
    </div>
  );
}

function EmptyState({ children }: { children: React.ReactNode }) {
  return <div className="flex items-center justify-center h-full p-8 text-center">{children}</div>;
}

function ToolList({ tools }: { tools: { name: string; description?: string }[] }) {
  return (
    <div className="p-5 overflow-y-auto">
      <div className="text-neutral6 flex gap-2 items-center">
        <Icon size="lg" className="bg-surface4 rounded-md p-1">
          <McpServerIcon />
        </Icon>
        <Txt variant="header-md" as="h2" className="font-medium">
          Available Tools ({tools.length})
        </Txt>
      </div>

      <div className="flex flex-col gap-2 pt-6">
        {tools.map(tool => (
          <Entity key={tool.name}>
            <EntityIcon>
              <ToolsIcon className="group-hover/entity:text-accent6" />
            </EntityIcon>
            <EntityContent>
              <EntityName>{tool.name}</EntityName>
              {tool.description && <EntityDescription>{tool.description}</EntityDescription>}
            </EntityContent>
          </Entity>
        ))}
      </div>
    </div>
  );
}

import {
  Entity,
  EntityContent,
  EntityDescription,
  EntityIcon,
  EntityName,
} from '@mastra/playground-ui/components/Entity';
import { Spinner } from '@mastra/playground-ui/components/Spinner';
import { Switch } from '@mastra/playground-ui/components/Switch';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { Icon } from '@mastra/playground-ui/icons/Icon';
import { McpServerIcon } from '@mastra/playground-ui/icons/McpServerIcon';
import { ToolsIcon } from '@mastra/playground-ui/icons/ToolsIcon';
import { cn } from '@mastra/playground-ui/utils/cn';
import type { TryConnectMcpMutation } from '../../hooks/use-try-connect-mcp';

interface MCPClientToolPreviewProps {
  serverType: 'stdio' | 'http';
  url: string;
  tryConnect: TryConnectMcpMutation;
  selectedTools?: Record<string, { description?: string }>;
  onToggleTool?: (toolName: string, description?: string) => void;
  onDescriptionChange?: (toolName: string, description: string) => void;
}

export function MCPClientToolPreview({
  serverType,
  url,
  tryConnect,
  selectedTools,
  onToggleTool,
  onDescriptionChange,
}: MCPClientToolPreviewProps) {
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
          <Spinner className="size-3" />
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

      {tryConnect.isSuccess && tryConnect.data.tools.length > 0 && (
        <ToolList
          tools={tryConnect.data.tools}
          selectedTools={selectedTools}
          onToggleTool={onToggleTool}
          onDescriptionChange={onDescriptionChange}
        />
      )}
    </div>
  );
}

function EmptyState({ children }: { children: React.ReactNode }) {
  return <div className="flex h-full items-center justify-center p-8 text-center">{children}</div>;
}

function ToolList({
  tools,
  selectedTools = {},
  onToggleTool,
  onDescriptionChange,
}: {
  tools: { name: string; description?: string }[];
  selectedTools?: Record<string, { description?: string }>;
  onToggleTool?: (toolName: string, description?: string) => void;
  onDescriptionChange?: (toolName: string, description: string) => void;
}) {
  const selectedCount = Object.keys(selectedTools).length;

  return (
    <div className="overflow-y-auto p-5">
      <div className="flex items-center gap-2 text-neutral6">
        <Icon size="lg" className="rounded-md bg-surface4 p-1">
          <McpServerIcon />
        </Icon>
        <Txt variant="header-md" as="h2" className="font-medium">
          Available Tools ({selectedCount}/{tools.length} selected)
        </Txt>
      </div>

      <div className="flex flex-col gap-2 pt-6">
        {tools.map(tool => {
          const isSelected = tool.name in selectedTools;
          const isDisabled = !onDescriptionChange || !isSelected;

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
                    disabled={isDisabled}
                    className={cn(
                      'block w-full appearance-none border border-transparent bg-transparent text-neutral3',
                      !isDisabled && 'border-dashed border-border1',
                    )}
                    value={
                      isSelected
                        ? (selectedTools[tool.name]?.description ?? tool.description ?? '')
                        : (tool.description ?? '')
                    }
                    onChange={e => onDescriptionChange?.(tool.name, e.target.value)}
                  />
                </EntityDescription>
              </EntityContent>
              {onToggleTool && (
                <Switch checked={isSelected} onCheckedChange={() => onToggleTool(tool.name, tool.description)} />
              )}
            </Entity>
          );
        })}
      </div>
    </div>
  );
}

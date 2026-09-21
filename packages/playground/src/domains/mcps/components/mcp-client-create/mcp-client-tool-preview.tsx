import {
  Entity,
  EntityContent,
  EntityDescription,
  EntityIcon,
  EntityName,
} from '@mastra/playground-ui/components/Entity';
import { Notice } from '@mastra/playground-ui/components/Notice';
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
        <Txt className="text-muted-foreground">
          Tool preview is available for HTTP servers. Stdio servers cannot be previewed.
        </Txt>
      </EmptyState>
    );
  }

  if (!url.trim()) {
    return (
      <EmptyState>
        <Txt className="text-muted-foreground">
          Enter a URL and click &quot;Try to connect&quot; to preview available tools.
        </Txt>
      </EmptyState>
    );
  }

  if (tryConnect.isIdle) {
    return (
      <EmptyState>
        <Txt className="text-muted-foreground">Click &quot;Try to connect&quot; to preview available tools.</Txt>
      </EmptyState>
    );
  }

  return (
    <div className="p-5">
      {tryConnect.isPending && (
        <div className="flex items-center gap-2">
          <Spinner className="h-3 w-3" />
          <Txt className="text-muted-foreground">Connecting...</Txt>
        </div>
      )}

      {tryConnect.isError && (
        <div role="alert">
          <Notice variant="destructive">
            {tryConnect.error instanceof Error ? tryConnect.error.message : 'Connection failed'}
          </Notice>
        </div>
      )}

      {tryConnect.isSuccess && tryConnect.data.tools.length === 0 && (
        <Txt className="text-muted-foreground">Connected successfully but no tools were found.</Txt>
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
  return <div className="flex h-full items-center justify-center p-5 text-center">{children}</div>;
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
      <div className="text-foreground flex items-center gap-2">
        <Icon size="lg" className="bg-muted rounded-md p-1">
          <McpServerIcon />
        </Icon>
        <Txt variant="heading" as="h2">
          Available Tools ({selectedCount}/{tools.length} selected)
        </Txt>
      </div>

      <div className="flex flex-col gap-2 pt-4">
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
                      'border border-transparent appearance-none block w-full text-muted-foreground bg-transparent',
                      !isDisabled && 'border-border border-dashed',
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

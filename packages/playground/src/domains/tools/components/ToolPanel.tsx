import { Skeleton } from '@mastra/playground-ui/components/Skeleton';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { jsonSchemaToZodRuntime } from '@mastra/playground-ui/lib/form/json-schema-to-zod-runtime';
import { toast } from '@mastra/playground-ui/utils/toast';
import { useMemo, useEffect } from 'react';
import { parse } from 'superjson';
import { z } from 'zod';
import { parseToolSchema } from '../utils/parse-tool-schema';
import { ToolOverview } from './tool-overview';
import { ToolUsedBy } from './tool-used-by';
import { ToolView } from './tool-view';
import ToolExecutor from './ToolExecutor';
import { ToolInformation } from './ToolInformation';
import { useAgents } from '@/domains/agents/hooks/use-agents';
import { usePermissions } from '@/domains/auth/hooks/use-permissions';
import { useTool } from '@/domains/tools/hooks';
import { useExecuteTool } from '@/domains/tools/hooks/use-execute-tool';

export interface ToolPanelProps {
  toolId: string;
}

export const ToolPanel = ({ toolId }: ToolPanelProps) => {
  const { canExecute } = usePermissions();
  const canExecuteTool = canExecute('tools');

  const { data: agents = {} } = useAgents();

  // Check if tool exists in any agent's tools
  const agentTool = useMemo(() => {
    for (const agent of Object.values(agents)) {
      if (agent.tools) {
        const tool = Object.values(agent.tools).find(t => t.id === toolId);
        if (tool) {
          return tool;
        }
      }
    }
    return null;
  }, [agents, toolId]);

  // Only fetch from API if tool not found in agents
  const { data: apiTool, isLoading, error } = useTool(toolId!, { enabled: !agentTool });

  const tool = agentTool ?? apiTool;

  const { mutateAsync: executeTool } = useExecuteTool();

  useEffect(() => {
    if (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to load tool';
      toast.error(`Error loading tool: ${errorMessage}`);
    }
  }, [error]);

  const handleExecuteTool = (data: unknown, requestContext?: Record<string, unknown>) =>
    executeTool({ toolId, input: data, requestContext });

  const zodInputSchema = tool?.inputSchema ? jsonSchemaToZodRuntime(parse(tool.inputSchema)) : z.object({});

  if (isLoading) {
    return (
      <div className="p-4">
        <Skeleton className="mb-4 h-8 w-48" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (error) return null;

  if (!tool)
    return (
      <div className="px-4 py-8 text-center">
        <Txt variant="heading" tone="muted">
          Tool not found
        </Txt>
      </div>
    );

  return (
    <ToolView
      header={
        <ToolInformation
          toolId={tool.id}
          toolDescription={tool.description ?? ''}
          requiresApproval={tool.requireApproval}
        />
      }
      overview={
        <ToolOverview
          inputSchema={parseToolSchema(tool.inputSchema)}
          outputSchema={parseToolSchema(tool.outputSchema)}
          requestContextSchema={parseToolSchema(tool.requestContextSchema)}
          aside={<ToolUsedBy toolId={tool.id} />}
        />
      }
      playground={
        canExecuteTool ? (
          <ToolExecutor
            zodInputSchema={zodInputSchema}
            handleExecuteTool={handleExecuteTool}
            requestContextEntityType="tool"
            requestContextEntityId={tool.id}
          />
        ) : undefined
      }
    />
  );
};

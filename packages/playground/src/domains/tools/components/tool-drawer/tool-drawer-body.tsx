import type { GetToolResponse } from '@mastra/client-js';
import { useApiToolSchemas } from '../../hooks/use-api-tool-schemas';
import type { ExecuteTool } from '../../hooks/use-tool-run';
import { ToolOverview } from '../tool-overview';
import { ToolPlayground } from '../tool-playground';
import { ToolDrawerContent } from './tool-drawer-content';
import { ToolUsedBySection } from './tool-used-by-section';
import { usePermissions } from '@/domains/auth/hooks/use-permissions';

export interface ToolDrawerBodyProps {
  tool: GetToolResponse;
  execute: ExecuteTool;
  /** The agent the drawer was opened from: marked Current under Used by, and the request context's scope. */
  currentAgentId?: string;
}

/** Overview and Playground for a tool from the tools or agents API. */
export function ToolDrawerBody({ tool, execute, currentAgentId }: ToolDrawerBodyProps) {
  const { canExecute } = usePermissions();
  // Request context is saved per tool, and per agent-and-tool when opened from an agent.
  const requestContextEntityType = currentAgentId ? 'agent-tool' : 'tool';
  const requestContextEntityId = currentAgentId ? `${currentAgentId}:${tool.id}` : tool.id;
  const { inputSchema, outputSchema, requestContextSchema, zodInputSchema } = useApiToolSchemas(tool);

  return (
    <ToolDrawerContent
      description={tool.description}
      overview={
        <ToolOverview
          inputSchema={inputSchema}
          outputSchema={outputSchema}
          requestContextSchema={requestContextSchema}
          footer={<ToolUsedBySection toolId={tool.id} currentAgentId={currentAgentId} />}
        />
      }
      canRun={canExecute('tools')}
      playground={
        <ToolPlayground
          zodInputSchema={zodInputSchema}
          execute={execute}
          requestContextEntityType={requestContextEntityType}
          requestContextEntityId={requestContextEntityId}
        />
      }
    />
  );
}

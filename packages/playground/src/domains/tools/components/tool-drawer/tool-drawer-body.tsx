import type { GetToolResponse } from '@mastra/client-js';
import type { RequestContextEntityType } from '@mastra/playground-ui/domains/request-context/hooks/use-entity-request-context';
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
  /** The agent the drawer was opened from: marked Current under Used by. */
  currentAgentId?: string;
  /** Where the request context is saved: per tool, or per agent and tool when opened from an agent. */
  requestContextEntityType: RequestContextEntityType;
  requestContextEntityId: string;
}

/** Overview and Playground for a tool from the tools or agents API. */
export function ToolDrawerBody({
  tool,
  execute,
  currentAgentId,
  requestContextEntityType,
  requestContextEntityId,
}: ToolDrawerBodyProps) {
  const { canExecute } = usePermissions();
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

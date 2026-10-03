import type { RequestContextEntityType } from '@mastra/playground-ui/domains/request-context/hooks/use-entity-request-context';
import { useEntityRequestContext } from '@mastra/playground-ui/domains/request-context/hooks/use-entity-request-context';
import type { ZodType } from 'zod';
import type { ExecuteTool } from '../hooks/use-tool-run';
import { useToolRun } from '../hooks/use-tool-run';
import { ToolRequest } from './tool-request';
import { ToolResponse } from './tool-response';

export interface ToolPlaygroundProps {
  zodInputSchema: ZodType;
  /** Runs the tool and resolves with its output; a rejection is shown as an error response. */
  execute: ExecuteTool;
  requestContextEntityType: RequestContextEntityType;
  requestContextEntityId: string;
}

/** The Playground tab: the request form, then the last response. */
export function ToolPlayground({
  zodInputSchema,
  execute,
  requestContextEntityType,
  requestContextEntityId,
}: ToolPlaygroundProps) {
  const [requestContext] = useEntityRequestContext(requestContextEntityType, requestContextEntityId);
  const { runTool, isRunning, lastRun } = useToolRun(execute, requestContext);

  return (
    <div className="grid content-start gap-6">
      <ToolRequest
        zodInputSchema={zodInputSchema}
        isRunning={isRunning}
        onRun={runTool}
        requestContextEntityType={requestContextEntityType}
        requestContextEntityId={requestContextEntityId}
      />
      <ToolResponse isRunning={isRunning} lastRun={lastRun} />
    </div>
  );
}

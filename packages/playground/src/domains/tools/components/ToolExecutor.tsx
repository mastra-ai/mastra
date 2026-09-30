import type { RequestContextEntityType } from '@mastra/playground-ui/domains/request-context/hooks/use-entity-request-context';
import { useEntityRequestContext } from '@mastra/playground-ui/domains/request-context/hooks/use-entity-request-context';
import type { ZodType } from 'zod';
import type { ExecuteTool } from '../hooks/use-tool-run';
import { useToolRun } from '../hooks/use-tool-run';
import { ToolRequest } from './tool-request';
import { ToolResponse } from './tool-response';

interface ToolExecutorProps {
  zodInputSchema: ZodType;
  /** Runs the tool and resolves with its output; a rejection is shown as an error response. */
  handleExecuteTool: ExecuteTool;
  requestContextEntityType: RequestContextEntityType;
  requestContextEntityId: string;
}

/** The Playground: a request form next to the last response. */
const ToolExecutor = ({
  zodInputSchema,
  handleExecuteTool,
  requestContextEntityType,
  requestContextEntityId,
}: ToolExecutorProps) => {
  const [requestContext] = useEntityRequestContext(requestContextEntityType, requestContextEntityId);
  const { runTool, isRunning, lastRun } = useToolRun(handleExecuteTool, requestContext);

  return (
    <div className="grid content-start items-stretch gap-4 lg:grid-cols-2">
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
};

export default ToolExecutor;

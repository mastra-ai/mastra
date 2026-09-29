import type { MCPToolType } from '@mastra/core/mcp';
import { CodeEditor } from '@mastra/playground-ui/components/CodeEditor';
import { Notice } from '@mastra/playground-ui/components/Notice';
import type { RequestContextEntityType } from '@mastra/playground-ui/domains/request-context/hooks/use-entity-request-context';
import { useEntityRequestContext } from '@mastra/playground-ui/domains/request-context/hooks/use-entity-request-context';
import { DynamicForm } from '@mastra/playground-ui/lib/form/dynamic-form';
import { isEmptyZodObject } from '@mastra/playground-ui/lib/form/is-empty-zod-object';
import { cn } from '@mastra/playground-ui/utils/cn';
import type { ZodType } from 'zod';
import { RequestContextPopover } from '@/domains/run-options/components/request-context-popover';
import { ToolInformation } from '@/domains/tools/components/ToolInformation';

interface ToolExecutorProps {
  isExecutingTool: boolean;
  zodInputSchema: ZodType;
  handleExecuteTool: (data: any, schemaRequestContext?: Record<string, any>) => void;
  executionResult: any;
  errorString?: string;
  toolDescription: string;
  toolId: string;
  toolType?: MCPToolType;
  requestContextEntityType: RequestContextEntityType;
  requestContextEntityId: string;
}

const ToolExecutor = ({
  isExecutingTool,
  zodInputSchema,
  handleExecuteTool,
  errorString,
  toolDescription,
  toolId,
  toolType,
  requestContextEntityType,
  requestContextEntityId,
  executionResult: result,
}: ToolExecutorProps) => {
  const hasResult = errorString !== undefined || result !== undefined;
  const code = JSON.stringify(result ?? {}, null, 2);
  const [requestContext] = useEntityRequestContext(requestContextEntityType, requestContextEntityId);
  const hasInputFields = !isEmptyZodObject(zodInputSchema);

  return (
    <div className="grid h-full min-w-min content-start items-start overflow-x-auto overflow-y-auto">
      <div className="flex w-full flex-col items-center p-5 lg:flex-row lg:items-start lg:justify-center">
        <div className="grid w-full max-w-3xl min-w-0 content-start gap-5">
          <ToolInformation toolDescription={toolDescription} toolId={toolId} toolType={toolType} />
          <div>
            <DynamicForm
              isSubmitLoading={isExecutingTool}
              schema={zodInputSchema}
              onSubmit={data => {
                handleExecuteTool(data, requestContext);
              }}
              className="space-y-4"
              submitActions={
                <RequestContextPopover entityType={requestContextEntityType} entityId={requestContextEntityId} />
              }
            >
              {!hasInputFields && <Notice variant="info">No input is required to run this tool.</Notice>}
            </DynamicForm>
          </div>
        </div>
        <div
          className={cn(
            'w-full min-w-0 overflow-hidden lg:transition-[max-width,opacity,margin-left] lg:duration-300 lg:ease-in-out',
            hasResult
              ? 'mt-5 max-w-3xl opacity-100 lg:mt-0 lg:ml-5'
              : 'hidden lg:ml-0 lg:block lg:max-w-0 lg:opacity-0',
          )}
        >
          <CodeEditor value={errorString || code} language="json" editable={false} />
        </div>
      </div>
    </div>
  );
};

export default ToolExecutor;

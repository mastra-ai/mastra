import type { MCPToolType } from '@mastra/core/mcp';
import { CodeEditor } from '@mastra/playground-ui/components/CodeEditor';
import { MainContentContent } from '@mastra/playground-ui/components/MainContent';
import { Notice } from '@mastra/playground-ui/components/Notice';
import { RequestContextProvider, useRequestContext } from '@mastra/playground-ui/domains/request-context';
import { RunOptionsPopover } from '@mastra/playground-ui/domains/run-options';
import { cn } from '@mastra/playground-ui/utils/cn';
import type { ReactNode } from 'react';
import type { ZodType } from 'zod';
import { ToolInformation } from '@/domains/tools/components/ToolInformation';
import { DynamicForm } from '@/lib/form/dynamic-form';
import { isEmptyZodObject } from '@/lib/form/is-empty-zod-object';

interface ToolExecutorProps {
  isExecutingTool: boolean;
  zodInputSchema: ZodType;
  handleExecuteTool: (data: any, requestContext: Record<string, unknown>) => void;
  executionResult: any;
  errorString?: string;
  toolDescription: string;
  toolId: string;
  toolType?: MCPToolType;
  requestContextSchema?: string;
  /** Owner of the persisted request context, e.g. `tool:<toolId>` or `agent:<agentId>`. */
  entityKey: string;
  beforeContent?: ReactNode;
}

/** Inner component that can access the entity request context */
const ToolExecutorContent = ({
  isExecutingTool,
  zodInputSchema,
  handleExecuteTool,
  result,
  errorString,
  toolDescription,
  toolId,
  toolType,
  requestContextSchema,
}: Omit<ToolExecutorProps, 'executionResult' | 'entityKey'> & { result: any }) => {
  const hasResult = errorString !== undefined || result !== undefined;
  const code = JSON.stringify(result ?? {}, null, 2);
  const { requestContext } = useRequestContext();
  const hasInputFields = !isEmptyZodObject(zodInputSchema);

  return (
    <MainContentContent>
      <div className="flex w-full flex-col items-center p-5 lg:flex-row lg:items-start lg:justify-center">
        <div className="grid w-full max-w-3xl min-w-0 content-start gap-5">
          <div className="flex items-start justify-between gap-3">
            <ToolInformation toolDescription={toolDescription} toolId={toolId} toolType={toolType} />
            <RunOptionsPopover
              triggerVariant="icon"
              align="end"
              testId="tool-run-options-trigger"
              requestContextSchema={requestContextSchema}
              requestContextTooltip="Request context values are passed to this tool execution."
            />
          </div>
          <DynamicForm
            isSubmitLoading={isExecutingTool}
            schema={zodInputSchema}
            onSubmit={data => {
              handleExecuteTool(data, requestContext);
            }}
            className="space-y-4"
          >
            {!hasInputFields && <Notice variant="info">No input is required to run this tool.</Notice>}
          </DynamicForm>
        </div>
        <div
          className={cn(
            'w-full min-w-0 overflow-hidden lg:transition-[max-width,opacity,margin-left] lg:duration-300 lg:ease-in-out',
            hasResult
              ? 'mt-5 max-w-3xl opacity-100 lg:ml-5 lg:mt-0'
              : 'hidden lg:block lg:ml-0 lg:max-w-0 lg:opacity-0',
          )}
        >
          <CodeEditor value={errorString || code} language="json" editable={false} />
        </div>
      </div>
    </MainContentContent>
  );
};

const ToolExecutor = ({ executionResult: result, entityKey, beforeContent, ...props }: ToolExecutorProps) => {
  return (
    <RequestContextProvider key={entityKey} entityKey={entityKey}>
      {beforeContent}
      <ToolExecutorContent {...props} result={result} />
    </RequestContextProvider>
  );
};

export default ToolExecutor;

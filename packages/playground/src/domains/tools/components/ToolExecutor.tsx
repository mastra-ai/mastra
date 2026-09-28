import type { MCPToolType } from '@mastra/core/mcp';
import { CodeEditor } from '@mastra/playground-ui/components/CodeEditor';
import { Notice } from '@mastra/playground-ui/components/Notice';
import { Tabs, Tab, TabList } from '@mastra/playground-ui/components/Tabs';
import { DynamicForm } from '@mastra/playground-ui/lib/form/dynamic-form';
import { isEmptyZodObject } from '@mastra/playground-ui/lib/form/is-empty-zod-object';
import { cn } from '@mastra/playground-ui/utils/cn';
import { useState } from 'react';
import type { ZodType } from 'zod';
import {
  RequestContextSchemaForm,
  SchemaRequestContextProvider,
  useSchemaRequestContext,
} from '@/domains/request-context';
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
  requestContextSchema?: string;
}

/** Inner component that can access SchemaRequestContext */
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
}: Omit<ToolExecutorProps, 'executionResult'> & { result: any }) => {
  const hasResult = errorString !== undefined || result !== undefined;
  const code = JSON.stringify(result ?? {}, null, 2);
  const [selectedTab, setSelectedTab] = useState('input-data');
  const { schemaValues, setSchemaValues } = useSchemaRequestContext();
  const hasInputFields = !isEmptyZodObject(zodInputSchema);
  const hasConfiguration = hasInputFields || Boolean(requestContextSchema);

  return (
    <div className="grid h-full min-w-min content-start items-start overflow-x-auto overflow-y-auto">
      <div className="flex w-full flex-col items-center p-5 lg:flex-row lg:items-start lg:justify-center">
        <div className="grid w-full max-w-3xl min-w-0 content-start gap-5">
          <ToolInformation toolDescription={toolDescription} toolId={toolId} toolType={toolType} />
          {hasConfiguration && (
            <Tabs defaultTab="input-data" value={selectedTab} onValueChange={setSelectedTab}>
              <TabList variant="pill">
                <Tab value="input-data">Input Data</Tab>
                {requestContextSchema && <Tab value="request-context">Request Context</Tab>}
              </TabList>
            </Tabs>
          )}
          <div className={cn(selectedTab !== 'input-data' && 'hidden')}>
            <DynamicForm
              isSubmitLoading={isExecutingTool}
              schema={zodInputSchema}
              onSubmit={data => {
                handleExecuteTool(data, schemaValues);
              }}
              className="space-y-4"
            >
              {!hasInputFields && <Notice variant="info">No input is required to run this tool.</Notice>}
            </DynamicForm>
          </div>
          {requestContextSchema && (
            <div className={cn(selectedTab !== 'request-context' && 'hidden')}>
              <RequestContextSchemaForm
                requestContextSchema={requestContextSchema}
                values={schemaValues}
                onSave={setSchemaValues}
              />
            </div>
          )}
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

const ToolExecutor = ({
  isExecutingTool,
  zodInputSchema,
  handleExecuteTool,
  executionResult: result,
  errorString,
  toolDescription,
  toolId,
  toolType,
  requestContextSchema,
}: ToolExecutorProps) => {
  return (
    <SchemaRequestContextProvider>
      <ToolExecutorContent
        isExecutingTool={isExecutingTool}
        zodInputSchema={zodInputSchema}
        handleExecuteTool={handleExecuteTool}
        result={result}
        errorString={errorString}
        toolDescription={toolDescription}
        toolId={toolId}
        toolType={toolType}
        requestContextSchema={requestContextSchema}
      />
    </SchemaRequestContextProvider>
  );
};

export default ToolExecutor;

import { jsonLanguage } from '@codemirror/lang-json';
import type { MCPToolType } from '@mastra/core/mcp';
import { useCodemirrorTheme, CopyButton, MainContentContent, Tabs, Tab, TabList, cn } from '@mastra/playground-ui';
import CodeMirror from '@uiw/react-codemirror';
import { useState } from 'react';
import type { ZodType } from 'zod';
import {
  RequestContextSchemaForm,
  SchemaRequestContextProvider,
  useSchemaRequestContext,
} from '@/domains/request-context';
import { ToolInformation } from '@/domains/tools/components/ToolInformation';
import { DynamicForm } from '@/lib/form';

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
  const theme = useCodemirrorTheme();
  const code = JSON.stringify(result ?? {}, null, 2);
  const [selectedTab, setSelectedTab] = useState('input-data');
  const { schemaValues } = useSchemaRequestContext();

  return (
    <MainContentContent hasLeftServiceColumn={true} className="relative">
      <div className="bg-surface2 border-r border-border1 w-80 flex flex-col">
        <ToolInformation toolDescription={toolDescription} toolId={toolId} toolType={toolType} />
        <div className="flex-1 overflow-hidden border-t border-border1 flex flex-col">
          <Tabs defaultTab="input-data" value={selectedTab} onValueChange={setSelectedTab}>
            <TabList>
              <Tab value="input-data">Input Data</Tab>
              {requestContextSchema && <Tab value="request-context">Request Context</Tab>}
            </TabList>
          </Tabs>
          <div className={cn('p-5 overflow-y-auto', selectedTab !== 'input-data' && 'hidden')}>
            <DynamicForm
              isSubmitLoading={isExecutingTool}
              schema={zodInputSchema}
              onSubmit={data => {
                handleExecuteTool(data, schemaValues);
              }}
              className="h-auto pb-7"
            />
          </div>
          {requestContextSchema && (
            <div className={cn('p-5 overflow-y-auto', selectedTab !== 'request-context' && 'hidden')}>
              <RequestContextSchemaForm requestContextSchema={requestContextSchema} />
            </div>
          )}
        </div>
      </div>
      <div className="absolute top-4 right-4 z-10">
        <CopyButton content={code} tooltip="Copy JSON result to clipboard" />
      </div>
      <div className="p-5 h-full relative overflow-x-auto overflow-y-auto">
        <CodeMirror value={errorString || code} editable={true} theme={theme} extensions={[jsonLanguage]} />
      </div>
    </MainContentContent>
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

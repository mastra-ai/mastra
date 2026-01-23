import { DynamicForm } from '@/lib/form';
import { CopyButton } from '@/ds/components/CopyButton';
import { ZodType } from 'zod';
import { ToolInformation } from '@/domains/tools/components/ToolInformation';
import { jsonLanguage } from '@codemirror/lang-json';
import { useCodemirrorTheme } from '@/ds/components/CodeEditor';
import CodeMirror from '@uiw/react-codemirror';
import { MCPToolType } from '@mastra/core/mcp';
import { MainContentContent } from '@/ds/components/MainContent';
import {
  RequestContextSchemaForm,
  SchemaRequestContextProvider,
  useSchemaRequestContext,
} from '@/domains/request-context';
import { Tabs, Tab, TabList } from '@/ds/components/Tabs';
import { useState } from 'react';
import { cn } from '@/lib/utils';

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
      <div className="bg-surface2 border-r border-border1 w-[20rem] flex flex-col">
        <ToolInformation toolDescription={toolDescription} toolId={toolId} toolType={toolType} />
        <div className="flex-1 overflow-hidden border-t border-border1 flex flex-col">
          <Tabs defaultTab="input-data" value={selectedTab} onValueChange={setSelectedTab}>
            <TabList>
              <Tab value="input-data">Input Data</Tab>
              {requestContextSchema && <Tab value="request-context">Request Context</Tab>}
            </TabList>
          </Tabs>
          {/* Keep both panels mounted to preserve state, use CSS to show/hide */}
          <div className={cn('p-5 overflow-y-auto', selectedTab !== 'input-data' && 'hidden')}>
            <DynamicForm
              isSubmitLoading={isExecutingTool}
              schema={zodInputSchema}
              onSubmit={data => {
                // Pass schema context values along with input data
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

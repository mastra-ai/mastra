import { useRef } from 'react';
import { DynamicForm } from '@/components/dynamic-form';
import { CopyButton } from '@/components/ui/copy-button';
import { ZodType } from 'zod';
import { ToolInformation } from '@/domains/tools/components/ToolInformation';
import { jsonLanguage } from '@codemirror/lang-json';
import { useCodemirrorTheme } from '@/components/syntax-highlighter';
import CodeMirror from '@uiw/react-codemirror';
import { MCPToolType } from '@mastra/core/mcp';
import { MainContentContent } from '@/components/ui/containers/MainContent';
import { PlaygroundTabs, TabList, Tab, TabContent } from '@/components/ui/playground-tabs';
import { Txt } from '@/ds/components/Txt';
import { Button } from '@/ds/components/Button/Button';
import { Icon } from '@/ds/icons/Icon';
import { CopyIcon } from 'lucide-react';
import { useCopyToClipboard } from '@/hooks/use-copy-to-clipboard';

interface ToolExecutorProps {
  isExecutingTool: boolean;
  zodInputSchema: ZodType;
  zodRequestContextSchema?: ZodType;
  initialRequestContextValues?: Record<string, any>;
  onRequestContextChange?: (data: Record<string, any>) => void;
  handleExecuteTool: (data: any) => void;
  executionResult: any;
  errorString?: string;
  toolDescription: string;
  toolId: string;
  toolType?: MCPToolType;
}

const ToolExecutor = ({
  isExecutingTool,
  zodInputSchema,
  zodRequestContextSchema,
  initialRequestContextValues,
  onRequestContextChange,
  handleExecuteTool,
  executionResult: result,
  errorString,
  toolDescription,
  toolId,
  toolType,
}: ToolExecutorProps) => {
  const theme = useCodemirrorTheme();
  const code = JSON.stringify(result ?? {}, null, 2);
  const hasRequestContextSchema = Boolean(zodRequestContextSchema);

  // Use a ref to track the current request context value for the copy button
  const requestContextValueRef = useRef<Record<string, unknown>>(initialRequestContextValues || {});

  const { handleCopy: handleCopyRequestContext } = useCopyToClipboard({
    text: JSON.stringify(requestContextValueRef.current, null, 2),
  });

  return (
    <MainContentContent hasLeftServiceColumn={true} className="relative">
      <div className="bg-surface2 border-r-sm border-border1 w-[20rem] overflow-y-auto flex flex-col">
        <ToolInformation toolDescription={toolDescription} toolId={toolId} toolType={toolType} />
        <div className="flex-1 overflow-auto border-t-sm border-border1 flex flex-col">
          <PlaygroundTabs defaultTab="input" className="h-full">
            <TabList>
              <Tab value="input">Input</Tab>
              {hasRequestContextSchema && <Tab value="request-context">Request Context</Tab>}
            </TabList>

            <TabContent value="input">
              <div className="p-5">
                <DynamicForm
                  isSubmitLoading={isExecutingTool}
                  schema={zodInputSchema}
                  onSubmit={data => {
                    handleExecuteTool(data);
                  }}
                  className="h-auto pb-7"
                />
              </div>
            </TabContent>

            {hasRequestContextSchema && (
              <TabContent value="request-context">
                <div className="p-5">
                  <div className="flex justify-between items-center mb-4">
                    <Txt as="p" variant="ui-sm" className="text-icon3">
                      This tool has a request context schema defined.
                    </Txt>
                    <Button variant="light" size="md" onClick={handleCopyRequestContext}>
                      <Icon>
                        <CopyIcon className="h-4 w-4" />
                      </Icon>
                    </Button>
                  </div>
                  <DynamicForm
                    schema={zodRequestContextSchema!}
                    defaultValues={initialRequestContextValues}
                    onChange={(values: unknown) => {
                      requestContextValueRef.current = values as Record<string, unknown>;
                      onRequestContextChange?.(values as Record<string, any>);
                    }}
                    hideSubmitButton={true}
                    className="h-auto"
                  />
                </div>
              </TabContent>
            )}
          </PlaygroundTabs>
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

export { ToolExecutor };

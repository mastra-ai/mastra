import { DynamicForm, Txt } from '@mastra/playground-ui';
import { CopyButton } from '@/components/ui/copy-button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ZodType } from 'zod';
import { ToolInformation } from '@/domains/tools/ToolInformation';
import { jsonLanguage } from '@codemirror/lang-json';
import { useCodemirrorTheme } from '@/components/syntax-highlighter';
import CodeMirror from '@uiw/react-codemirror';
export interface ToolExecutorProps {
  isExecutingTool: boolean;
  zodInputSchema: ZodType;
  handleExecuteTool: (data: any) => void;
  executionResult: any;
  toolDescription: string;
  toolId: string;
}

const ToolExecutor = ({
  isExecutingTool,
  zodInputSchema,
  handleExecuteTool,
  executionResult: result,
  toolDescription,
  toolId,
}: ToolExecutorProps) => {
  const theme = useCodemirrorTheme();
  const code = JSON.stringify(result ?? {}, null, 2);

  return (
    <div className="w-full h-full grid grid-cols-[300px_1fr] bg-surface1">
      <div className="border-r-sm border-border1 bg-surface2">
        <ToolInformation toolDescription={toolDescription} toolId={toolId} />

        <div className="w-full h-[calc(100vh-144px)] p-5 overflow-y-scroll">
          <DynamicForm
            isSubmitLoading={isExecutingTool}
            schema={zodInputSchema}
            onSubmit={data => {
              handleExecuteTool(data);
            }}
          />
        </div>
      </div>

      <div className="p-5">
        <div className="flex items-center gap-2">
          <Txt variant="ui-sm" className="text-icon3">
            Output
          </Txt>

          <CopyButton content={code} tooltip="Copy JSON result to clipboard" />
        </div>

        <ScrollArea className="h-[calc(100vh-120px)] w-full pt-2">
          <CodeMirror
            value={code}
            editable={false}
            theme={theme}
            extensions={[jsonLanguage]}
            className="overflow-y-scroll bg-surface2 rounded-lg p-5"
          />
        </ScrollArea>
      </div>
    </div>
  );
};

export default ToolExecutor;

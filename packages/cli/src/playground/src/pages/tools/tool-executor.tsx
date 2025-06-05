import { DynamicForm } from '@mastra/playground-ui';
import { CopyButton } from '@/components/ui/copy-button';
import { ZodType } from 'zod';
import { ToolInformation } from '@/domains/tools/ToolInformation';
import { jsonLanguage } from '@codemirror/lang-json';
import { useCodemirrorTheme } from '@/components/syntax-highlighter';
import CodeMirror from '@uiw/react-codemirror';
import { MCPToolType } from '@mastra/core/mcp';

export interface ToolExecutorProps {
  isExecutingTool: boolean;
  zodInputSchema: ZodType;
  handleExecuteTool: (data: any) => void;
  executionResult: any;
  toolDescription: string;
  toolId: string;
  toolType?: MCPToolType;
}

const ToolExecutor = ({
  isExecutingTool,
  zodInputSchema,
  handleExecuteTool,
  executionResult: result,
  toolDescription,
  toolId,
  toolType,
}: ToolExecutorProps) => {
  const theme = useCodemirrorTheme();
  const code = JSON.stringify(result ?? {}, null, 2);

  return (
    <div className="grid relative bg-surface1 h-full overflow-y-auto grid-cols-[minmax(14rem,_24rem)_minmax(20rem,_1fr)]">
      <div className="border-r-sm border-border1 bg-surface2 grid grid-rows-[auto_1fr] overflow-y-auto">
        <ToolInformation toolDescription={toolDescription} toolId={toolId} toolType={toolType} />
        <div className="p-5 overflow-y-auto">
          <DynamicForm
            isSubmitLoading={isExecutingTool}
            schema={zodInputSchema}
            onSubmit={data => {
              handleExecuteTool(data);
            }}
            className="h-auto"
          />
        </div>
      </div>
      <div className="absolute top-4 right-4 z-10">
        <CopyButton content={code} tooltip="Copy JSON result to clipboard" />
      </div>
      <div className="p-5 h-full relative overflow-x-auto overflow-y-auto">
        <CodeMirror value={code} editable={true} theme={theme} extensions={[jsonLanguage]} />
      </div>
    </div>
  );
};

export default ToolExecutor;

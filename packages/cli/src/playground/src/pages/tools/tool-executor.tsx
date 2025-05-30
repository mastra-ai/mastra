import { DynamicForm } from '@mastra/playground-ui';
import { CopyButton } from '@/components/ui/copy-button';
import { ScrollArea } from '@/components/ui/scroll-area';
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
    <div className="w-full h-full grid grid-cols-[400px_1fr] bg-surface1  max-h-[calc(100vh-70px)] overflow-y-hidden">
      <div className="border-r-sm border-border1 bg-surface2">
        <ToolInformation toolDescription={toolDescription} toolId={toolId} toolType={toolType} />

        <div className="w-full p-5 overflow-y-auto">
          <DynamicForm
            isSubmitLoading={isExecutingTool}
            schema={zodInputSchema}
            onSubmit={data => {
              handleExecuteTool(data);
            }}
          />
        </div>
      </div>

      <div className="p-5 relative" style={{ maxHeight: '100%', maxWidth: '100%', overflowX: 'auto' }}>
        <CodeMirror
          value={code}
          editable={true}
          theme={theme}
          extensions={[jsonLanguage]}
          className="overflow-y-scroll "
        />
      </div>

      <div className="absolute top-16 right-8 z-10">
        <CopyButton content={code} tooltip="Copy JSON result to clipboard" />
      </div>
    </div>
  );
};

export default ToolExecutor;

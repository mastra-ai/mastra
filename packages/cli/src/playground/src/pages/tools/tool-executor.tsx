import { DynamicForm } from '@mastra/playground-ui';
import { CodeBlockDemo } from '@/components/ui/code-block';
import { CopyButton } from '@/components/ui/copy-button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Text } from '@/components/ui/text';

const ToolExecutor = ({
  isExecutingTool,
  zodInputSchema,
  handleExecuteTool,
  executionResult: result,
}: {
  zodInputSchema: any;
  isExecutingTool: boolean;
  handleExecuteTool: (data: any) => void;
  executionResult: any;
}) => {
  return (
    <div className="w-full h-full grid grid-cols-[300px_1fr] p-2 gap-2">
      <div className="flex flex-col gap-4 border-[0.5px] border-mastra-border-1 rounded-[0.25rem] bg-mastra-bg-2 p-4 py-6">
        <Text variant="secondary" className="text-mastra-el-3 px-4" size="xs">
          Input
        </Text>
        <div className="w-full h-[calc(100vh-126px)] ">
          <DynamicForm
            isSubmitLoading={isExecutingTool}
            schema={zodInputSchema}
            onSubmit={data => {
              handleExecuteTool(data);
            }}
          />
        </div>
      </div>
      <div className="flex relative group flex-col gap-4 border-[0.5px] border-mastra-border-1 rounded-[0.25rem] bg-mastra-bg-2 p-4 py-6">
        <Text variant="secondary" className="text-mastra-el-3  px-4" size="xs">
          Output
        </Text>
        <div className="flex flex-col  gap-2">
          <CopyButton
            classname="absolute z-40 top-4 right-4 w-8 h-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity duration-150 ease-in-out"
            content={JSON.stringify(result ?? {}, null, 2)}
          />
        </div>
        <ScrollArea className="h-[calc(100vh-120px)] w-full">
          <CodeBlockDemo code={JSON.stringify(result ?? {}, null, 2)} language="json" />
        </ScrollArea>
      </div>
    </div>
  );
};

export default ToolExecutor;

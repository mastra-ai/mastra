import { ScrollArea } from '@/components/ui/scroll-area';

export function WorkflowEndpoints({ workflowId, isVNext }: { workflowId: string; isVNext?: boolean }) {
  return (
    <ScrollArea className="h-[calc(100vh-126px)] pt-2 px-4 pb-4 text-xs w-full">
      <div className="space-y-4">
        <div className="grid grid-cols-[70px_1fr] gap-2">
          <p className="text-mastra-el-3">GET</p>
          <p className="text-mastra-el-5">/api/workflows{isVNext ? '/v-next' : ''}</p>
        </div>
        <div className="grid grid-cols-[70px_1fr] gap-2">
          <p className="text-mastra-el-3">GET</p>
          <p className="text-mastra-el-5">
            /api/workflows{isVNext ? '/v-next' : ''}/{workflowId}
          </p>
        </div>
        <div className="grid grid-cols-[70px_1fr] gap-2">
          <p className="text-mastra-el-3">POST</p>
          <p className="text-mastra-el-5">
            /api/workflows{isVNext ? '/v-next' : ''}/{workflowId}
          </p>
        </div>
        <div className="grid grid-cols-[70px_1fr] gap-2">
          <p className="text-mastra-el-3">POST</p>
          <p className="text-mastra-el-5">
            /api/workflows{isVNext ? '/v-next' : ''}/{workflowId}/createRun
          </p>
        </div>
        <div className="grid grid-cols-[70px_1fr] gap-2">
          <p className="text-mastra-el-3">POST</p>
          <p className="text-mastra-el-5">
            /api/workflows{isVNext ? '/v-next' : ''}/{workflowId}/resume-async
          </p>
        </div>
        <div className="grid grid-cols-[70px_1fr] gap-2">
          <p className="text-mastra-el-3">POST</p>
          <p className="text-mastra-el-5">
            /api/workflows{isVNext ? '/v-next' : ''}/{workflowId}/start-async
          </p>
        </div>
        <div className="grid grid-cols-[70px_1fr] gap-2">
          <p className="text-mastra-el-3">POST</p>
          <p className="text-mastra-el-5">
            /api/workflows{isVNext ? '/v-next' : ''}/{workflowId}/watch
          </p>
        </div>
        <div className="grid grid-cols-[70px_1fr] gap-2">
          <p className="text-mastra-el-3">POST</p>
          <p className="text-mastra-el-5">
            /api/workflows{isVNext ? '/v-next' : ''}/{workflowId}/resume
          </p>
        </div>
        <div className="grid grid-cols-[70px_1fr] gap-2">
          <p className="text-mastra-el-3">GET</p>
          <p className="text-mastra-el-5">
            /api/workflows{isVNext ? '/v-next' : ''}/{workflowId}/runs
          </p>
        </div>
      </div>
    </ScrollArea>
  );
}

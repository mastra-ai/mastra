import { ScrollArea } from '@/components/ui/scroll-area';

export function WorkflowEndpoints({ workflowId, isLegacy }: { workflowId: string; isLegacy?: boolean }) {
  return (
    <ScrollArea className="h-[calc(100vh-126px)] pt-2 px-4 pb-4 text-xs w-full">
      <div className="space-y-4">
        <div className="grid grid-cols-[70px_1fr] gap-2">
          <p className="text-mastra-el-3">GET</p>
          <p className="text-mastra-el-5">/api/workflows{isLegacy ? '/legacy' : ''}</p>
        </div>
        <div className="grid grid-cols-[70px_1fr] gap-2">
          <p className="text-mastra-el-3">GET</p>
          <p className="text-mastra-el-5">
            /api/workflows{isLegacy ? '/legacy' : ''}/{workflowId}
          </p>
        </div>
        <div className="grid grid-cols-[70px_1fr] gap-2">
          <p className="text-mastra-el-3">POST</p>
          <p className="text-mastra-el-5">
            /api/workflows{isLegacy ? '/legacy' : ''}/{workflowId}
          </p>
        </div>
        <div className="grid grid-cols-[70px_1fr] gap-2">
          <p className="text-mastra-el-3">POST</p>
          <p className="text-mastra-el-5">
            /api/workflows{isLegacy ? '/legacy' : ''}/{workflowId}/createRun
          </p>
        </div>
        <div className="grid grid-cols-[70px_1fr] gap-2">
          <p className="text-mastra-el-3">POST</p>
          <p className="text-mastra-el-5">
            /api/workflows{isLegacy ? '/legacy' : ''}/{workflowId}/resume-async
          </p>
        </div>
        <div className="grid grid-cols-[70px_1fr] gap-2">
          <p className="text-mastra-el-3">POST</p>
          <p className="text-mastra-el-5">
            /api/workflows{isLegacy ? '/legacy' : ''}/{workflowId}/start-async
          </p>
        </div>
        <div className="grid grid-cols-[70px_1fr] gap-2">
          <p className="text-mastra-el-3">POST</p>
          <p className="text-mastra-el-5">
            /api/workflows{isLegacy ? '/legacy' : ''}/{workflowId}/watch
          </p>
        </div>
        <div className="grid grid-cols-[70px_1fr] gap-2">
          <p className="text-mastra-el-3">POST</p>
          <p className="text-mastra-el-5">
            /api/workflows{isLegacy ? '/legacy' : ''}/{workflowId}/resume
          </p>
        </div>
        <div className="grid grid-cols-[70px_1fr] gap-2">
          <p className="text-mastra-el-3">GET</p>
          <p className="text-mastra-el-5">
            /api/workflows{isLegacy ? '/legacy' : ''}/{workflowId}/runs
          </p>
        </div>
      </div>
    </ScrollArea>
  );
}

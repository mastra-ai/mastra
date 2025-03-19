import { ScrollArea } from '@/components/ui/scroll-area';

export function NetworkEndpoints({ networkId }: { networkId: string }) {
  return (
    <ScrollArea className="h-[calc(100vh-126px)] pt-2 px-4 pb-4 text-xs w-[400px]">
      <div className="space-y-4">
        <div className="grid grid-cols-[70px_1fr] gap-2">
          <p className="text-mastra-el-3">GET</p>
          <p className="text-mastra-el-5">/api/networks</p>
        </div>
        <div className="grid grid-cols-[70px_1fr] gap-2">
          <p className="text-mastra-el-3">GET</p>
          <p className="text-mastra-el-5">/api/networks/{networkId}</p>
        </div>
        <div className="grid grid-cols-[70px_1fr] gap-2">
          <p className="text-mastra-el-3">POST</p>
          <p className="text-mastra-el-5">/api/networks/{networkId}/generate</p>
        </div>
        <div className="grid grid-cols-[70px_1fr] gap-2">
          <p className="text-mastra-el-3">POST</p>
          <p className="text-mastra-el-5">/api/networks/{networkId}/stream</p>
        </div>
      </div>
    </ScrollArea>
  );
}

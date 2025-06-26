import { ScrollArea } from '@/components/ui/scroll-area';

export function NetworkEndpoints({ networkId, isVNext }: { networkId: string; isVNext?: boolean }) {
  return (
    <ScrollArea className="pt-2 px-4 pb-4 text-xs w-[400px]">
      <div className="space-y-4">
        <div className="grid grid-cols-[70px_1fr] gap-2">
          <p className="text-mastra-el-3">GET</p>
          <p className="text-mastra-el-5">/api/networks{isVNext ? '/v-next' : ''}</p>
        </div>
        <div className="grid grid-cols-[70px_1fr] gap-2">
          <p className="text-mastra-el-3">GET</p>
          <p className="text-mastra-el-5">
            /api/networks{isVNext ? '/v-next' : ''}/{networkId}
          </p>
        </div>
        <div className="grid grid-cols-[70px_1fr] gap-2">
          <p className="text-mastra-el-3">POST</p>
          <p className="text-mastra-el-5">
            /api/networks{isVNext ? '/v-next' : ''}/{networkId}/generate
          </p>
        </div>
        <div className="grid grid-cols-[70px_1fr] gap-2">
          <p className="text-mastra-el-3">POST</p>
          <p className="text-mastra-el-5">
            /api/networks{isVNext ? '/v-next' : ''}/{networkId}/stream
          </p>
        </div>
        {isVNext ? (
          <>
            <div className="grid grid-cols-[70px_1fr] gap-2">
              <p className="text-mastra-el-3">POST</p>
              <p className="text-mastra-el-5">/api/networks/v-next/{networkId}/loop</p>
            </div>
            <div className="grid grid-cols-[70px_1fr] gap-2">
              <p className="text-mastra-el-3">POST</p>
              <p className="text-mastra-el-5">/api/networks/v-next/{networkId}/loop-stream</p>
            </div>
          </>
        ) : null}
      </div>
    </ScrollArea>
  );
}

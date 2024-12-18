import { RefreshCcwIcon } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';

import { useLogsByRunId } from '@/hooks/use-logs';

export function WorkflowLogs({ runId }: { runId: string }) {
  const { logs, isLoading, refetchLogs } = useLogsByRunId(runId);

  return (
    <ScrollArea className="h-[calc(100vh-126px)] px-4 pb-4 text-xs w-[400px]">
      <div className="flex justify-end sticky top-0 bg-mastra-bg-2 py-2">
        <Button variant="outline" onClick={() => refetchLogs(runId)}>
          {isLoading ? <RefreshCcwIcon className="w-4 h-4 animate-spin" /> : <RefreshCcwIcon className="w-4 h-4" />}
        </Button>
      </div>
      <div className="space-y-4">
        {logs.length === 0 ? (
          <p className="text-mastra-el-5">No logs yet</p>
        ) : (
          logs.map(log => {
            const parsedLogMessage = JSON.parse(log.message);
            return (
              <div key={log.timestamp} className="space-y-2">
                <div className="flex gap-2 items-center">
                  <p className="text-mastra-el-4">[{log.timestamp}]</p>
                  <p className="text-mastra-el-5">[{log.level}]</p>
                </div>
                <p className="text-mastra-el-5 whitespace-pre-wrap">
                  <code>{JSON.stringify(parsedLogMessage, null, 2)}</code>
                </p>
              </div>
            );
          })
        )}
      </div>
    </ScrollArea>
  );
}

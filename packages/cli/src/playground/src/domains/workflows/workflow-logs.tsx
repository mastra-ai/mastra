import { formatDate } from 'date-fns';

import { useLogsByRunId } from '@/hooks/use-logs';

export function WorkflowLogs({ runId }: { runId: string }) {
  const { data: logs = [], isLoading } = useLogsByRunId(runId);

  if (isLoading) return null;

  return (
    <div className="h-full px-4 pb-4 text-xs w-full overflow-y-auto">
      <div className="space-y-4 h-full overflow-y-auto">
        {logs.length === 0 ? (
          <p className="text-gray-300/60">
            No log drains. By default, logs are sent to the console. To configure log drains see{' '}
            <a
              href="https://mastra.ai/reference/observability/create-logger#upstash-logger-remote-log-drain"
              target="_blank"
              rel="noopener"
              className=" hover:text-gray-100 underline"
            >
              docs.
            </a>
          </p>
        ) : (
          logs.map((log, idx) => {
            return (
              <div key={idx} className="space-y-2">
                <div className="flex gap-2 items-center">
                  <p className="text-mastra-el-5">[{formatDate(new Date(log.time), 'yyyy-MM-dd HH:mm:ss')}]</p>
                  <p className="text-mastra-el-4">[{log.level}]</p>
                </div>
                <p className="text-mastra-el-5 whitespace-pre-wrap">
                  <code>{log.msg}</code>
                </p>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

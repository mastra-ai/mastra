import { formatDate } from 'date-fns';

import { useLogsByRunId } from '@/hooks/use-logs';
import { Table, Thead, Th, Tbody, Row, Cell, DateTimeCell, Badge, DebugIcon, InfoIcon } from '@mastra/playground-ui';

export function WorkflowLogs({ runId }: { runId: string }) {
  const { data: logs = [], isLoading } = useLogsByRunId(runId);

  if (isLoading) return null;

  return (
    <Table size="small">
      <Thead className="bg-surface2 sticky top-0">
        <Th>Time</Th>
        <Th>Level</Th>
        <Th>Message</Th>
      </Thead>
      <Tbody>
        {logs.map(log => {
          const date = new Date(log.time);

          return (
            <Row key={`${date.toISOString()}-${log.msg}`}>
              <DateTimeCell dateTime={date} />
              <StatusCell level={log.level} />
              <Cell>{log.msg}</Cell>
            </Row>
          );
        })}
      </Tbody>
    </Table>
  );

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

const StatusCell = ({ level }: { level: string }) => {
  const isDebug = ['error', 'debug'].includes(level);

  if (isDebug) {
    return (
      <Cell>
        <Badge variant="error" icon={<DebugIcon />}>
          {level}
        </Badge>
      </Cell>
    );
  }

  if (level === 'info') {
    return (
      <Cell>
        <Badge variant="info" icon={<InfoIcon />}>
          {level}
        </Badge>
      </Cell>
    );
  }

  return (
    <Cell>
      <Badge variant="default">{level}</Badge>
    </Cell>
  );
};

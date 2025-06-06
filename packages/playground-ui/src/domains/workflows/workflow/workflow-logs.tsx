import { BaseLogMessage } from '@mastra/core/logger';
import {
  Table,
  Thead,
  Th,
  Tbody,
  Row,
  Cell,
  DateTimeCell,
  UnstructuredDataCell,
} from '../../../ds/components/Table/index';
import { Badge } from '../../../ds/components/Badge/index';
import { DebugIcon } from '../../../ds/icons/index';
import { InfoIcon } from '../../../ds/icons/index';

export function WorkflowLogs({ logs }: { logs: BaseLogMessage[] }) {
  return (
    <Table size="small" className="table-fixed">
      <Thead className="bg-surface2 sticky top-0">
        <Th width={160}>Time</Th>
        <Th width={160}>Level</Th>
        <Th width="auto">Message</Th>
      </Thead>
      <Tbody>
        {logs.map((log, idx) => {
          const date = new Date(log.time);

          return <LogRow key={`${idx}-${date.toISOString()}-${log.msg}`} log={log} />;
        })}
      </Tbody>
    </Table>
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

const LogRow = ({ log }: { log: BaseLogMessage }) => {
  const date = new Date(log.time);
  const { level, time, hostname, runId, pid, name, ...unstructuredData } = log;

  return (
    <Row>
      <DateTimeCell dateTime={date} />
      <StatusCell level={log.level} />
      <UnstructuredDataCell data={unstructuredData} />
    </Row>
  );
};

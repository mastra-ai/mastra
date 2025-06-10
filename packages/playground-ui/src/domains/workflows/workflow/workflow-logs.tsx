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
import { Dialog, DialogContent, DialogPortal, DialogTitle } from '@/components/ui/dialog';
import { SyntaxHighlighter } from '@/components/syntax-highlighter';
import { useState } from 'react';

import { Skeleton } from '@/components/ui/skeleton';

export function WorkflowLogs({ logs, isLoading }: { logs: BaseLogMessage[]; isLoading?: boolean }) {
  return (
    <Table size="small" className="table-fixed">
      <Thead className="bg-surface2 sticky top-0">
        <Th width={160}>Time</Th>
        <Th width={160}>Level</Th>
        <Th width="auto">Message</Th>
      </Thead>
      <Tbody>
        {isLoading && (
          <Row>
            <Cell>
              <Skeleton className="w-1/2 h-4" />
            </Cell>
            <Cell>
              <Skeleton className="w-2/3 h-4" />
            </Cell>
            <Cell>
              <Skeleton className="w-1/2 h-4" />
            </Cell>
          </Row>
        )}

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
  const [open, setOpen] = useState(false);
  const date = new Date(log.time);
  const { level, time, hostname, runId, pid, name, ...unstructuredData } = log;

  return (
    <>
      <Row onClick={() => setOpen(s => !s)}>
        <DateTimeCell dateTime={date} />
        <StatusCell level={log.level} />
        <UnstructuredDataCell data={unstructuredData} />
      </Row>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogPortal>
          <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto overflow-x-hidden bg-surface2">
            <DialogTitle>Log details</DialogTitle>
            <div className="w-full h-full overflow-x-scroll">
              <SyntaxHighlighter data={unstructuredData} />
            </div>
          </DialogContent>
        </DialogPortal>
      </Dialog>
    </>
  );
};

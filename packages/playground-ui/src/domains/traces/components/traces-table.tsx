import { Skeleton } from '@/components/ui/skeleton';
import { Table, Tbody, Th, Row, Cell, DateTimeCell, UnitCell, TxtCell } from '@/ds/components/Table';
import { Thead } from '@/ds/components/Table';
import type { RefinedTrace } from '@/domains/traces/types';
import { Badge } from '@/ds/components/Badge';
import { TraceIcon } from '@/ds/icons/TraceIcon';
import { useOpenTrace } from '../hooks/use-open-trace';
import { Txt } from '@/ds/components/Txt';
import { useContext } from 'react';
import { TraceContext } from '../context/trace-context';
import { Check, X } from 'lucide-react';
import { toSigFigs } from '@/lib/number';

const TracesTableEmpty = ({ colsCount }: { colsCount: number }) => {
  return (
    <Tbody>
      <Row>
        <Cell colSpan={colsCount} className="text-center py-4">
          <Txt>No traces found</Txt>
        </Cell>
      </Row>
    </Tbody>
  );
};

const TracesTableError = ({ error, colsCount }: { error: { message: string }; colsCount: number }) => {
  return (
    <Tbody>
      <Row>
        <Cell colSpan={colsCount} className="text-center py-4">
          <Txt>{error.message}</Txt>
        </Cell>
      </Row>
    </Tbody>
  );
};

export interface TracesTableProps {
  traces: RefinedTrace[];
  error: { message: string } | null;
}

const TraceRow = ({ trace, index, isActive }: { trace: RefinedTrace; index: number; isActive: boolean }) => {
  const { openTrace } = useOpenTrace();
  const hasFailure = trace.trace.some(span => span.status.code === 2);

  return (
    <Row className={isActive ? 'bg-surface4' : ''} onClick={() => openTrace(trace.trace, index)}>
      <DateTimeCell dateTime={new Date(trace.started / 1000)} />
      <TxtCell title={trace.traceId}>{trace.traceId.substring(0, 7)}...</TxtCell>
      <UnitCell unit="ms">{toSigFigs(trace.duration / 1000, 3)}</UnitCell>
      <Cell>
        <button onClick={() => openTrace(trace.trace, index)}>
          <Badge icon={<TraceIcon />}>{trace.trace.length}</Badge>
        </button>
      </Cell>
      <Cell>
        {hasFailure ? (
          <Badge variant="error" icon={<X />}>
            Failed
          </Badge>
        ) : (
          <Badge icon={<Check />} variant="success">
            Success
          </Badge>
        )}
      </Cell>
    </Row>
  );
};

export const TracesTable = ({ traces, error }: TracesTableProps) => {
  const hasNoTraces = !traces || traces.length === 0;
  const { currentTraceIndex } = useContext(TraceContext);
  const colsCount = 4;

  return (
    <Table size="small">
      <Thead>
        <Th width={120}>Time</Th>
        <Th width="auto">Trace Id</Th>
        <Th width={120}>Duration</Th>
        <Th width={120}>Spans</Th>
        <Th width={120}>Status</Th>
      </Thead>
      {error ? (
        <TracesTableError error={error} colsCount={colsCount} />
      ) : hasNoTraces ? (
        <TracesTableEmpty colsCount={colsCount} />
      ) : (
        <>
          <Tbody>
            {traces.map((trace, index) => (
              <TraceRow
                key={trace.traceId + index}
                trace={trace}
                index={index}
                isActive={index === currentTraceIndex}
              />
            ))}
          </Tbody>
        </>
      )}
    </Table>
  );
};

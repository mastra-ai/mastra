'use client';
import type { Monitor } from '@mastra/client-js';
import { Badge } from '@mastra/playground-ui/components/Badge';
import { Button } from '@mastra/playground-ui/components/Button';
import { Table, Thead, Th, Tbody, Row, Cell, DateTimeCell, TxtCell } from '@mastra/playground-ui/components/Table';
import { toast } from '@mastra/playground-ui/utils/toast';
import { useMonitorMutations } from '../hooks';

const OP_LABEL: Record<string, string> = { lt: '<', lte: '≤', gt: '>', gte: '≥' };

export interface MonitorsListProps {
  monitors: Monitor[];
  onEdit: (monitor: Monitor) => void;
  onShowEvents: (monitor: Monitor) => void;
}

export function MonitorsList({ monitors, onEdit, onShowEvents }: MonitorsListProps) {
  const { updateMonitor, deleteMonitor } = useMonitorMutations();

  const handleToggleStatus = async (monitor: Monitor) => {
    const status = monitor.status === 'active' ? 'paused' : 'active';
    try {
      await updateMonitor.mutateAsync({ monitorId: monitor.id, params: { status } });
      toast.success(status === 'paused' ? 'Monitor paused' : 'Monitor resumed');
    } catch (error) {
      toast.error(`Failed to update monitor: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const handleDelete = async (monitor: Monitor) => {
    try {
      await deleteMonitor.mutateAsync(monitor.id);
      toast.success('Monitor deleted');
    } catch (error) {
      toast.error(`Failed to delete monitor: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  return (
    <Table>
      <Thead>
        <Th>Name</Th>
        <Th>Condition</Th>
        <Th>Window</Th>
        <Th>State</Th>
        <Th>Last evaluated</Th>
        <Th>Actions</Th>
      </Thead>
      <Tbody>
        {monitors.map(monitor => (
          <Row key={monitor.id}>
            <TxtCell>{monitor.name}</TxtCell>
            <TxtCell>
              {monitor.aggregation} {OP_LABEL[monitor.threshold.op] ?? monitor.threshold.op} {monitor.threshold.value}
              {monitor.filter?.scorerIds?.length ? ` · ${monitor.filter.scorerIds.join(', ')}` : ''}
            </TxtCell>
            <TxtCell>{monitor.windowMinutes}m</TxtCell>
            <Cell>
              <div className="flex items-center gap-2">
                <Badge variant={monitor.status === 'active' ? 'success' : 'default'}>{monitor.status}</Badge>
                {monitor.breached && <Badge variant="error">breached</Badge>}
              </div>
            </Cell>
            {monitor.lastEvaluatedAt ? (
              <DateTimeCell dateTime={new Date(monitor.lastEvaluatedAt)} />
            ) : (
              <TxtCell>never</TxtCell>
            )}
            <Cell>
              <div className="flex items-center gap-2">
                <Button onClick={() => onShowEvents(monitor)}>Events</Button>
                <Button onClick={() => onEdit(monitor)}>Edit</Button>
                <Button onClick={() => handleToggleStatus(monitor)}>
                  {monitor.status === 'active' ? 'Pause' : 'Resume'}
                </Button>
                <Button onClick={() => handleDelete(monitor)}>Delete</Button>
              </div>
            </Cell>
          </Row>
        ))}
      </Tbody>
    </Table>
  );
}

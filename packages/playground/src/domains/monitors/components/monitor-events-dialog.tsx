'use client';
import type { Monitor } from '@mastra/client-js';
import { Badge } from '@mastra/playground-ui/components/Badge';
import { Button } from '@mastra/playground-ui/components/Button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogBody } from '@mastra/playground-ui/components/Dialog';
import { EmptyState } from '@mastra/playground-ui/components/EmptyState';
import { Table, Thead, Th, Tbody, Row, Cell, DateTimeCell, TxtCell } from '@mastra/playground-ui/components/Table';
import { Link } from 'react-router';
import { useMonitorEvents } from '../hooks';

export interface MonitorEventsDialogProps {
  monitor?: Monitor;
  onClose: () => void;
}

const EVENT_LABEL: Record<string, string> = {
  breach: 'Breach',
  recovery: 'Recovery',
  delivery_failure: 'Delivery failure',
};

export function MonitorEventsDialog({ monitor, onClose }: MonitorEventsDialogProps) {
  const { data, isLoading } = useMonitorEvents(monitor?.id);
  const events = data?.events ?? [];
  const scorerId = monitor?.filter?.scorerIds?.[0];

  return (
    <Dialog open={Boolean(monitor)} onOpenChange={open => !open && onClose()}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Events — {monitor?.name}</DialogTitle>
        </DialogHeader>
        <DialogBody className="max-h-[70vh] space-y-4 overflow-y-auto">
          {scorerId && (
            <div className="flex justify-end">
              <Button as={Link} to={`/scorers/${scorerId}`}>
                View matching scores
              </Button>
            </div>
          )}
          {!isLoading && events.length === 0 ? (
            <EmptyState
              iconSlot={null}
              titleSlot="No events yet"
              descriptionSlot="Breaches, recoveries, and delivery failures will appear here."
            />
          ) : (
            <Table>
              <Thead>
                <Th>Time</Th>
                <Th>Type</Th>
                <Th>Value</Th>
                <Th>Scores</Th>
                <Th>Detail</Th>
              </Thead>
              <Tbody>
                {events.map(event => (
                  <Row key={event.id ?? `${event.type}-${event.createdAt}`}>
                    <DateTimeCell dateTime={new Date(event.createdAt)} />
                    <Cell>
                      <Badge variant={event.type === 'recovery' ? 'success' : 'error'}>
                        {EVENT_LABEL[event.type] ?? event.type}
                      </Badge>
                    </Cell>
                    <TxtCell>{event.value === null ? 'no data' : event.value.toFixed(4)}</TxtCell>
                    <TxtCell>{event.count}</TxtCell>
                    <TxtCell>
                      {event.type === 'delivery_failure'
                        ? (event.error ?? 'Webhook delivery failed')
                        : `threshold ${event.threshold.op} ${event.threshold.value}`}
                    </TxtCell>
                  </Row>
                ))}
              </Tbody>
            </Table>
          )}
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}

import type { KnowledgeImporterSummary } from '@mastra/client-js';
import { Badge } from '@mastra/playground-ui/components/Badge';
import { RelativeTimestamp } from '@mastra/playground-ui/components/RelativeTimestamp';
import { Table } from '@mastra/playground-ui/components/Table';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { RUN_KIND_LABEL } from '../runs';
import { describeEffectiveSchedule } from '../schedule';
import { ConnectionStatusBadge, RunStatusBadge } from './status-badges';

export interface ImportersTableProps {
  summaries: KnowledgeImporterSummary[];
  selectedId: string | undefined;
  onSelect: (importerId: string) => void;
}

export function ImportersTable({ summaries, selectedId, onSelect }: ImportersTableProps) {
  return (
    <Table variant="inset" aria-label="Importers">
      <Table.Header>
        <Table.Head>Importer</Table.Head>
        <Table.Head>Automatic imports</Table.Head>
        <Table.Head>Connection</Table.Head>
        <Table.Head>Schedule</Table.Head>
        <Table.Head>Last run</Table.Head>
      </Table.Header>
      <Table.Body>
        {summaries.map(summary => {
          const notConnected = summary.connection.status === 'none';
          const lastRunAt = summary.lastRun?.completedAt ?? summary.lastRun?.startedAt;
          return (
            <Table.Row
              key={summary.importerId}
              selected={summary.importerId === selectedId}
              className={notConnected ? 'opacity-60' : undefined}
              data-testid={`importer-row-${summary.importerId}`}
            >
              <Table.Cell>
                <Table.RowButton
                  aria-current={summary.importerId === selectedId ? 'true' : undefined}
                  onClick={() => onSelect(summary.importerId)}
                  className="flex flex-col"
                >
                  <Txt as="span" variant="body-sm">
                    {summary.label}
                  </Txt>
                  {notConnected ? (
                    <Txt as="span" variant="caption" tone="muted">
                      Not connected to this project
                    </Txt>
                  ) : null}
                </Table.RowButton>
              </Table.Cell>
              <Table.Cell>
                <Badge variant={summary.settings.enabled ? 'success' : 'neutral'} emphasis="subtle" size="sm">
                  {summary.settings.enabled ? 'On' : 'Off'}
                </Badge>
              </Table.Cell>
              <Table.Cell>
                <ConnectionStatusBadge status={summary.connection.status} />
              </Table.Cell>
              <Table.Cell tone="muted">
                <Txt as="span" variant="body-sm" tone="muted">
                  {describeEffectiveSchedule(summary.effectiveSchedule)}
                </Txt>
              </Table.Cell>
              <Table.Cell>
                {summary.lastRun ? (
                  <span className="flex items-center gap-2">
                    <RunStatusBadge status={summary.lastRun.status} />
                    <Txt as="span" variant="caption" tone="muted">
                      {RUN_KIND_LABEL[summary.lastRun.kind]}
                    </Txt>
                    {lastRunAt ? (
                      <Txt as="span" variant="caption" tone="muted">
                        <RelativeTimestamp value={lastRunAt} />
                      </Txt>
                    ) : null}
                  </span>
                ) : (
                  <Txt as="span" variant="body-sm" tone="muted">
                    Never run
                  </Txt>
                )}
              </Table.Cell>
            </Table.Row>
          );
        })}
      </Table.Body>
    </Table>
  );
}

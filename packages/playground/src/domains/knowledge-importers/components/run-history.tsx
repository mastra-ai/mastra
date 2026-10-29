import type { KnowledgeImporterRunSummary } from '@mastra/client-js';
import { Notice } from '@mastra/playground-ui/components/Notice';
import { RelativeTimestamp } from '@mastra/playground-ui/components/RelativeTimestamp';
import { SkeletonText } from '@mastra/playground-ui/components/Skeleton';
import { Table } from '@mastra/playground-ui/components/Table';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { RUN_KIND_LABEL, describeCounts, describeDuration } from '../runs';
import { readApiError } from '../settings';
import { useImporterRuns } from '../use-knowledge-importers';
import { RunStatusBadge } from './status-badges';

const SKELETON_ROWS = [0, 1, 2];

export function RunHistory({ importerId }: { importerId: string }) {
  const { data: runs, isLoading, error } = useImporterRuns(importerId);

  if (error) {
    return (
      <Notice variant="destructive" title="Couldn't load run history">
        <Notice.Message>{readApiError(error).message}</Notice.Message>
      </Notice>
    );
  }

  return (
    <Table variant="inset" size="small">
      <Table.Header>
        <Table.Head>Kind</Table.Head>
        <Table.Head>Status</Table.Head>
        <Table.Head>Started</Table.Head>
        <Table.Head>Duration</Table.Head>
        <Table.Head>Result</Table.Head>
      </Table.Header>
      <Table.Body aria-label="Run history">
        {isLoading
          ? SKELETON_ROWS.map(row => (
              <Table.Row key={row}>
                <Table.Cell colSpan={5}>
                  <SkeletonText />
                </Table.Cell>
              </Table.Row>
            ))
          : null}
        {runs?.length === 0 ? (
          <Table.Row>
            <Table.Cell colSpan={5}>
              <Txt variant="body-sm" tone="muted">
                No runs yet.
              </Txt>
            </Table.Cell>
          </Table.Row>
        ) : null}
        {runs?.map(run => (
          <Table.Row key={run.id}>
            <Table.Cell>{RUN_KIND_LABEL[run.kind]}</Table.Cell>
            <Table.Cell>
              <RunStatusBadge status={run.status} />
            </Table.Cell>
            <Table.Cell tone="muted">{run.startedAt ? <RelativeTimestamp value={run.startedAt} /> : '—'}</Table.Cell>
            <Table.Cell tone="muted">{describeDuration(run)}</Table.Cell>
            <Table.Cell tone="muted">{run.error ?? describeCounts(run.counts)}</Table.Cell>
          </Table.Row>
        ))}
      </Table.Body>
    </Table>
  );
}

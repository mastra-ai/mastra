import { Notice } from '@mastra/playground-ui/components/Notice';
import { Spinner } from '@mastra/playground-ui/components/Spinner';
import { Table } from '@mastra/playground-ui/components/Table';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { RUN_KIND_LABEL, describeCounts } from '../runs';
import { readApiError } from '../settings';
import { isRunActive, useImporterRun } from '../use-knowledge-importers';
import { RunStatusBadge } from './status-badges';

export function RunResult({ importerId, runId }: { importerId: string; runId: string }) {
  const { data: run, error } = useImporterRun(importerId, runId);

  if (error) {
    return (
      <Notice variant="destructive" title="Couldn't read the run">
        <Notice.Message>{readApiError(error).message}</Notice.Message>
      </Notice>
    );
  }

  if (!run || isRunActive(run)) {
    return (
      <div className="flex items-center gap-2" role="status" data-testid="run-result">
        <Spinner size="sm" />
        <Txt variant="body-sm" tone="muted">
          {run ? `${RUN_KIND_LABEL[run.kind]} ${run.status}…` : 'Starting…'}
        </Txt>
      </div>
    );
  }

  return (
    <section className="flex flex-col gap-3" aria-label={`${RUN_KIND_LABEL[run.kind]} result`} data-testid="run-result">
      <div className="flex items-center gap-2">
        <RunStatusBadge status={run.status} />
        <Txt variant="body-sm">
          {run.kind === 'dry-run' ? 'Dry run — nothing was written. ' : null}
          {describeCounts(run.counts)}
        </Txt>
      </div>
      {run.status === 'failed' ? (
        <Notice variant="destructive" title={`${RUN_KIND_LABEL[run.kind]} failed`}>
          <Notice.Message>{run.error ?? 'The run failed without an error message.'}</Notice.Message>
        </Notice>
      ) : null}
      {run.skipped && run.skipped.length > 0 ? (
        <Table variant="inset" size="small">
          <Table.Header>
            <Table.Head>Skipped because</Table.Head>
            <Table.Head align="right">Items</Table.Head>
          </Table.Header>
          <Table.Body aria-label="Skipped items">
            {run.skipped.map(entry => (
              <Table.Row key={entry.reason}>
                <Table.Cell>
                  <Txt as="span" variant="body-sm" font="mono">
                    {entry.reason}
                  </Txt>
                </Table.Cell>
                <Table.Cell align="right">{entry.count}</Table.Cell>
              </Table.Row>
            ))}
          </Table.Body>
        </Table>
      ) : null}
    </section>
  );
}

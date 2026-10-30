import type { KnowledgeImporterRunPreview, KnowledgeImporterRunSummary } from '@mastra/client-js';
import { Notice } from '@mastra/playground-ui/components/Notice';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { RUN_KIND_LABEL, describeOutcome, describePages, describeSkipReason, plural } from '../runs';
import { PlacementBadge } from './placement-badge';

/** A settled run: what it brought in (or would), where each part lands, and what it left out. */
export function RunReport({ run }: { run: KnowledgeImporterRunSummary }) {
  if (run.status === 'failed') {
    return (
      <div data-testid="run-report">
        <Notice variant="destructive" title={`${RUN_KIND_LABEL[run.kind]} failed`}>
          <Notice.Message>{run.error ?? 'The run failed without an error message.'}</Notice.Message>
        </Notice>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4" data-testid="run-report">
      <div className="flex flex-col gap-0.5">
        <Txt variant="body">{describeOutcome(run)}</Txt>
        {run.kind === 'dry-run' ? (
          <Txt variant="caption" tone="muted">
            Preview only — nothing was written to Knowledge.
          </Txt>
        ) : null}
      </div>
      {run.preview ? <Destinations preview={run.preview} /> : null}
      <SkippedItems skipped={run.skipped ?? []} />
    </div>
  );
}

function Destinations({ preview }: { preview: KnowledgeImporterRunPreview }) {
  return (
    <div className="flex flex-col gap-2">
      <Txt as="h4" variant="eyebrow" tone="muted">
        Where it lands
      </Txt>
      <ul className="grid gap-2 md:grid-cols-2" aria-label="Destinations">
        {preview.destinations.map(destination => (
          <li key={destination.scope} className="flex min-w-0 flex-col gap-2 rounded-xl border border-border p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Txt as="span" variant="label" className="truncate">
                {destination.label}
              </Txt>
              <PlacementBadge destination={destination} />
            </div>
            <Txt variant="caption" tone="muted">
              {describePages(destination.nodes)} · {plural(destination.records, 'record')}
            </Txt>
            {destination.sampleTitles.length > 0 ? (
              <ul className="flex flex-col gap-0.5" aria-label={`Sample pages in ${destination.label}`}>
                {destination.sampleTitles.map(title => (
                  <li key={title}>
                    <Txt variant="body-sm" className="truncate">
                      {title}
                    </Txt>
                  </li>
                ))}
              </ul>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}

function SkippedItems({ skipped }: { skipped: NonNullable<KnowledgeImporterRunSummary['skipped']> }) {
  if (skipped.length === 0) return null;
  return (
    <div className="flex flex-col gap-1.5">
      <Txt as="h4" variant="eyebrow" tone="muted">
        Left out
      </Txt>
      <ul className="flex flex-col gap-1" aria-label="Skipped items">
        {skipped.map(entry => (
          <li key={entry.reason} className="flex items-baseline justify-between gap-3">
            <Txt as="span" variant="body-sm">
              {describeSkipReason(entry)}
            </Txt>
            <Txt as="span" variant="caption" tone="muted" className="tabular-nums">
              {plural(entry.count, 'item')}
            </Txt>
          </li>
        ))}
      </ul>
    </div>
  );
}

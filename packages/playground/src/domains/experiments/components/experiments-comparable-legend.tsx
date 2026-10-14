import { Txt } from '@mastra/playground-ui/components/Txt';

export interface ExperimentsComparableLegendProps {
  /** Dataset of the first selected experiment, whose experiments the list highlights. Omitted before any selection. */
  datasetId?: string;
}

/** Explains the highlighted rows of the experiments list: the ones that can be compared with the current selection. */
export function ExperimentsComparableLegend({ datasetId }: ExperimentsComparableLegendProps) {
  return (
    <div role="note" aria-label="Comparable experiments" className="flex min-w-0 items-start gap-2">
      <span aria-hidden="true" className="mt-1 size-3 shrink-0 rounded-sm border border-info-edge bg-info-subtle/50" />
      <Txt as="p" variant="body-sm" tone="muted" className="min-w-0">
        {datasetId ? (
          <>
            Highlighted experiments ran on dataset{' '}
            <Txt as="span" variant="body-sm" font="mono" tone="ink">
              {datasetId}
            </Txt>
            , like your first selection, and can be compared with it.
          </>
        ) : (
          'Select an experiment to highlight the ones you can compare it with.'
        )}
      </Txt>
    </div>
  );
}

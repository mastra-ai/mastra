import { Txt } from '@mastra/playground-ui/components/Txt';

export interface ExperimentsComparableLegendProps {
  /** Dataset of the first selected experiment, whose experiments the list highlights. Omitted before any selection. */
  datasetId?: string;
}

/** Explains the highlighted rows of the experiments list: the ones that can be compared with the current selection. */
export function ExperimentsComparableLegend({ datasetId }: ExperimentsComparableLegendProps) {
  return (
    <Txt as="p" variant="body-sm" tone="muted" role="note" aria-label="Comparable experiments" className="min-w-0">
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
  );
}

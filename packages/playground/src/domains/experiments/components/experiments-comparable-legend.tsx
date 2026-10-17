import { Txt } from '@mastra/playground-ui/components/Txt';

export interface ExperimentsComparableLegendProps {
  /** Dataset of the first selected experiment, whose experiments the list highlights. Omitted before any selection. */
  datasetId?: string;
  /** Name of that dataset, shown instead of its id once resolved. */
  datasetName?: string;
}

/** Explains the highlighted rows of the experiments list: the ones that can be compared with the current selection. */
export function ExperimentsComparableLegend({ datasetId, datasetName }: ExperimentsComparableLegendProps) {
  return (
    <Txt
      as="p"
      variant="body-sm"
      tone="muted"
      role="note"
      aria-label="Comparable experiments"
      className="min-w-0 truncate"
    >
      {datasetId ? (
        <>
          Comparable experiments share dataset{' '}
          <Txt as="span" variant="body-sm" font={datasetName ? undefined : 'mono'} tone="ink" title={datasetId}>
            {datasetName ?? datasetId}
          </Txt>
        </>
      ) : (
        'Select an experiment to highlight comparable ones'
      )}
    </Txt>
  );
}

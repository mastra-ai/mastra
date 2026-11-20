import { Txt } from '@mastra/playground-ui/components/Txt';

export interface ExperimentsComparableLegendProps {
  /** Dataset of the first selected experiment. Omitted before any selection. */
  dataset?: { id: string; name: string };
}

/** Names the dataset the current selection locks the experiments list to. */
export function ExperimentsComparableLegend({ dataset }: ExperimentsComparableLegendProps) {
  return (
    <Txt
      as="p"
      variant="body-sm"
      tone="muted"
      role="note"
      aria-label="Comparable experiments"
      className="min-w-0 truncate"
    >
      {dataset ? (
        <>
          Comparable experiments share dataset{' '}
          <Txt as="span" variant="body-sm" tone="ink" title={dataset.id}>
            {dataset.name}
          </Txt>
        </>
      ) : (
        'Select an experiment to pick the dataset to compare'
      )}
    </Txt>
  );
}

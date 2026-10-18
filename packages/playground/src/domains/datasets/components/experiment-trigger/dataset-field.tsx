import {
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
  ComboboxRoot,
} from '@mastra/playground-ui/components/Combobox';
import { Field, FieldLabel } from '@mastra/playground-ui/components/Field';
import { useDatasetItems } from '@mastra/react/hooks/datasets';
import { sameValue } from './experiment-trigger-options';
import type { DatasetOption, FieldPopupContainer } from './experiment-trigger-options';

/** "5 items · latest", or the pinned version when one is picked under Advanced. */
function datasetDetail(itemCount: number | undefined, version: number | undefined) {
  if (itemCount === undefined) return undefined;
  const items = `${itemCount} ${itemCount === 1 ? 'item' : 'items'}`;
  return `${items} · ${version === undefined ? 'latest' : `v${version}`}`;
}

export interface DatasetFieldProps {
  datasets: DatasetOption[];
  datasetId: string;
  version?: number;
  onDatasetChange: (datasetId: string) => void;
  container: FieldPopupContainer;
}

export function DatasetField({ datasets, datasetId, version, onDatasetChange, container }: DatasetFieldProps) {
  const { total: itemCount } = useDatasetItems({
    datasetId,
    search: undefined,
    version,
    queryOptions: { enabled: Boolean(datasetId) },
  });
  // Base UI's combobox takes `null` for no selection.
  const dataset = datasets.find(option => option.value === datasetId) ?? null;

  return (
    <Field>
      <FieldLabel
        required
        info="The items to run. Each item's input goes to the target. Runs on the latest version unless you pick one under Advanced."
      >
        Dataset
      </FieldLabel>
      <ComboboxRoot
        items={datasets}
        value={dataset}
        onValueChange={(next: DatasetOption | null) => next && onDatasetChange(next.value)}
        isItemEqualToValue={sameValue}
        autoHighlight
      >
        <ComboboxInput placeholder="Select a dataset">{datasetDetail(itemCount, version)}</ComboboxInput>
        <ComboboxContent container={container}>
          <ComboboxEmpty>No datasets found</ComboboxEmpty>
          <ComboboxList>
            {(item: DatasetOption) => (
              <ComboboxItem key={item.value} value={item}>
                {item.label}
              </ComboboxItem>
            )}
          </ComboboxList>
        </ComboboxContent>
      </ComboboxRoot>
    </Field>
  );
}

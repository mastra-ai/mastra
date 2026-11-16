import {
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
  ComboboxRoot,
} from '@mastra/playground-ui/components/Combobox';
import { Field, FieldLabel } from '@mastra/playground-ui/components/Field';
import { Metadata } from '@mastra/playground-ui/components/Metadata';
import { useDatasetItems } from '@mastra/react/hooks/datasets';
import { sameValue } from './experiment-trigger-options';
import type { DatasetOption, FieldPopupContainer } from './experiment-trigger-options';

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
        <ComboboxInput placeholder="Select a dataset">
          {itemCount !== undefined && (
            <Metadata>
              <Metadata.Item>
                {itemCount} {itemCount === 1 ? 'item' : 'items'}
              </Metadata.Item>
              <Metadata.Item>{version === undefined ? 'latest' : `v${version}`}</Metadata.Item>
            </Metadata>
          )}
        </ComboboxInput>
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

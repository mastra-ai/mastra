import type { DatasetRecord } from '@mastra/client-js';
import { Plus } from 'lucide-react';
import { Field, FieldLabel } from '../../../../ds/components/Field';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from '../../../../ds/components/Select';
import { Txt } from '../../../../ds/components/Txt';
import { Icon } from '../../../../ds/icons';

const CREATE_DATASET_VALUE = '__create-dataset__';

export interface DatasetPickerProps {
  datasets: DatasetRecord[];
  value: string;
  onValueChange: (datasetId: string) => void;
  loading: boolean;
  disabled: boolean;
  /** When set, "Create dataset" is offered first and calls this instead of selecting. */
  onCreateDataset?: () => void;
}

export function DatasetPicker({
  datasets,
  value,
  onValueChange,
  loading,
  disabled,
  onCreateDataset,
}: DatasetPickerProps) {
  // A just-created dataset is picked before the refetch lists it.
  const isListed = datasets.some(dataset => dataset.id === value);

  return (
    <Field>
      <FieldLabel required>Dataset</FieldLabel>
      <Select
        // Base UI resets an unmatched non-null value to null when items change, which would wipe a
        // just-created dataset before the refetch lists it; null means "no selection" and is left alone.
        value={isListed ? value : null}
        onValueChange={next => {
          if (next === CREATE_DATASET_VALUE) onCreateDataset?.();
          else if (next) onValueChange(next);
        }}
        disabled={disabled || loading}
      >
        <SelectTrigger aria-label="Dataset" className="sm:max-w-sm">
          <SelectValue placeholder={loading ? 'Loading datasets…' : 'Select a dataset'} />
        </SelectTrigger>
        <SelectContent>
          {onCreateDataset && (
            <>
              <SelectItem value={CREATE_DATASET_VALUE}>
                <span className="flex items-center gap-2">
                  <Icon size="sm">
                    <Plus aria-hidden />
                  </Icon>
                  Create dataset
                </span>
              </SelectItem>
              {datasets.length > 0 && <SelectSeparator />}
            </>
          )}
          {datasets.length === 0 && !onCreateDataset ? (
            <Txt as="p" variant="body" tone="muted" className="px-2 py-4 text-center">
              No datasets available
            </Txt>
          ) : (
            datasets.map(dataset => (
              <SelectItem key={dataset.id} value={dataset.id}>
                {dataset.name}
              </SelectItem>
            ))
          )}
        </SelectContent>
      </Select>
    </Field>
  );
}

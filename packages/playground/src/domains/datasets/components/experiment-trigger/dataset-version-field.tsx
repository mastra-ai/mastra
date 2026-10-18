import { Field, FieldLabel } from '@mastra/playground-ui/components/Field';
import { useDataset } from '@mastra/react/hooks/datasets';
import { DatasetVersions } from '../dataset-versions';
import type { FieldPopupContainer } from './experiment-trigger-options';

/** Versions are numbered from 1, so a current version above 1 means there are older ones to pick. */
function hasVersionsToPick(currentVersion: number | undefined, pinnedVersion: number | undefined) {
  if (pinnedVersion !== undefined) return true;
  return (currentVersion ?? 1) > 1;
}

export interface DatasetVersionFieldProps {
  datasetId: string;
  version?: number;
  onVersionChange: (version: number | undefined) => void;
  container: FieldPopupContainer;
}

/** Pins the dataset version to run on. Only offered once the dataset has older versions. */
export function DatasetVersionField({ datasetId, version, onVersionChange, container }: DatasetVersionFieldProps) {
  const { data: dataset } = useDataset({ datasetId, queryOptions: { enabled: Boolean(datasetId) } });
  if (!hasVersionsToPick(dataset?.version, version)) return null;

  return (
    <Field>
      <FieldLabel>Dataset version</FieldLabel>
      {/* DatasetVersions takes `null` for "latest". */}
      <DatasetVersions
        datasetId={datasetId}
        value={version ?? null}
        onValueChange={next => onVersionChange(next ?? undefined)}
        container={container}
      />
    </Field>
  );
}

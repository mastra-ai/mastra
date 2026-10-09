import { DataListSkeleton } from '@mastra/playground-ui/components/DataList';
import { DATASETS_LIST_COLUMNS } from './helpers';

export function DatasetsListSkeleton() {
  return <DataListSkeleton columns={DATASETS_LIST_COLUMNS} />;
}

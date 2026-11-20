import { DATASETS_LIST_COLUMNS } from './helpers';
import { DataListSkeleton } from '@/ds/components/DataList';

export function DatasetsListSkeleton() {
  return <DataListSkeleton columns={DATASETS_LIST_COLUMNS} />;
}

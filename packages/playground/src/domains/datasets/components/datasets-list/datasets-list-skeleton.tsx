import type { DataListScroll } from '@mastra/playground-ui/components/DataList';
import { DataListSkeleton } from '@mastra/playground-ui/components/DataList';
import { DATASETS_LIST_COLUMNS } from './helpers';

export function DatasetsListSkeleton({ scroll }: { scroll?: DataListScroll }) {
  return <DataListSkeleton scroll={scroll} columns={DATASETS_LIST_COLUMNS} />;
}

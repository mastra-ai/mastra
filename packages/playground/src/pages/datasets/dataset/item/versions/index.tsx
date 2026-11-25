import { DatasetItemVersionsPage } from '@mastra/playground-ui/domains/datasets';
import { useParams, useSearchParams } from 'react-router';

function DatasetItemVersionsComparePage() {
  const { datasetId, itemId } = useParams() as { datasetId: string; itemId: string };
  const [searchParams, setSearchParams] = useSearchParams();
  return (
    <DatasetItemVersionsPage
      datasetId={datasetId}
      itemId={itemId}
      datasetsHref="/datasets"
      searchParams={searchParams}
      setSearchParams={setSearchParams}
    />
  );
}

export { DatasetItemVersionsComparePage };
export default DatasetItemVersionsComparePage;

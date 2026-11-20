import { DatasetVersionsPage } from '@mastra/playground-ui/domains/datasets';
import { useParams, useSearchParams } from 'react-router';

function DatasetCompareVersionsPage() {
  const { datasetId } = useParams() as { datasetId: string };
  const [searchParams, setSearchParams] = useSearchParams();
  return (
    <DatasetVersionsPage
      datasetId={datasetId}
      datasetsHref="/datasets"
      searchParams={searchParams}
      setSearchParams={setSearchParams}
    />
  );
}

export { DatasetCompareVersionsPage };
export default DatasetCompareVersionsPage;

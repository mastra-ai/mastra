import { EditDatasetPage as SharedEditDatasetPage } from '@mastra/playground-ui/domains/datasets';
import { useNavigate, useParams } from 'react-router';

function EditDatasetPage() {
  const { datasetId } = useParams() as { datasetId: string };
  const navigate = useNavigate();
  return (
    <SharedEditDatasetPage
      datasetId={datasetId}
      datasetsHref="/datasets"
      onDone={() => void navigate(`/datasets/${datasetId}`)}
    />
  );
}

export { EditDatasetPage };
export default EditDatasetPage;

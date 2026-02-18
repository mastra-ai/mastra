import { useParams, useSearchParams, Link } from 'react-router';
import { Database, ScaleIcon, ArrowLeft } from 'lucide-react';
import {
  Header,
  MainContentLayout,
  MainContentContent,
  Icon,
  Button,
  HeaderAction,
  Breadcrumb,
  Crumb,
  MainHeader,
  TextAndIcon,
  useDataset,
  useDatasetItem,
  DatasetItemHeader,
  DatasetItemContent,
  useLinkComponent,
  Columns,
  Column,
} from '@mastra/playground-ui';

function DatasetCompareItems() {
  const { datasetId } = useParams<{ datasetId: string }>();
  const [searchParams] = useSearchParams();
  const itemIds = searchParams.get('items')?.split(',').filter(Boolean) ?? [];
  const { data: dataset } = useDataset(datasetId ?? '');
  const { Link: FrameworkLink } = useLinkComponent();

  if (!datasetId || itemIds.length < 2) {
    return (
      <MainContentLayout>
        <Header>
          <Breadcrumb>
            <Crumb as={Link} to="/datasets">
              <Icon>
                <Database />
              </Icon>
              Datasets
            </Crumb>
            <Crumb isCurrent>
              <Icon>
                <ScaleIcon />
              </Icon>
              Compare Items
            </Crumb>
          </Breadcrumb>
        </Header>
        <MainContentContent>
          <div className="text-neutral4 text-center py-8">
            <p>Select at least two items to compare.</p>
          </div>
        </MainContentContent>
      </MainContentLayout>
    );
  }

  return (
    <MainContentLayout>
      <Header>
        <Breadcrumb>
          <Crumb as={Link} to="/datasets">
            <Icon>
              <Database />
            </Icon>
            Datasets
          </Crumb>
          <Crumb as={Link} to={`/datasets/${datasetId}`}>
            {dataset?.name || datasetId?.slice(0, 8)}
          </Crumb>
          <Crumb isCurrent>
            <Icon>
              <ScaleIcon />
            </Icon>
            Compare Items
          </Crumb>
        </Breadcrumb>
        <HeaderAction>
          <Button as={Link} to={`/datasets/${datasetId}`} variant="outline">
            <Icon>
              <ArrowLeft />
            </Icon>
            Back to Dataset
          </Button>
        </HeaderAction>
      </Header>

      <div className="h-full overflow-hidden px-[3vw] pb-4">
        <div className="grid gap-6 max-w-[140rem] mx-auto grid-rows-[auto_1fr] h-full">
          <MainHeader>
            <MainHeader.Column>
              <MainHeader.Title>
                <ScaleIcon />
                Compare Items
              </MainHeader.Title>
              <MainHeader.Description>
                <TextAndIcon>Comparing {itemIds.length} items</TextAndIcon>
              </MainHeader.Description>
            </MainHeader.Column>
          </MainHeader>

          <Columns className="grid-cols-2">
            {itemIds.map((itemId, idx) => (
              <CompareItemColumn key={itemId} datasetId={datasetId} itemId={itemId} Link={FrameworkLink} idx={idx} />
            ))}
          </Columns>
        </div>
      </div>
    </MainContentLayout>
  );
}

function CompareItemColumn({
  datasetId,
  itemId,
  Link,
  idx,
}: {
  datasetId: string;
  itemId: string;
  Link: ReturnType<typeof useLinkComponent>['Link'];
  idx: number;
}) {
  const { data: item, isLoading } = useDatasetItem(datasetId, itemId);

  if (isLoading) {
    return <div className="text-neutral4 text-sm">Loading...</div>;
  }

  if (!item) {
    return <div className="text-neutral4 text-sm">Item {itemId.slice(0, 8)} not found</div>;
  }

  return (
    <Column withLeftSeparator={idx > 0}>
      <DatasetItemHeader item={item} />
      <DatasetItemContent item={item} Link={Link} />
    </Column>
  );
}

export { DatasetCompareItems };
export default DatasetCompareItems;

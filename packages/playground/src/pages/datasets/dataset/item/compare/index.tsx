import { Fragment, useState } from 'react';
import { useParams, useSearchParams, Link } from 'react-router';
import { Database, ArrowLeft, GitCompareIcon, History, ArrowLeftIcon, DiffIcon, ColumnsIcon } from 'lucide-react';
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
  useDatasetItems,
  SelectField,
  DatasetItemHeader,
  DatasetItemContent,
  CodeDiff,
  useLinkComponent,
  Columns,
  Column,
  ButtonsGroup,
} from '@mastra/playground-ui';
import type { DatasetItem } from '@mastra/client-js';
import { cn } from '@/lib/utils';

function itemToText(item: DatasetItem): string {
  return JSON.stringify(
    {
      input: item.input ?? null,
      groundTruth: item.groundTruth ?? null,
      metadata: item.metadata ?? null,
    },
    null,
    2,
  );
}

function DatasetItemsComparePage() {
  const { datasetId } = useParams<{ datasetId: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const itemIds = searchParams.get('items')?.split(',').filter(Boolean) ?? [];
  const { data: dataset } = useDataset(datasetId ?? '');
  const { Link: FrameworkLink } = useLinkComponent();
  const [isDiffView, setIsDiffView] = useState<boolean>(false);

  const { data: itemA } = useDatasetItem(datasetId ?? '', itemIds[0] ?? '');
  const { data: itemB } = useDatasetItem(datasetId ?? '', itemIds[1] ?? '');

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
            <Crumb isCurrent as="span">
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
          <Crumb isCurrent as="span">
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
        <div
          className={cn('grid gap-6 max-w-[140rem] mx-auto grid-rows-[auto_1fr] h-full', {
            'grid-rows-[auto_auto_1fr]': isDiffView,
          })}
        >
          <MainHeader>
            <MainHeader.Column>
              <MainHeader.Title>
                <GitCompareIcon />
                Compare Dataset Items
              </MainHeader.Title>
              <MainHeader.Description>
                <TextAndIcon>
                  Comparing {itemIds.length} items of{' '}
                  <Link to={`/datasets/${datasetId}`} className="text-info1 hover:underline">
                    {dataset?.name || datasetId?.slice(0, 8)}
                  </Link>
                </TextAndIcon>
              </MainHeader.Description>
            </MainHeader.Column>
            <MainHeader.Column>
              <ButtonsGroup>
                <Button as={Link} to={`/datasets/${datasetId}`} variant="standard" size="default">
                  <ArrowLeftIcon />
                  Back to Dataset
                </Button>
                <Button variant="cta" size="default" onClick={() => setIsDiffView(v => !v)}>
                  {isDiffView ? (
                    <>
                      <ColumnsIcon /> Default View
                    </>
                  ) : (
                    <>
                      <DiffIcon /> Diff View
                    </>
                  )}
                </Button>
              </ButtonsGroup>
            </MainHeader.Column>
          </MainHeader>

          <Columns className="grid-cols-[1fr_3vw_1fr]">
            {itemIds.map((itemId, idx) => (
              <Fragment key={itemId}>
                <CompareItemColumn
                  datasetId={datasetId}
                  itemId={itemId}
                  Link={FrameworkLink}
                  idx={idx}
                  itemIds={itemIds}
                  showContent={!isDiffView}
                  onItemChange={(newItemId: string) => {
                    const newIds = [...itemIds];
                    newIds[idx] = newItemId;
                    setSearchParams({ items: newIds.join(',') });
                  }}
                />
                {idx == 0 && <div className={cn('bg-surface5 w-[3px] shrink-0 mx-[1.5vw]')}></div>}
              </Fragment>
            ))}
          </Columns>
          {isDiffView && itemA && itemB && <CodeDiff codeA={itemToText(itemA)} codeB={itemToText(itemB)} />}
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
  itemIds,
  onItemChange,
  showContent = true,
}: {
  datasetId: string;
  itemId: string;
  Link: ReturnType<typeof useLinkComponent>['Link'];
  idx: number;
  itemIds: string[];
  showContent?: boolean;
  onItemChange: (newItemId: string) => void;
}) {
  const { data: item, isLoading } = useDatasetItem(datasetId, itemId);
  const { data: allItems } = useDatasetItems(datasetId);

  const otherItemIds = new Set(itemIds.filter((_, i) => i !== idx));
  const options = (allItems ?? []).map((i: { id: string }) => ({
    value: i.id,
    label: i.id,
    disabled: otherItemIds.has(i.id),
  }));

  return (
    <Column>
      <Column.Toolbar className="flex gap-4">
        <SelectField
          label="Item"
          name={`compare-item-${idx}`}
          value={itemId}
          onValueChange={onItemChange}
          options={options}
          placeholder="Select item"
          variant="experimental"
          size="default"
          labelIsHidden={true}
        />
        <Button as={Link} to={`/datasets/${datasetId}/items/${itemId}`} variant="standard" size="default">
          <History />
          Versions
        </Button>
      </Column.Toolbar>

      {showContent && (
        <Column.Content>
          {isLoading ? (
            <div className="text-neutral4 text-sm">Loading...</div>
          ) : !item ? (
            <div className="text-neutral4 text-sm">Item {itemId.slice(0, 8)} not found</div>
          ) : (
            <>
              <DatasetItemHeader item={item} />
              <DatasetItemContent item={item} Link={Link} />
            </>
          )}
        </Column.Content>
      )}
    </Column>
  );
}

export { DatasetItemsComparePage };
export default DatasetItemsComparePage;

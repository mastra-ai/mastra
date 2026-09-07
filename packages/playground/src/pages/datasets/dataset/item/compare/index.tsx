import type { DatasetItem } from '@mastra/client-js';
import { Button } from '@mastra/playground-ui/components/Button';
import { ButtonsGroup } from '@mastra/playground-ui/components/ButtonsGroup';
import { Card, CardContent, CardHeader } from '@mastra/playground-ui/components/Card';
import { CodeDiff } from '@mastra/playground-ui/components/CodeDiff';
import { Columns } from '@mastra/playground-ui/components/Columns';
import { MainContentContent, MainContentLayout } from '@mastra/playground-ui/components/MainContent';
import { MainHeader } from '@mastra/playground-ui/components/MainHeader';
import { PageLayout } from '@mastra/playground-ui/components/PageLayout';
import { PermissionDenied } from '@mastra/playground-ui/components/PermissionDenied';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@mastra/playground-ui/components/Select';
import { SessionExpired } from '@mastra/playground-ui/components/SessionExpired';
import { TextAndIcon } from '@mastra/playground-ui/components/Text';
import { is401UnauthorizedError, is403ForbiddenError } from '@mastra/playground-ui/utils/errors';
import { ArrowLeft, GitCompareIcon, History, DiffIcon, ColumnsIcon } from 'lucide-react';
import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router';
import { DatasetItemHeader, DatasetItemDetails } from '@/domains/datasets';
import { useDatasetItem, useDatasetItems } from '@/domains/datasets/hooks/use-dataset-items';
import { useDataset } from '@/domains/datasets/hooks/use-datasets';
import { useLinkComponent } from '@/lib/framework';
import { RouteHeaderActions } from '@/lib/route-header';
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
  const { datasetId, itemId, secondItemId } = useParams<{
    datasetId: string;
    itemId: string;
    secondItemId: string;
  }>();
  const navigate = useNavigate();
  const itemIds = [itemId, secondItemId].filter((id): id is string => Boolean(id));
  const { data: dataset, error } = useDataset(datasetId ?? '');
  const { Link: FrameworkLink, paths } = useLinkComponent();
  const [isDiffView, setIsDiffView] = useState<boolean>(false);

  const { data: itemA } = useDatasetItem(datasetId ?? '', itemIds[0] ?? '');
  const { data: itemB } = useDatasetItem(datasetId ?? '', itemIds[1] ?? '');

  if (error && is401UnauthorizedError(error)) {
    return (
      <MainContentLayout>
        <div className="flex h-full items-center justify-center">
          <SessionExpired />
        </div>
      </MainContentLayout>
    );
  }

  if (error && is403ForbiddenError(error)) {
    return (
      <MainContentLayout>
        <div className="flex h-full items-center justify-center">
          <PermissionDenied resource="datasets" />
        </div>
      </MainContentLayout>
    );
  }

  if (!datasetId || itemIds.length < 2) {
    return (
      <MainContentLayout>
        <MainContentContent>
          <div className="text-neutral4 py-8 text-center">
            <p>Select at least two items to compare.</p>
          </div>
        </MainContentContent>
      </MainContentLayout>
    );
  }

  return (
    <MainContentLayout>
      <RouteHeaderActions owner="dataset-items-compare">
        <Button as={Link} to={`/datasets/${datasetId}`} variant="outline">
          <ArrowLeft />
          Back to Dataset
        </Button>
      </RouteHeaderActions>

      <PageLayout height="full" className={cn({ 'grid-rows-[auto_auto_minmax(0,1fr)]': isDiffView })}>
        <PageLayout.TopArea>
          <MainHeader withMargins={false}>
            <MainHeader.Column>
              <MainHeader.Title size="smaller">
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
                <Button variant="primary" onClick={() => setIsDiffView(v => !v)}>
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
        </PageLayout.TopArea>

        <Columns className="grid-cols-2 gap-6">
          {itemIds.map((itemId, idx) => (
            <CompareItemColumn
              key={itemId}
              datasetId={datasetId}
              itemId={itemId}
              Link={FrameworkLink}
              idx={idx}
              itemIds={itemIds}
              showContent={!isDiffView}
              onItemChange={(newItemId: string) => {
                const newIds = [...itemIds];
                newIds[idx] = newItemId;
                void navigate(paths.datasetItemCompareLink(datasetId, newIds[0]!, newIds[1]!));
              }}
            />
          ))}
        </Columns>
        {isDiffView && itemA && itemB && (
          <div className="mt-6 min-h-0 overflow-y-auto">
            <CodeDiff codeA={itemToText(itemA)} codeB={itemToText(itemB)} />
          </div>
        )}
      </PageLayout>
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
    <Card className="grid min-h-0 grid-rows-[auto_1fr] overflow-hidden">
      <CardHeader className="flex items-center gap-4">
        <Select name={`compare-item-${idx}`} value={itemId} onValueChange={onItemChange}>
          <SelectTrigger aria-label="Item" className="w-full">
            <SelectValue placeholder="Select item" />
          </SelectTrigger>
          <SelectContent>
            {options.map(option => (
              <SelectItem key={option.value} value={option.value} disabled={option.disabled}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button as={Link} to={`/datasets/${datasetId}/items/${itemId}`}>
          <History />
          Versions
        </Button>
      </CardHeader>

      {showContent && (
        <CardContent className="grid content-start gap-8 overflow-y-auto">
          {isLoading ? (
            <div className="text-neutral4 text-sm">Loading...</div>
          ) : !item ? (
            <div className="text-neutral4 text-sm">Item {itemId.slice(0, 8)} not found</div>
          ) : (
            <>
              <DatasetItemHeader item={item} />
              <DatasetItemDetails item={item} />
            </>
          )}
        </CardContent>
      )}
    </Card>
  );
}

export { DatasetItemsComparePage };
export default DatasetItemsComparePage;

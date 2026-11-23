import { useDataset, useDatasetItems } from '@mastra/react/hooks/datasets';
import { useMemo } from 'react';
import { DatasetBreadcrumbs } from './dataset-page';
import { DatasetCompareVersionToolbar, DatasetCompareVersionsList } from './versions';
import { PermissionDenied } from '@/domains/auth/components/permission-denied';
import { SessionExpired } from '@/domains/auth/components/session-expired';
import { Crumb } from '@/ds/components/Breadcrumb';
import { Button } from '@/ds/components/Button';
import { Column, Columns } from '@/ds/components/Columns';
import { MainHeader } from '@/ds/components/MainHeader';
import { PageLayout } from '@/ds/components/PageLayout';
import { TextAndIcon } from '@/ds/components/Text';
import { IconArrowLeft } from '@/ds/icons/central/IconArrowLeft';
import { IconHistory } from '@/ds/icons/central/IconHistory';
import { IconLaw } from '@/ds/icons/central/IconLaw';
import { useLinkComponent } from '@/lib/framework';
import type { SetURLSearchParamsLike } from '@/lib/sort/use-url-sort';
import { is401UnauthorizedError, is403ForbiddenError } from '@/utils/errors';

export interface DatasetVersionsPageProps {
  datasetId: string;
  datasetsHref: string;
  searchParams: URLSearchParams;
  setSearchParams: SetURLSearchParamsLike;
}

/** Side-by-side compare of two dataset versions (`?ids=a,b`), shared by Studio and Platform. */
export function DatasetVersionsPage({
  datasetId,
  datasetsHref,
  searchParams,
  setSearchParams,
}: DatasetVersionsPageProps) {
  const { Link, paths } = useLinkComponent();
  const crumbs = (
    <DatasetBreadcrumbs datasetId={datasetId} datasetsHref={datasetsHref}>
      <Crumb as="span" isCurrent>
        Versions
      </Crumb>
    </DatasetBreadcrumbs>
  );
  const versionNumbers =
    searchParams
      .get('ids')
      ?.split(',')
      .map(Number)
      .filter(n => !isNaN(n) && n > 0) ?? [];
  const { data: dataset, error } = useDataset({
    datasetId: datasetId,
    queryOptions: { enabled: Boolean(datasetId) },
  });

  const versionA = useDatasetItems({
    datasetId: datasetId,
    search: undefined,
    version: versionNumbers[0] ?? null,
    queryOptions: { enabled: Boolean(datasetId) },
  });
  const versionB = useDatasetItems({
    datasetId: datasetId,
    search: undefined,
    version: versionNumbers[1] ?? null,
    queryOptions: { enabled: Boolean(datasetId) },
  });

  const itemsA = useMemo(() => versionA.data ?? [], [versionA.data]);
  const itemsB = useMemo(() => versionB.data ?? [], [versionB.data]);

  // Merged items ordered by createdAt (union of both versions, deduplicated)
  const allItems = useMemo(() => {
    const seen = new Map<string, { id: string; createdAt: Date }>();
    for (const item of [...itemsA, ...itemsB]) {
      if (!seen.has(item.id)) {
        seen.set(item.id, { id: item.id, createdAt: new Date(item.createdAt) });
      }
    }
    return [...seen.values()].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }, [itemsA, itemsB]);

  // Lookup maps to resolve each item's version in A and B
  const itemsAMap = useMemo(() => new Map(itemsA.map(i => [i.id, i])), [itemsA]);
  const itemsBMap = useMemo(() => new Map(itemsB.map(i => [i.id, i])), [itemsB]);

  if (error && is401UnauthorizedError(error)) {
    return (
      <PageLayout variant="page" body="fixed" breadcrumbs={crumbs}>
        <h1 className="sr-only">Versions</h1>
        <SessionExpired variant="fill" />
      </PageLayout>
    );
  }

  if (error && is403ForbiddenError(error)) {
    return (
      <PageLayout variant="page" body="fixed" breadcrumbs={crumbs}>
        <h1 className="sr-only">Versions</h1>
        <PermissionDenied variant="fill" resource="datasets" />
      </PageLayout>
    );
  }

  const [versionANumber, versionBNumber] = versionNumbers;
  if (versionANumber === undefined || versionBNumber === undefined) {
    return (
      <PageLayout variant="page" body="fixed" breadcrumbs={crumbs}>
        <h1 className="sr-only">Versions</h1>
        <div className="grid h-full min-w-min content-start items-start overflow-auto">
          <div className="py-5 text-center text-muted-foreground">
            <p>Select at least two versions to compare.</p>
          </div>
        </div>
      </PageLayout>
    );
  }

  const handleVersionChange = (newA: string, newB: string) => {
    setSearchParams(
      prev => {
        const params = new URLSearchParams(prev);
        params.set('ids', `${newA},${newB}`);
        return params;
      },
      { replace: true },
    );
  };

  return (
    <PageLayout variant="page" body="fixed" breadcrumbs={crumbs}>
      <h1 className="sr-only">Versions</h1>
      <div className="h-full overflow-hidden px-[3vw] pb-4">
        <div className="grid h-full grid-rows-[auto_1fr] gap-4">
          <MainHeader>
            <MainHeader.Column>
              <MainHeader.Title>
                <IconLaw /> Compare Dataset Versions
              </MainHeader.Title>
              <MainHeader.Description>
                <TextAndIcon>
                  <IconHistory /> Comparing {versionNumbers.length} versions of {dataset?.name || datasetId.slice(0, 8)}
                </TextAndIcon>
              </MainHeader.Description>
            </MainHeader.Column>
            <MainHeader.Column>
              <Button render={<Link href={paths.datasetLink(datasetId)} />} icon={<IconArrowLeft />}>
                Back to dataset
              </Button>
            </MainHeader.Column>
          </MainHeader>

          <Columns>
            <Column>
              <DatasetCompareVersionToolbar
                datasetId={datasetId}
                versionA={String(versionANumber)}
                versionB={String(versionBNumber)}
                onVersionChange={handleVersionChange}
              />
              <DatasetCompareVersionsList
                datasetId={datasetId}
                versionA={versionANumber}
                versionB={versionBNumber}
                allItems={allItems}
                itemsAMap={itemsAMap}
                itemsBMap={itemsBMap}
              />
            </Column>
          </Columns>
        </div>
      </div>
    </PageLayout>
  );
}

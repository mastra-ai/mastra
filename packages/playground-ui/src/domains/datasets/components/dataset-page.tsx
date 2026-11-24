import { useDataset, useDatasetItems } from '@mastra/react/hooks/datasets';
import type { ReactNode } from 'react';
import { useState } from 'react';
import { DatasetItemPanelProvider } from '../context/dataset-item-panel-context';
import { useDatasetItemsUrlState } from '../hooks/use-dataset-items-url-state';
import { AddDatasetItemDialog } from './add-dataset-item-dialog';
import { DatasetCombobox } from './dataset-combobox';
import { DatasetItemsView } from './dataset-detail/dataset-items-view';
import { DatasetTagsEditor } from './dataset-detail/dataset-tags-editor';
import { DatasetVersions } from './dataset-versions';
import { DeleteDatasetDialog } from './delete-dataset-dialog';
import { DuplicateDatasetDialog } from './duplicate-dataset-dialog';
import { DatasetSchemaDialog } from './schema-settings/dataset-schema-dialog';
import { PermissionDenied } from '@/domains/auth/components/permission-denied';
import { SessionExpired } from '@/domains/auth/components/session-expired';
import { Breadcrumb, Crumb, CrumbSkeleton, crumbSwitcherTriggerProps } from '@/ds/components/Breadcrumb';
import { Button } from '@/ds/components/Button';
import { DropdownMenu } from '@/ds/components/DropdownMenu';
import { EmptyState } from '@/ds/components/EmptyState';
import { PageLayout } from '@/ds/components/PageLayout';
import { IconArrowLeft } from '@/ds/icons/central/IconArrowLeft';
import { IconCodeBrackets } from '@/ds/icons/central/IconCodeBrackets';
import { IconDotGrid1x3Vertical } from '@/ds/icons/central/IconDotGrid1x3Vertical';
import { IconPencil } from '@/ds/icons/central/IconPencil';
import { IconSquareBehindSquare1 } from '@/ds/icons/central/IconSquareBehindSquare1';
import { DatasetsIcon } from '@/ds/icons/DatasetsIcon';
import { TrashIcon } from '@/ds/icons/TrashIcon';
import { useLinkComponent } from '@/lib/framework';
import type { SetURLSearchParamsLike } from '@/lib/sort/use-url-sort';
import { is401UnauthorizedError, is403ForbiddenError, is404NotFoundError } from '@/utils/errors';

export interface DatasetPageProps {
  datasetId: string;
  /** Item open in the side panel, from the app's `items/:itemId` route. */
  currentItemId?: string;
  searchParams: URLSearchParams;
  setSearchParams: SetURLSearchParamsLike;
  /** Where the "Datasets" crumb and the not-found page link back to. */
  datasetsHref: string;
  onEdit: () => void;
  onDeleted: () => void;
  /** App-specific header actions rendered before Schema (e.g. experiments). */
  headerActionsStart?: ReactNode;
  /** Renders the selected item; defaults to nothing (the app owns its side panel). */
  itemPanel?: ReactNode;
  children?: ReactNode;
}

function DatasetsCrumb({ href, isCurrent }: { href: string; isCurrent?: boolean }) {
  const { Link } = useLinkComponent();
  return (
    <Crumb as={isCurrent ? 'span' : Link} href={isCurrent ? undefined : href} icon={<DatasetsIcon />}>
      Datasets
    </Crumb>
  );
}

export interface DatasetBreadcrumbsProps {
  datasetId: string;
  datasetsHref: string;
  /** Adds the version switcher crumb; needs the page's URL state. */
  version?: { searchParams: URLSearchParams; setSearchParams: SetURLSearchParamsLike };
  /** Crumbs after the dataset crumb, e.g. "Edit dataset". */
  children?: ReactNode;
}

function VersionCrumb({
  datasetId,
  searchParams,
  setSearchParams,
}: {
  datasetId: string;
  searchParams: URLSearchParams;
  setSearchParams: SetURLSearchParamsLike;
}) {
  const { activeVersion, handleVersionChange } = useDatasetItemsUrlState(searchParams, setSearchParams);
  const { data: dataset, isLoading } = useDataset({ datasetId, queryOptions: { enabled: Boolean(datasetId) } });
  const latestVersion = dataset?.version;
  const versionLabel =
    activeVersion == null || activeVersion === latestVersion ? `Latest (v${latestVersion ?? 0})` : `v${activeVersion}`;

  return (
    <Crumb
      as="span"
      isCurrent
      isLoading={isLoading}
      switcher={
        <DatasetVersions
          datasetId={datasetId}
          value={activeVersion}
          onValueChange={handleVersionChange}
          currentVersion={latestVersion}
          datasetCreatedAt={dataset?.createdAt}
          {...crumbSwitcherTriggerProps}
          aria-label="Switch dataset version"
        />
      }
    >
      {versionLabel}
    </Crumb>
  );
}

/** "Datasets / <dataset switcher> [/ version] [/ ...children]", shared by every dataset page. */
export function DatasetBreadcrumbs({ datasetId, datasetsHref, version, children }: DatasetBreadcrumbsProps) {
  const { data: dataset, isLoading } = useDataset({ datasetId, queryOptions: { enabled: Boolean(datasetId) } });
  return (
    <Breadcrumb label="Breadcrumb" className="min-w-0 flex-1 overflow-hidden" listClassName="min-w-0">
      <DatasetsCrumb href={datasetsHref} />
      <Crumb
        as="span"
        isCurrent={!version && !children}
        isLoading={isLoading}
        switcher={<DatasetCombobox value={datasetId} {...crumbSwitcherTriggerProps} aria-label="Switch dataset" />}
      >
        {dataset?.name ?? datasetId}
      </Crumb>
      {version ? <VersionCrumb datasetId={datasetId} {...version} /> : null}
      {children}
    </Breadcrumb>
  );
}

/** Dataset detail page shared by Studio and Platform: crumbs, actions, items, dialogs. */
export function DatasetPage({
  datasetId,
  currentItemId,
  searchParams,
  setSearchParams,
  datasetsHref,
  onEdit,
  onDeleted,
  headerActionsStart,
  itemPanel,
  children,
}: DatasetPageProps) {
  const { Link, navigate, paths } = useLinkComponent();
  const { activeVersion } = useDatasetItemsUrlState(searchParams, setSearchParams);
  const [addItemOpen, setAddItemOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [duplicateOpen, setDuplicateOpen] = useState(false);
  const [schemaOpen, setSchemaOpen] = useState(false);

  const { data: dataset, error, isLoading } = useDataset({ datasetId, queryOptions: { enabled: Boolean(datasetId) } });
  // Unfiltered items gate the tags editor; React Query dedupes this with DatasetItemsView.
  const { data: items = [], isLoading: isLoadingItems } = useDatasetItems({
    datasetId,
    search: undefined,
    version: activeVersion,
    queryOptions: { enabled: Boolean(datasetId) },
  });

  if (isLoading) return null;

  const shell = (content: ReactNode) => (
    <PageLayout variant="page" breadcrumbs={<DatasetBreadcrumbs datasetId={datasetId} datasetsHref={datasetsHref} />}>
      <h1 className="sr-only">Dataset</h1>
      <div />
      <div className="flex h-full items-center justify-center">{content}</div>
    </PageLayout>
  );

  if (error && is401UnauthorizedError(error)) return shell(<SessionExpired />);
  if (error && is403ForbiddenError(error)) return shell(<PermissionDenied resource="datasets" />);
  if ((error && is404NotFoundError(error)) || (!error && !dataset)) {
    return shell(
      <EmptyState
        titleSlot="Dataset not found"
        descriptionSlot={`No dataset with id "${datasetId}".`}
        actionSlot={
          <Button render={<Link href={datasetsHref} />} icon={<IconArrowLeft />}>
            Back to datasets
          </Button>
        }
      />,
    );
  }
  if (error || !dataset) {
    return shell(
      <EmptyState
        tone="error"
        titleSlot="Failed to load dataset"
        descriptionSlot={error instanceof Error ? error.message : 'An unexpected error occurred. Please try again.'}
      />,
    );
  }

  const showTagsEditor = items.length > 0 || (dataset.tags?.length ?? 0) > 0;

  const headerActions = (
    <>
      {headerActionsStart}
      <Button variant="ghost" size="sm" onClick={() => setSchemaOpen(true)} icon={<IconCodeBrackets />}>
        Schema
      </Button>
      <DropdownMenu>
        <DropdownMenu.Trigger asChild>
          <Button variant="ghost" size="icon-sm" aria-label="Dataset actions menu">
            <IconDotGrid1x3Vertical />
          </Button>
        </DropdownMenu.Trigger>
        <DropdownMenu.Content align="end" className="w-48">
          <DropdownMenu.Item onSelect={onEdit}>
            <IconPencil /> Edit dataset
          </DropdownMenu.Item>
          <DropdownMenu.Item onSelect={() => setDuplicateOpen(true)}>
            <IconSquareBehindSquare1 /> Duplicate dataset
          </DropdownMenu.Item>
          <DropdownMenu.Item onSelect={() => setDeleteOpen(true)} variant="destructive">
            <TrashIcon /> Delete dataset
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu>
    </>
  );

  return (
    <DatasetItemPanelProvider
      datasetId={datasetId}
      currentItemId={currentItemId}
      items={items}
      isLoadingItems={isLoadingItems}
    >
      <div className="flex h-full min-h-0">
        <div className="h-full min-w-0 flex-1">
          <PageLayout
            variant="page"
            body="fixed"
            breadcrumbs={
              <DatasetBreadcrumbs
                datasetId={datasetId}
                datasetsHref={datasetsHref}
                version={{ searchParams, setSearchParams }}
              />
            }
            headerActions={headerActions}
          >
            <h1 className="sr-only">{dataset.name}</h1>
            <div>
              <DatasetItemsView
                searchParams={searchParams}
                setSearchParams={setSearchParams}
                datasetId={datasetId}
                onAddItemClick={() => setAddItemOpen(true)}
                toolbarActionsSlot={showTagsEditor ? <DatasetTagsEditor datasetId={datasetId} /> : undefined}
              />
            </div>
          </PageLayout>
        </div>
        {itemPanel}
      </div>

      <AddDatasetItemDialog datasetId={datasetId} open={addItemOpen} onOpenChange={setAddItemOpen} />
      <DuplicateDatasetDialog
        open={duplicateOpen}
        onOpenChange={setDuplicateOpen}
        sourceDatasetId={dataset.id}
        sourceDatasetName={dataset.name}
        sourceDatasetDescription={dataset.description ?? undefined}
        sourceDatasetTargetType={dataset.targetType}
        onSuccess={id => navigate(paths.datasetLink(id))}
      />
      <DatasetSchemaDialog open={schemaOpen} onOpenChange={setSchemaOpen} dataset={dataset} />
      <DeleteDatasetDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        datasetId={dataset.id}
        datasetName={dataset.name}
        onSuccess={onDeleted}
      />
      {children}
    </DatasetItemPanelProvider>
  );
}

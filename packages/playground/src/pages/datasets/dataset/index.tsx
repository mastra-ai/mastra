import {
  Breadcrumb,
  Crumb,
  Header,
  MainContentLayout,
  PageHeader,
  Icon,
  HeaderAction,
  Button,
  DocsIcon,
  DatasetRowsList,
  rowsListColumns,
  DatasetTools,
  DatasetRowDialog,
  useDataset,
  useDatasetRows,
  useDatasetVersions,
  getToPreviousEntryFn,
  getToNextEntryFn,
  EntryListSkeleton,
} from '@mastra/playground-ui';
import { useParams, Link } from 'react-router';

import { DatabaseIcon, GaugeIcon } from 'lucide-react';

import { cn } from '@/lib/utils';
import { useEffect, useState } from 'react';

export default function Dataset() {
  const { datasetId } = useParams()! as { datasetId: string };

  const [dialogIsOpen, setDialogIsOpen] = useState<boolean>(false);
  const [selectedRowId, setSelectedRowId] = useState<string | undefined>();
  const [selectedVersionId, setSelectedVersionId] = useState<string>();

  const { data: datasetData, isLoading: isDatasetDataLoading } = useDataset(datasetId);
  const { data: rowsData, isLoading: isRowsDataLoading } = useDatasetRows(datasetId, { versionId: selectedVersionId });
  const { data: versionsData, isLoading: isVersionsDataLoading } = useDatasetVersions(datasetId);

  useEffect(() => {
    if (datasetData?.currentVersion.id && (!selectedVersionId || selectedVersionId !== datasetData.currentVersion.id)) {
      setSelectedVersionId(datasetData.currentVersion.id);
    }
  }, [datasetData]);

  const rows = (rowsData?.rows || []).map(row => ({
    ...row,
    id: row.rowId,
  }));

  const handleVersionChange = (value: string) => {
    setSelectedVersionId(value);
  };

  const handleRowClick = (id: string) => {
    setSelectedRowId(id);
    setDialogIsOpen(true);
  };

  const handleOnAdd = () => {
    setSelectedRowId(undefined);
    setDialogIsOpen(true);
  };

  const toNextRow = getToNextEntryFn({ entries: rows, id: selectedRowId, update: setSelectedRowId });
  const toPreviousRow = getToPreviousEntryFn({ entries: rows, id: selectedRowId, update: setSelectedRowId });

  return (
    <>
      <MainContentLayout>
        <Header>
          <Breadcrumb>
            <Crumb as={Link} to={`/scorers`}>
              <Icon>
                <GaugeIcon />
              </Icon>
              Scorers
            </Crumb>

            <Crumb as={Link} to={`/datasets/${datasetId}`} isCurrent>
              {datasetData?.name}
            </Crumb>
          </Breadcrumb>

          <HeaderAction>
            <Button as={Link} to="https://mastra.ai/en/docs/datasets/overview" target="_blank">
              <Icon>
                <DocsIcon />
              </Icon>
              Dataset documentation
            </Button>
          </HeaderAction>
        </Header>

        <div className={cn(`grid overflow-y-auto h-full`)}>
          <div className={cn('max-w-[100rem] w-full px-[3rem] mx-auto grid content-start gap-[2rem] h-full')}>
            <PageHeader
              title={datasetData?.name || 'loading'}
              description={datasetData?.description || 'loading'}
              icon={<DatabaseIcon />}
            />

            <DatasetTools
              datasetId={datasetId}
              onAdd={handleOnAdd}
              selectedVersionId={selectedVersionId}
              versions={versionsData?.versions || []}
              onVersionChange={handleVersionChange}
            />

            {isRowsDataLoading ? (
              <EntryListSkeleton columns={rowsListColumns} />
            ) : (
              <DatasetRowsList
                rows={rows}
                selectedRowId={selectedRowId}
                onRowClick={handleRowClick}
                // errorMsg={dataset?.errorMsg}
                // setEndOfListElement={dataset?.setEndOfListElement}
                // filtersApplied={dataset?.filtersApplied}
                // isFetchingNextPage={dataset?.isFetchingNextPage}
                // hasNextPage={dataset?.hasNextPage}
              />
            )}
          </div>
        </div>
      </MainContentLayout>
      <DatasetRowDialog
        dataset={datasetData}
        isOpen={dialogIsOpen}
        row={rows.find(row => row.rowId === selectedRowId)}
        onClose={() => setDialogIsOpen(false)}
        onNext={toNextRow}
        onPrevious={toPreviousRow}
      />
    </>
  );
}

import {
  Header,
  HeaderTitle,
  MainContentLayout,
  MainContentContent,
  Icon,
  Button,
  ButtonWithTooltip,
  HeaderAction,
  useDatasets,
  DatasetsTable,
  DatasetsList,
  CreateDatasetDialog,
  useLinkComponent,
  DocsIcon,
  ListSearch,
  MainHeader,
  EntityListPageLayout,
} from '@mastra/playground-ui';
import { BookIcon, Database, Plus } from 'lucide-react';
import { useState } from 'react';
import { useExperimentalUI } from '@/domains/experimental-ui/experimental-ui-context';

function Datasets() {
  const { Link: FrameworkLink } = useLinkComponent();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const { navigate, paths } = useLinkComponent();
  const { data: datasets = [], isLoading, error, hasNextPage, isFetchingNextPage, setEndOfListElement } = useDatasets();
  const { variant } = useExperimentalUI('entity-list-page');
  const [search, setSearch] = useState('');

  const handleDatasetCreated = (datasetId: string) => {
    setIsCreateDialogOpen(false);
    navigate(paths.datasetLink(datasetId));
  };

  if (variant === 'new-proposal') {
    return (
      <>
        <EntityListPageLayout>
          <EntityListPageLayout.Top>
            <MainHeader withMargins={false}>
              <MainHeader.Column>
                <MainHeader.Title isLoading={isLoading}>
                  <Database /> Datasets
                </MainHeader.Title>
              </MainHeader.Column>
              <MainHeader.Column className="flex justify-end gap-2">
                <ButtonWithTooltip
                  as="a"
                  href="https://mastra.ai/reference/datasets/dataset"
                  target="_blank"
                  rel="noopener noreferrer"
                  tooltipContent="Go to Dataset documentation"
                >
                  <BookIcon />
                </ButtonWithTooltip>
                <Button variant="primary" onClick={() => setIsCreateDialogOpen(true)}>
                  <Plus />
                  Create Dataset
                </Button>
              </MainHeader.Column>
            </MainHeader>
            <div className="max-w-[30rem]">
              <ListSearch onSearch={setSearch} label="Filter datasets" placeholder="Filter by name or description" />
            </div>
          </EntityListPageLayout.Top>

          <DatasetsList
            datasets={datasets}
            isLoading={isLoading}
            error={error}
            search={search}
            hasNextPage={hasNextPage}
            isFetchingNextPage={isFetchingNextPage}
            setEndOfListElement={setEndOfListElement}
          />
        </EntityListPageLayout>

        <CreateDatasetDialog
          open={isCreateDialogOpen}
          onOpenChange={setIsCreateDialogOpen}
          onSuccess={handleDatasetCreated}
        />
      </>
    );
  }

  return (
    <MainContentLayout>
      <Header>
        <HeaderTitle>
          <Icon>
            <Database />
          </Icon>
          Datasets
        </HeaderTitle>
        <HeaderAction>
          <Button variant="light" onClick={() => setIsCreateDialogOpen(true)}>
            <Icon>
              <Plus />
            </Icon>
            Create Dataset
          </Button>
          <Button
            as={FrameworkLink}
            to="https://mastra.ai/reference/datasets/dataset"
            target="_blank"
            variant="ghost"
            size="md"
          >
            <DocsIcon />
            Datasets documentation
          </Button>
        </HeaderAction>
      </Header>

      <MainContentContent isCentered={!isLoading && datasets.length === 0}>
        <DatasetsTable
          datasets={datasets}
          isLoading={isLoading}
          error={error}
          onCreateClick={() => setIsCreateDialogOpen(true)}
          hasNextPage={hasNextPage}
          isFetchingNextPage={isFetchingNextPage}
          setEndOfListElement={setEndOfListElement}
        />
      </MainContentContent>

      <CreateDatasetDialog
        open={isCreateDialogOpen}
        onOpenChange={setIsCreateDialogOpen}
        onSuccess={handleDatasetCreated}
      />
    </MainContentLayout>
  );
}

export { Datasets };
export default Datasets;

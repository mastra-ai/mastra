import { Sidebar } from '@mastra/playground-ui/components/Sidebar';
import { Skeleton } from '@mastra/playground-ui/components/Skeleton';
import { DatasetsIcon } from '@mastra/playground-ui/icons/DatasetsIcon';
import { useInfiniteDatasets } from '@mastra/react/hooks/datasets';
import { useMatch } from 'react-router';
import { ContextualSidebarSection } from '@/components/ui/contextual-sidebar-section';

/** Datasets are what experiments run on; the list stays while one is open. */
export function DatasetsSidebarList({ search }: { search: string }) {
  const { data: datasets = [], isLoading, setEndOfListElement } = useInfiniteDatasets();
  const openDatasetId = useMatch('/datasets/:datasetId/*')?.params.datasetId;
  if (isLoading) return <Skeleton className="m-3 h-24 shrink-0" />;

  const query = search.trim().toLowerCase();
  const matching = datasets.filter(dataset => dataset.name.toLowerCase().includes(query));

  return (
    <ContextualSidebarSection>
      <Sidebar.Nav aria-label="Datasets list">
        <Sidebar.NavSection>
          <Sidebar.NavHeader state="default">Datasets</Sidebar.NavHeader>
          <Sidebar.NavList>
            {matching.map(dataset => (
              <Sidebar.NavLink
                key={dataset.id}
                state="default"
                link={{
                  name: dataset.name,
                  url: `/datasets/${encodeURIComponent(dataset.id)}`,
                  icon: <DatasetsIcon />,
                }}
                isActive={dataset.id === openDatasetId}
              />
            ))}
          </Sidebar.NavList>
          {matching.length === 0 && <p className="text-ui-sm px-3 py-2 text-muted-foreground">No datasets found.</p>}
          <div ref={setEndOfListElement} />
        </Sidebar.NavSection>
      </Sidebar.Nav>
    </ContextualSidebarSection>
  );
}

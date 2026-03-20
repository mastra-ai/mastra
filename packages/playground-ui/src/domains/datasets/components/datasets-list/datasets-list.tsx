import type { DatasetRecord } from '@mastra/client-js';
import { EntityList } from '@/ds/components/EntityList';
import { EntityListSkeleton } from '@/ds/components/EntityList';
import { PermissionDenied } from '@/ds/components/PermissionDenied';
import { is403ForbiddenError } from '@/lib/query-utils';
import { useLinkComponent } from '@/lib/framework';
import { truncateString } from '@/lib/truncate-string';
import { EmptyDatasetsTable } from '../empty-datasets-table';
import { useMemo, useState } from 'react';
import { format } from 'date-fns';

export interface DatasetsListProps {
  datasets: DatasetRecord[];
  isLoading: boolean;
  error?: Error | null;
  onCreateClick?: () => void;
  search?: string;
  onSearch?: (search: string) => void;
}

export function DatasetsList({
  datasets,
  isLoading,
  error,
  onCreateClick,
  search: externalSearch,
  onSearch: externalOnSearch,
}: DatasetsListProps) {
  const { paths } = useLinkComponent();
  const [internalSearch, setInternalSearch] = useState('');
  const search = externalSearch ?? internalSearch;

  const filteredData = useMemo(() => {
    const term = search.toLowerCase();
    return datasets.filter(ds => ds.name.toLowerCase().includes(term) || ds.description?.toLowerCase().includes(term));
  }, [datasets, search]);

  if (error && is403ForbiddenError(error)) {
    return <PermissionDenied resource="datasets" />;
  }

  if (datasets.length === 0 && !isLoading) {
    return <EmptyDatasetsTable onCreateClick={onCreateClick} />;
  }

  if (isLoading) {
    return (
      <EntityListSkeleton
        columns="auto 1fr auto auto"
      />
    );
  }

  return (
    <EntityList columns="auto 1fr auto auto">
      <EntityList.Top>
        <EntityList.TopCell>Name</EntityList.TopCell>
        <EntityList.TopCell>Description</EntityList.TopCell>
        <EntityList.TopCell className="text-center">Version</EntityList.TopCell>
        <EntityList.TopCell className="text-center">Created</EntityList.TopCell>
      </EntityList.Top>

      {filteredData.map(ds => {
        const name = truncateString(ds.name, 50);
        const description = truncateString(ds.description ?? '', 200);
        const createdAt = ds.createdAt instanceof Date ? ds.createdAt : new Date(ds.createdAt);

        return (
          <EntityList.RowLink key={ds.id} to={paths.datasetLink(ds.id)}>
            <EntityList.NameCell>{name}</EntityList.NameCell>
            <EntityList.DescriptionCell>{description}</EntityList.DescriptionCell>
            <EntityList.TextCell>v. {ds.version}</EntityList.TextCell>
            <EntityList.TextCell>{format(createdAt, 'PP')}</EntityList.TextCell>
          </EntityList.RowLink>
        );
      })}
    </EntityList>
  );
}

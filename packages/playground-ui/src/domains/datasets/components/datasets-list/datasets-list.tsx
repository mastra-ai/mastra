import type { DatasetRecord } from '@mastra/client-js';
import { EntityList } from '@/ds/components/EntityList';
import { EntityListSkeleton } from '@/ds/components/EntityList';
import { ErrorState } from '@/ds/components/ErrorState';
import { PermissionDenied } from '@/ds/components/PermissionDenied';
import { is403ForbiddenError } from '@/lib/query-utils';
import { useLinkComponent } from '@/lib/framework';
import { truncateString } from '@/lib/truncate-string';
import { NoDatasetsInfo } from './no-datasets-info';
import { useMemo } from 'react';
import { format } from 'date-fns';

export interface DatasetsListProps {
  datasets: DatasetRecord[];
  isLoading: boolean;
  error?: Error | null;
  search?: string;
}

export function DatasetsList({ datasets, isLoading, error, search = '' }: DatasetsListProps) {
  const { paths } = useLinkComponent();

  const filteredData = useMemo(() => {
    const term = search.toLowerCase();
    return datasets.filter(ds => ds.name.toLowerCase().includes(term) || ds.description?.toLowerCase().includes(term));
  }, [datasets, search]);

  if (error && is403ForbiddenError(error)) {
    return <PermissionDenied resource="datasets" />;
  }

  if (error) {
    return <ErrorState title="Failed to load datasets" message={error.message} />;
  }

  if (datasets.length === 0 && !isLoading) {
    return <NoDatasetsInfo />;
  }

  if (isLoading) {
    return <EntityListSkeleton columns="auto 1fr auto auto" />;
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

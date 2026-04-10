import type { GetWorkflowResponse } from '@mastra/client-js';
import { useMemo } from 'react';
import { EntityList, EntityListSkeleton } from '@/ds/components/EntityList';
import { useLinkComponent } from '@/lib/framework';
import { truncateString } from '@/lib/truncate-string';

export interface WorkflowsListProps {
  workflows: Record<string, GetWorkflowResponse>;
  isLoading: boolean;
  search?: string;
}

export function WorkflowsList({ workflows, isLoading, search = '' }: WorkflowsListProps) {
  const { paths } = useLinkComponent();

  const workflowData = useMemo(
    () =>
      Object.keys(workflows).map(key => ({
        ...workflows[key],
        id: key,
      })),
    [workflows],
  );

  const filteredData = useMemo(() => {
    const term = search.toLowerCase();
    return workflowData.filter(
      wf => wf.name?.toLowerCase().includes(term) || wf.description?.toLowerCase().includes(term),
    );
  }, [workflowData, search]);

  if (isLoading) {
    return <EntityListSkeleton columns="auto 1fr auto" />;
  }

  return (
    <EntityList columns="auto 1fr auto">
      <EntityList.Top>
        <EntityList.TopCell>Name</EntityList.TopCell>
        <EntityList.TopCell>Description</EntityList.TopCell>
        <EntityList.TopCell>Number of steps</EntityList.TopCell>
      </EntityList.Top>

      {filteredData.length === 0 && search ? <EntityList.NoMatch message="No Workflows match your search" /> : null}

      {filteredData.map(wf => {
        const name = truncateString(wf.name, 50);
        const description = truncateString(wf.description ?? '', 200);
        const stepsCount = Object.keys(wf.steps ?? {}).length;

        return (
          <EntityList.RowLink key={wf.id} to={paths.workflowLink(wf.id)}>
            <EntityList.NameCell>{name}</EntityList.NameCell>
            <EntityList.DescriptionCell>{description}</EntityList.DescriptionCell>
            <EntityList.TextCell className="text-center">{stepsCount || ''}</EntityList.TextCell>
          </EntityList.RowLink>
        );
      })}
    </EntityList>
  );
}

import type { GetWorkflowResponse } from '@mastra/client-js';
import { EntityList, EntityListSkeleton, truncateString } from '@mastra/playground-ui';
import { useMemo } from 'react';
import { useLinkComponent } from '@/lib/framework';

export interface WorkflowsListProps {
  workflows: Record<string, GetWorkflowResponse>;
  isLoading: boolean;
  search?: string;
}

export function WorkflowsList({ workflows, isLoading, search = '' }: WorkflowsListProps) {
  const { paths, Link } = useLinkComponent();

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
          <EntityList.RowLink key={wf.id} to={paths.workflowLink(wf.id)} LinkComponent={Link}>
            <EntityList.NameCell>{name}</EntityList.NameCell>
            <EntityList.DescriptionCell>{description}</EntityList.DescriptionCell>
            <EntityList.TextCell className="text-center">{stepsCount || ''}</EntityList.TextCell>
          </EntityList.RowLink>
        );
      })}
    </EntityList>
  );
}

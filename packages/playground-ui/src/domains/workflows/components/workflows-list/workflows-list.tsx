import type { GetWorkflowResponse } from '@mastra/client-js';
import { EntityList } from '@/ds/components/EntityList';
import { EntityListSkeleton } from '@/ds/components/EntityList';
import { EmptyState } from '@/ds/components/EmptyState';
import { Button } from '@/ds/components/Button';
import { Icon } from '@/ds/icons/Icon';
import { WorkflowIcon } from '@/ds/icons';
import { PermissionDenied } from '@/ds/components/PermissionDenied';
import { is403ForbiddenError } from '@/lib/query-utils';
import { useLinkComponent } from '@/lib/framework';
import { truncateString } from '@/lib/truncate-string';
import { useMemo, useState } from 'react';
import { Footprints } from 'lucide-react';

export interface WorkflowsListProps {
  workflows: Record<string, GetWorkflowResponse>;
  isLoading: boolean;
  error?: Error | null;
  search?: string;
  onSearch?: (search: string) => void;
}

export function WorkflowsList({
  workflows,
  isLoading,
  error,
  search: externalSearch,
  onSearch: externalOnSearch,
}: WorkflowsListProps) {
  const { paths } = useLinkComponent();
  const [internalSearch, setInternalSearch] = useState('');
  const search = externalSearch ?? internalSearch;

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

  if (error && is403ForbiddenError(error)) {
    return <PermissionDenied resource="workflows" />;
  }

  if (workflowData.length === 0 && !isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <EmptyState
          iconSlot={<WorkflowIcon className="h-8 w-8" />}
          titleSlot="No Workflows"
          descriptionSlot="Workflows are not configured yet. You can find more information in the documentation."
          actionSlot={
            <Button as="a" href="https://mastra.ai/en/docs/workflows/overview" target="_blank">
              <Icon>
                <WorkflowIcon />
              </Icon>
              Docs
            </Button>
          }
        />
      </div>
    );
  }

  if (isLoading) {
    return (
      <EntityListSkeleton
        columns="auto 1fr auto"
      />
    );
  }

  return (
    <EntityList columns="auto 1fr auto">
      <EntityList.Top>
        <EntityList.TopCell>Name</EntityList.TopCell>
        <EntityList.TopCell>Description</EntityList.TopCell>
        <EntityList.TopCell>Number of steps</EntityList.TopCell>
      </EntityList.Top>

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

import { Button } from '@mastra/playground-ui/components/Button';
import { Card, CardContent } from '@mastra/playground-ui/components/Card';
import { EmptyState } from '@mastra/playground-ui/components/EmptyState';
import { ErrorState } from '@mastra/playground-ui/components/ErrorState';
import { ListSearch } from '@mastra/playground-ui/components/ListSearch';
import { PageHeader } from '@mastra/playground-ui/components/PageHeader';
import { PageLayout } from '@mastra/playground-ui/components/PageLayout';
import { WorkflowIcon } from '@mastra/playground-ui/icons/WorkflowIcon';
import { PlusIcon } from 'lucide-react';
import { useMemo, useState } from 'react';

import { useWorkflowBuilderAccess } from '@/domains/workflows/builder';
import { useStoredWorkflows } from '@/domains/workflows/hooks/use-stored-workflows';
import { useLinkComponent } from '@/lib/framework';

export default function WorkflowBuilderPage() {
  const [search, setSearch] = useState('');
  const { Link } = useLinkComponent();
  const { canWrite } = useWorkflowBuilderAccess();
  const { data, isLoading, error } = useStoredWorkflows({ status: 'active' });
  const workflows = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return data?.workflows ?? [];
    return (data?.workflows ?? []).filter(
      workflow => workflow.id.toLowerCase().includes(query) || workflow.description?.toLowerCase().includes(query),
    );
  }, [data?.workflows, search]);

  return (
    <PageLayout className="px-4 md:px-10">
      <PageLayout.TopArea>
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <PageHeader>
            <PageHeader.Title>
              <WorkflowIcon /> Workflow Builder
            </PageHeader.Title>
            <PageHeader.Description>Create and revisit persisted workflows.</PageHeader.Description>
          </PageHeader>
          {canWrite ? (
            <Button as={Link} to="/workflow-builder/create" variant="primary" className="w-full md:w-auto">
              <PlusIcon /> New workflow
            </Button>
          ) : null}
        </div>
        <div className="max-w-120">
          <ListSearch onSearch={setSearch} label="Filter workflows" placeholder="Filter by name or description" />
        </div>
      </PageLayout.TopArea>

      {isLoading ? <div className="py-16 text-center text-ui-sm text-neutral3">Loading workflows…</div> : null}
      {error ? <ErrorState title="Failed to load workflows" message={error.message} /> : null}
      {!isLoading && !error && workflows.length === 0 ? (
        <div className="flex justify-center py-16">
          <EmptyState
            iconSlot={<WorkflowIcon className="h-8 w-8 text-neutral3" />}
            titleSlot={search ? 'No matching workflows' : 'No persisted workflows yet'}
            descriptionSlot={search ? 'Try a different search.' : 'Describe a workflow and let the builder create it.'}
            actionSlot={
              canWrite && !search ? (
                <Button as={Link} to="/workflow-builder/create" variant="primary">
                  <PlusIcon /> Create a workflow
                </Button>
              ) : undefined
            }
          />
        </div>
      ) : null}
      {!isLoading && !error && workflows.length > 0 ? (
        <div className="grid gap-3 pb-10 md:grid-cols-2 xl:grid-cols-3">
          {workflows.map(workflow => (
            <Link key={workflow.id} href={`/workflow-builder/${encodeURIComponent(workflow.id)}`}>
              <Card interactive>
                <CardContent className="space-y-2">
                  <h2 className="text-ui-md font-medium text-neutral6">{workflow.id}</h2>
                  <p className="line-clamp-2 min-h-10 text-ui-sm text-neutral3">
                    {workflow.description || 'No description'}
                  </p>
                  <p className="text-ui-xs text-neutral2">{workflow.graph.length} steps</p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      ) : null}
    </PageLayout>
  );
}

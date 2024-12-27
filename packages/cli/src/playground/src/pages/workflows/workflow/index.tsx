import { useParams } from 'react-router';

import Breadcrumb from '@/components/ui/breadcrumbs';
import { Header } from '@/components/ui/header';
import { Skeleton } from '@/components/ui/skeleton';

import WorkflowGraph from '@/domains/workflows/workflow-graph';
import { WorkflowInformation } from '@/domains/workflows/workflow-information';
import { useWorkflow } from '@/hooks/use-workflows';

function Workflow() {
  const { workflowId } = useParams();
  const { workflow, isLoading: isWorkflowLoading } = useWorkflow(workflowId!);

  if (isWorkflowLoading) {
    return (
      <div className="flex flex-col h-full overflow-hidden">
        <Header title={<Skeleton className="h-6 w-[200px]" />} />
        <main className="flex-1 relative grid grid-cols-[1fr_400px] divide-x">
          <div className="p-4">
            <Skeleton className="h-[600px]" />
          </div>
          <div className="flex flex-col">
            <WorkflowInformation workflowId={workflowId!} />
          </div>
        </main>
      </div>
    );
  }

  const breadcrumbItems = [
    {
      label: 'Workflows',
      href: '/workflows',
    },
    {
      label: workflow?.name,
      href: `/workflows/${workflowId}`,
      isCurrent: true,
    },
  ];

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <Header title={<Breadcrumb items={breadcrumbItems} />} />
      <main className="flex-1 relative grid grid-cols-[1fr_400px] divide-x">
        <WorkflowGraph workflow={workflow!} />
        <div className="flex flex-col">
          <WorkflowInformation workflowId={workflowId!} />
        </div>
      </main>
    </div>
  );
}

export default Workflow;

import { useMatch, useNavigate } from 'react-router';

import Breadcrumb from '@/components/ui/breadcrumbs';
import { Button } from '@/components/ui/button';
import { Header } from '@/components/ui/header';

export function WorkflowHeader({ workflowName, workflowId }: { workflowName: string; workflowId: string }) {
  const isGraphPage = useMatch(`/workflows/${workflowId}/graph`);
  const isTracesPage = useMatch(`/workflows/${workflowId}/traces`);
  const navigate = useNavigate();

  const breadcrumbItems = [
    {
      label: 'Workflows',
      href: '/workflows',
    },
    {
      label: workflowName,
      href: `/workflows/${workflowId}`,
      isCurrent: true,
    },
  ];
  return (
    <Header title={<Breadcrumb items={breadcrumbItems} />}>
      <Button
        variant={isGraphPage ? 'primary' : 'outline'}
        size="slim"
        onClick={() => navigate(`/workflows/${workflowId}/graph`)}
      >
        Graph
      </Button>
      <Button
        variant={isTracesPage ? 'primary' : 'outline'}
        size="slim"
        onClick={() => navigate(`/workflows/${workflowId}/traces`)}
      >
        Traces
      </Button>
    </Header>
  );
}

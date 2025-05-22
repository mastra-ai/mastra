import { ScrollArea } from '@/components/ui/scroll-area';

import { useWorkflows } from '@/hooks/use-workflows';
import { DataTable, Header, HeaderTitle } from '@mastra/playground-ui';
import { workflowsTableColumns } from '@/domains/workflows/table.columns';
import { useNavigate } from 'react-router';

function Workflows() {
  const navigate = useNavigate();
  const { workflows, legacyWorkflows, isLoading } = useWorkflows();

  const legacyWorkflowList = Object.entries(legacyWorkflows).map(([key, workflow]) => ({
    id: key,
    name: workflow.name,
    stepsCount: Object.keys(workflow.steps)?.length,
    isLegacy: true,
  }));

  const workflowList = Object.entries(workflows).map(([key, workflow]) => ({
    id: key,
    name: workflow.name,
    stepsCount: Object.keys(workflow.steps ?? {})?.length,
    isLegacy: false,
  }));

  return (
    <div className="h-full relative overflow-hidden">
      <Header>
        <HeaderTitle>Workflows</HeaderTitle>
      </Header>
      <section className="flex-1 relative overflow-hidden">
        <ScrollArea className="h-full">
          <DataTable
            emptyText="Workflows"
            isLoading={isLoading}
            columns={workflowsTableColumns}
            data={[...workflowList, ...legacyWorkflowList]}
            onClick={row => navigate(`/workflows${row.isLegacy ? '/legacy' : ''}/${row.id}/graph`)}
          />
        </ScrollArea>
      </section>
    </div>
  );
}

export default Workflows;

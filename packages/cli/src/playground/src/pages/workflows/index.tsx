import { ScrollArea } from '@/components/ui/scroll-area';

import { useWorkflows } from '@/hooks/use-workflows';
import { DataTable, Header, HeaderTitle } from '@mastra/playground-ui';
import { workflowsTableColumns } from '@/domains/workflows/table.columns';

function Workflows() {
  const { workflows, vNextWorkflows, isLoading } = useWorkflows();

  const workflowList = Object.entries(workflows).map(([key, workflow]) => ({
    id: key,
    name: workflow.name,
    stepsCount: Object.keys(workflow.steps)?.length,
  }));

  const vNextWorkflowList = Object.entries(vNextWorkflows).map(([key, workflow]) => ({
    id: key,
    name: workflow.name,
    stepsCount: Object.keys(workflow.steps ?? {})?.length,
    isVNext: true,
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
            data={[...workflowList, ...vNextWorkflowList]}
          />
        </ScrollArea>
      </section>
    </div>
  );
}

export default Workflows;

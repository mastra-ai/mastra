import { useWorkflows } from '@/hooks/use-workflows';
import {
  Button,
  DataTable,
  EmptyState,
  Header,
  HeaderTitle,
  Icon,
  WorkflowCoinIcon,
  WorkflowIcon,
} from '@mastra/playground-ui';
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

  if (isLoading) return null;

  return (
    <div className="grid grid-rows-[auto_1fr] h-full">
      <Header>
        <HeaderTitle>Workflows</HeaderTitle>
      </Header>

      <section className="flex-1 relative overflow-hidden h-full">
        {workflowList.length === 0 ? (
          <div className="flex h-full items-center justify-center">
            <EmptyState
              iconSlot={<WorkflowCoinIcon />}
              titleSlot="Configure Workflows"
              descriptionSlot="Mastra workflows are not configured yet. You can find more information in the documentation."
              actionSlot={
                <Button
                  size="lg"
                  className="w-full"
                  variant="light"
                  as="a"
                  href="https://mastra.ai/en/docs/workflows/overview"
                  target="_blank"
                >
                  <Icon>
                    <WorkflowIcon />
                  </Icon>
                  Docs
                </Button>
              }
            />
          </div>
        ) : (
          <div className="overflow-y-auto h-full">
            <DataTable
              emptyText="Workflows"
              columns={workflowsTableColumns}
              data={[...workflowList, ...legacyWorkflowList]}
              onClick={row => navigate(`/workflows${row.isLegacy ? '/legacy' : ''}/${row.id}/graph`)}
            />
          </div>
        )}
      </section>
    </div>
  );
}

export default Workflows;

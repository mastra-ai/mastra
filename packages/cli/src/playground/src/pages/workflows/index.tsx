import { Workflow } from 'lucide-react';
import { useNavigate } from 'react-router';

import { Button } from '@/components/ui/button';
import { Header } from '@/components/ui/header';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';

import { useWorkflows } from '@/hooks/use-workflows';
import { WorkflowsTable } from '@mastra/playground-ui';

function Workflows() {
  const { workflows, isLoading } = useWorkflows();
  const navigate = useNavigate();

  const workflowList = Object.entries(workflows).map(([key, workflow]) => ({
    id: key,
    name: workflow.name,
  }));
  ``;
  return (
    <div className="flex flex-col h-full relative overflow-hidden">
      <section className="flex-1 relative overflow-hidden">
        <ScrollArea className="h-full">
          <WorkflowsTable
            title={<Header title="Workflows" className="border-0" />}
            isLoading={isLoading}
            workflowsList={workflowList}
            columns={[
              {
                id: 'name',
                header: 'Name',
                cell: ({ row }) => (
                  <button className="w-full h-full flex justify-start py-4">
                    <span className="text-mastra-el-5 text-sm  truncate">{row.original.name}</span>
                  </button>
                ),
              },

              {
                id: 'model',
                header: 'Model',
                cell: ({ row }) => (
                  <button
                    className="w-full h-full flex justify-start py-4"
                    onClick={() => {
                      navigate(`/workflows/${row.original.id}/graph`);
                    }}
                  >
                    <span className="hover:no-underline">
                      <Button size="sm" variant="outline">
                        <Workflow className="h-4 w-4 text-inherit" />
                        View Workflow
                      </Button>
                    </span>
                  </button>
                ),
              },
            ]}
          />
        </ScrollArea>
      </section>
    </div>
  );
}

export default Workflows;

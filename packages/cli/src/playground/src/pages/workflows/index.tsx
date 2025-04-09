import { Footprints, Workflow } from 'lucide-react';
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
    stepsCount: Object.keys(workflow.steps)?.length,
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
                  <div className="w-full h-full flex justify-start py-4">
                    <span className="text-mastra-el-5 text-sm truncate">{row.original.name}</span>
                  </div>
                ),
              },
              {
                id: 'action',
                header: 'Action',
                cell: ({ row }) => (
                  <div className="flex justify-end items-center gap-5 py-4">
                    <div className="bg-accent w-fit flex items-center gap-1 rounded-md py-1 px-2">
                      <Footprints className="text-inherit w-4 h-4" />
                      <span className="text-mastra-el-5 text-sm">
                        {row.original.stepsCount} step{row.original.stepsCount > 1 ? 's' : ''}
                      </span>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        navigate(`/workflows/${row.original.id}/graph`);
                      }}
                    >
                      <Workflow className="h-4 w-4 text-inherit" />
                      View Workflow
                    </Button>
                  </div>
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

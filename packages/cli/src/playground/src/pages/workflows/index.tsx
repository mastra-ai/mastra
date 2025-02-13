import { Workflow } from 'lucide-react';
import { useNavigate } from 'react-router';

import { Button } from '@/components/ui/button';
import { Header } from '@/components/ui/header';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';

import { useWorkflows } from '@/hooks/use-workflows';

function Workflows() {
  const { workflows, isLoading } = useWorkflows();
  const navigate = useNavigate();

  return (
    <div className="flex flex-col h-full relative overflow-hidden">
      <Header title="Workflows" />
      <main className="flex-1 relative overflow-hidden">
        <ScrollArea className="rounded-lg h-full">
          <Table>
            <TableHeader className="bg-[#171717] sticky top-0 z-10">
              <TableRow className="border-gray-6 border-b-[0.1px] text-[0.8125rem]">
                <TableHead className="w-[50px]"></TableHead>
                <TableHead className="text-mastra-el-3 w-1/2">Name</TableHead>
                <TableHead className="text-mastra-el-3">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody className="border-b border-gray-6">
              {isLoading ? (
                <TableRow className="border-b-gray-6 border-b-[0.1px] text-[0.8125rem]">
                  <TableCell>
                    <Skeleton className="h-8 w-8" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-8 w-full" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-8 w-full" />
                  </TableCell>
                </TableRow>
              ) : (
                Object.entries(workflows).map(([key, workflow]) => (
                  <TableRow key={key} className="border-b-gray-6 border-b-[0.1px] text-[0.8125rem]">
                    <TableCell>
                      <div className="h-8 w-full flex items-center justify-center">
                        <Workflow className="h-4 w-4 text-mastra-el-5" />
                      </div>
                    </TableCell>
                    <TableCell className="font-medium truncate max-w-[500px] text-mastra-el-5">
                      {workflow.name}
                    </TableCell>
                    <TableCell className="text-mastra-el-5 text-sm">
                      <span
                        onClick={() => {
                          navigate(`/workflows/${key}/graph`);
                        }}
                        className="hover:no-underline"
                      >
                        <Button size="sm" variant="outline">
                          <Workflow className="h-4 w-4 text-inherit" />
                          View Workflow
                        </Button>
                      </span>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </ScrollArea>
      </main>
    </div>
  );
}

export default Workflows;

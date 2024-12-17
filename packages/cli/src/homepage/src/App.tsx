import { Layout } from '@shared/components/layout';
import { Button } from '@shared/components/ui/button';
import { Header } from '@shared/components/ui/header';
import { ScrollArea } from '@shared/components/ui/scroll-area';
import { Skeleton } from '@shared/components/ui/skeleton';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@shared/components/ui/table';
import { useAgents } from '@shared/hooks/use-agents';
import { Bot, BotMessageSquare } from 'lucide-react';

function App() {
  const { agents, isLoading } = useAgents();

  return (
    <Layout>
      <div className="flex flex-col h-full relative overflow-hidden">
        <Header title="Agents" />
        <main className="flex-1 relative overflow-hidden">
          <ScrollArea className="rounded-lg h-full">
            <Table>
              <TableHeader className="bg-[#171717] sticky top-0 z-10">
                <TableRow className="border-gray-6 border-b-[0.1px] text-[0.8125rem]">
                  <TableHead className="w-[50px]"></TableHead>
                  <TableHead className="text-mastra-el-3">Name</TableHead>
                  <TableHead className="text-mastra-el-3 w-1/2">Instruction</TableHead>
                  <TableHead className="text-mastra-el-3">Model</TableHead>
                  <TableHead className="text-mastra-el-3">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className="border-b border-gray-6">
                {isLoading ? (
                  <TableRow className="border-b-gray-6 cursor-pointer border-b-[0.1px] text-[0.8125rem]">
                    <TableCell>
                      <Skeleton className="h-8 w-8" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-8 w-full" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-8 w-full" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-8 w-full" />
                    </TableCell>
                  </TableRow>
                ) : (
                  Object.entries(agents).map(([key, agent]) => (
                    <TableRow key={key} className="border-b-gray-6 cursor-pointer border-b-[0.1px] text-[0.8125rem]">
                      <TableCell className="flex items-center justify-center">
                        <Bot className="h-4 w-4 text-mastra-el-5" />
                      </TableCell>
                      <TableCell className="font-medium text-mastra-el-5">{agent.name}</TableCell>
                      <TableCell className="truncate w-1/2 max-w-[500px] text-mastra-el-5">
                        {agent.instructions}
                      </TableCell>
                      <TableCell className="text-mastra-el-5 text-sm">{agent?.model?.provider}</TableCell>
                      <TableCell className="text-mastra-el-5 text-sm">
                        <a href={`/agents/${key}`} className="hover:no-underline">
                          <Button size="sm" variant="outline">
                            <BotMessageSquare className="h-4 w-4 text-inherit" />
                            Chat with agent
                          </Button>
                        </a>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </ScrollArea>
        </main>
      </div>
    </Layout>
  );
}

export default App;

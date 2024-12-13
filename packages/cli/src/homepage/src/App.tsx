import { Layout } from '@shared/components/layout';
import { Button } from '@shared/components/ui/button';
import { Header } from '@shared/components/ui/header';
import { ScrollArea } from '@shared/components/ui/scroll-area';
import { Skeleton } from '@shared/components/ui/skeleton';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@shared/components/ui/table';
import { useAgents } from '@shared/hooks/use-agents';
import { Bot, BotMessageSquare } from 'lucide-react';

// const roles = [
//   'Assistant',
//   'Analyst',
//   'Expert',
//   'Specialist',
//   'Consultant',
//   'Coach',
//   'Advisor',
//   'Guide',
//   'Researcher',
//   'Planner',
//   'Strategist',
//   'Developer',
//   'Designer',
//   'Teacher',
//   'Mentor',
// ];

// const domains = [
//   'Marketing',
//   'Finance',
//   'Healthcare',
//   'Technology',
//   'Education',
//   'Legal',
//   'Science',
//   'Business',
//   'Art',
//   'Music',
//   'Sports',
//   'Writing',
//   'Data',
//   'Product',
//   'Sales',
//   'HR',
//   'Engineering',
//   'Research',
//   'Content',
//   'Social Media',
// ];

// const actionVerbs = [
//   'Analyzes',
//   'Optimizes',
//   'Creates',
//   'Develops',
//   'Guides through',
//   'Helps with',
//   'Provides insights on',
//   'Generates',
//   'Reviews',
//   'Assists with',
//   'Plans',
//   'Designs',
// ];

// const outputs = [
//   'strategies',
//   'solutions',
//   'recommendations',
//   'content',
//   'analyses',
//   'frameworks',
//   'plans',
//   'reports',
//   'insights',
//   'documentation',
//   'feedback',
//   'improvements',
// ];

// const models = ['GPT-4', 'Claude-3'];

// const demoAgents = Array.from({ length: 100 }, (_, i) => {
//   const role = roles[Math.floor(Math.random() * roles.length)];
//   const domain = domains[Math.floor(Math.random() * domains.length)];
//   const verb = actionVerbs[Math.floor(Math.random() * actionVerbs.length)];
//   const output = outputs[Math.floor(Math.random() * outputs.length)];
//   const model = models[Math.floor(Math.random() * models.length)];

//   return {
//     name: `${domain} ${role}`,
//     instructions: `${verb} ${domain.toLowerCase()} ${output} using industry best practices`,
//     modelName: model,
//     modelProvider: 'OpenAI',
//   };
// });

function App() {
  const { agents, isLoading } = useAgents();
  // const isLoading = false;
  // const displayedAgents = demoAgents;

  return (
    <Layout>
      <div className="flex flex-col h-full bg-background relative overflow-hidden">
        <Header title="Agents" />
        <main className="flex-1 relative overflow-hidden">
          <ScrollArea className="rounded-lg h-full">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[50px]"></TableHead>
                  <TableHead className="w-[300px]">Name</TableHead>
                  <TableHead>Instruction</TableHead>
                  <TableHead className="w-[150px]">Model</TableHead>
                  <TableHead className="w-[150px]">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
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
                  agents.map(agent => (
                    <TableRow key={agent.name} className="cursor-pointer">
                      <TableCell>
                        <div className="h-8 w-8 rounded bg-zinc-900 flex items-center justify-center">
                          <Bot className="h-4 w-4 text-gray-100" />
                        </div>
                      </TableCell>
                      <TableCell className="font-medium">{agent.name}</TableCell>
                      <TableCell className="text-gray-300 text-sm truncate">{agent.instructions}</TableCell>
                      <TableCell className="text-gray-400 text-sm">{agent.modelName || agent.modelProvider}</TableCell>
                      <TableCell className="text-gray-400 text-sm">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => (window.location.href = `/agents/${agent.name}`)}
                        >
                          <BotMessageSquare className="h-4 w-4 text-gray-100" />
                          Chat with agent
                        </Button>
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

import { PanelLeft } from 'lucide-react';
import { useState } from 'react';
import { useMatch, useNavigate, useParams } from 'react-router';

import { Chat } from '@/components/Chat';
import Breadcrumb from '@/components/ui/breadcrumbs';
import { Button } from '@/components/ui/button';
import { Header } from '@/components/ui/header';
import { Skeleton } from '@/components/ui/skeleton';

import { cn } from '@/lib/utils';

import { AgentEvals } from '@/domains/agents/agent-evals';
import { AgentInformation } from '@/domains/agents/agent-information';
import { AgentSidebar } from '@/domains/agents/agent-sidebar';
import { AgentTraces } from '@/domains/agents/agent-traces';
import { TraceProvider } from '@/domains/traces/context/trace-context';
import { useAgent } from '@/hooks/use-agents';
import { useMemory, useMessages } from '@/hooks/use-memory';
import { Message } from '@/types';

function Agent() {
  const { agentId, threadId } = useParams();
  const isEvalsPage = useMatch(`/agents/${agentId}/evals`);
  const isChatPage = useMatch(`/agents/${agentId}`);
  const isTracesPage = useMatch(`/agents/${agentId}/traces`);
  const navigate = useNavigate();
  const { agent, isLoading: isAgentLoading } = useAgent(agentId!);
  const { memory } = useMemory(agentId);
  const { messages, isLoading: isMessagesLoading } = useMessages({
    agentId: agentId!,
    threadId: threadId!,
    memory: !!memory?.result,
  });
  const [sidebar, setSidebar] = useState(true);

  if (isAgentLoading) {
    return (
      <div className="flex flex-col h-full overflow-hidden">
        <Header title={<Skeleton className="h-6 w-[200px]" />} />
        <main className="flex-1 relative grid grid-cols-[1fr_400px] divide-x">
          <div className="p-4">
            <Skeleton className="h-[600px]" />
          </div>
          <div className="p-4">
            <Skeleton className="h-[600px]" />
          </div>
          <div className="flex flex-col">
            <AgentInformation agentId={agentId!} />
          </div>
        </main>
      </div>
    );
  }

  const breadcrumbItems = [
    {
      label: 'Agents',
      href: '/agents',
    },
    {
      label: agent?.name,
      href: `/agents/${agentId}`,
      isCurrent: true,
    },
  ];

  return (
    <TraceProvider>
      <div className="flex flex-col h-full overflow-hidden">
        <Header title={<Breadcrumb items={breadcrumbItems} />}>
          <Button
            variant={isChatPage ? 'primary' : 'outline'}
            size="slim"
            onClick={() => navigate(`/agents/${agentId}`)}
          >
            Chat
          </Button>
          <Button
            variant={isTracesPage ? 'primary' : 'outline'}
            size="slim"
            onClick={() => navigate(`/agents/${agentId}/traces`)}
          >
            Traces
          </Button>
          <Button
            variant={isEvalsPage ? 'primary' : 'outline'}
            size="slim"
            onClick={() => navigate(`/agents/${agentId}/evals`)}
          >
            Evals
          </Button>
        </Header>
        {isTracesPage ? (
          <AgentTraces agentId={agentId!} agentName={agent?.name!} />
        ) : isEvalsPage ? (
          <main className="flex-1">
            <AgentEvals agentId={agentId!} />
          </main>
        ) : (
          <main
            className={cn(
              'flex-1 relative grid divide-x',
              sidebar && memory?.result
                ? 'grid-cols-[256px_1fr_400px] overflow-y-hidden h-full'
                : 'grid-cols-[1fr_400px]',
            )}
          >
            {sidebar && memory?.result ? <AgentSidebar agentId={agentId!} threadId={threadId!} /> : null}
            <div className="relative">
              {memory?.result ? (
                <Button
                  variant="primary"
                  size="icon"
                  className="absolute top-4 left-4 z-50"
                  onClick={() => setSidebar(!sidebar)}
                >
                  <PanelLeft />
                </Button>
              ) : null}
              <Chat
                agentId={agentId!}
                agentName={agent?.name}
                threadId={threadId!}
                initialMessages={isMessagesLoading ? undefined : (messages as Message[])}
                memory={memory?.result}
              />
            </div>
            <div className="flex flex-col">
              <AgentInformation agentId={agentId!} />
            </div>
          </main>
        )}
      </div>
    </TraceProvider>
  );
}

export default Agent;

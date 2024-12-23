import { PanelLeft } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router';

import { Chat } from '@/components/Chat';
import Breadcrumb from '@/components/ui/breadcrumbs';
import { Button } from '@/components/ui/button';
import { Header } from '@/components/ui/header';
import { Skeleton } from '@/components/ui/skeleton';

import { cn } from '@/lib/utils';

import { AgentInformation } from '@/domains/agents/agent-information';
import { AgentSidebar } from '@/domains/agents/agent-sidebar';
import { useAgent } from '@/hooks/use-agents';
import { useMemory, useMessages } from '@/hooks/use-memory';
import { Message } from '@/types';

function Agent() {
  const { agentId, threadId } = useParams();
  const { agent, isLoading: isAgentLoading } = useAgent(agentId!);
  const { memory } = useMemory();
  const navigate = useNavigate();
  const { messages, isLoading: isMessagesLoading } = useMessages({ threadId: threadId!, memory: !!memory?.result });
  const [sidebar, setSidebar] = useState(true);

  useEffect(() => {
    if (memory?.result && !threadId) {
      navigate(`/agents/${agentId}/${crypto.randomUUID()}`);
    }
  }, [memory?.result, threadId]);

  if (isAgentLoading) {
    return (
      <div className="flex flex-col h-full overflow-hidden">
        <Header title={<Skeleton className="h-6 w-[200px]" />} />
        <main className="flex-1 relative grid grid-cols-[256px_1fr_400px] divide-x">
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
    <div className="flex flex-col h-full overflow-hidden">
      <Header title={<Breadcrumb items={breadcrumbItems} />} />
      <main
        className={cn(
          'flex-1 relative grid divide-x',
          sidebar && memory?.result ? 'grid-cols-[256px_1fr_400px]' : 'grid-cols-[1fr_400px]',
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
    </div>
  );
}

export default Agent;

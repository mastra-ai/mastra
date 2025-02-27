import { AgentChat as Chat } from '@mastra/playground-ui';
// import {Chat}   from "@/components/Chat"
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { v4 as uuid } from '@lukeed/uuid';

import { cn } from '@/lib/utils';

import { AgentInformation } from '@/domains/agents/agent-information';
import { AgentSidebar } from '@/domains/agents/agent-sidebar';
import { useAgent } from '@/hooks/use-agents';
import { useMemory, useMessages, useThreads } from '@/hooks/use-memory';
import type { Message } from '@/types';

function Agent() {
  const { agentId, threadId } = useParams();
  const { agent, isLoading: isAgentLoading } = useAgent(agentId!);
  const { memory } = useMemory(agentId!);
  const navigate = useNavigate();
  const { messages, isLoading: isMessagesLoading } = useMessages({
    agentId: agentId!,
    threadId: threadId!,
    memory: !!memory?.result,
  });
  const [sidebar, setSidebar] = useState(true);
  const {
    threads,
    isLoading: isThreadsLoading,
    mutate: refreshThreads,
  } = useThreads({ resourceid: agentId!, agentId: agentId!, isMemoryEnabled: !!memory?.result });

  useEffect(() => {
    if (memory?.result && !threadId) {
      // use @lukeed/uuid because we don't need a cryptographically secure uuid (this is a debugging local uuid)
      // using crypto.randomUUID() on a domain without https (ex a local domain like local.lan:4111) will cause a TypeError
      navigate(`/agents/${agentId}/chat/${uuid()}`);
    }
  }, [memory?.result, threadId]);

  if (isAgentLoading) {
    return (
      <section className="flex-1 relative grid grid-cols-[1fr_400px] divide-x">
        <div className="flex flex-col">
          <AgentInformation agentId={agentId!} />
        </div>
      </section>
    );
  }

  return (
    <section
      className={cn(
        'relative grid h-full divide-x',
        sidebar && memory?.result ? 'grid-cols-[256px_1fr_400px]' : 'grid-cols-[1fr_400px]',
      )}
    >
      {sidebar && memory?.result ? (
        <AgentSidebar agentId={agentId!} threadId={threadId!} threads={threads} isLoading={isThreadsLoading} />
      ) : null}
      <div className="relative overflow-y-hidden">
        <Chat
          agentId={agentId!}
          agentName={agent?.name}
          threadId={threadId!}
          initialMessages={isMessagesLoading ? undefined : (messages as Message[])}
          memory={memory?.result}
          refreshThreadList={() => {
            refreshThreads();
          }}
        />
      </div>
      <div className="flex flex-col">
        <AgentInformation agentId={agentId!} />
      </div>
    </section>
  );
}

export default Agent;

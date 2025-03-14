import { AgentChat as Chat, MastraResizablePanel } from '@mastra/playground-ui';
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
  const [sidebar, _] = useState(true);
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
    return null;
  }

  return (
    <section
      className={cn(
        'relative h-full divide-x flex',
        // sidebar && memory?.result ? 'grid-cols-[256px_1fr_400px]' : 'grid-cols-[1fr_400px]',
      )}
    >
      {sidebar && memory?.result ? (
        <div className="h-full w-[256px]">
          <AgentSidebar agentId={agentId!} threadId={threadId!} threads={threads} isLoading={isThreadsLoading} />
        </div>
      ) : null}
      <div
        className={cn(
          'relative overflow-y-hidden',
          sidebar && memory?.result ? 'w-[calc(100%_-_656px)]' : 'w-[calc(100%_-_400px)]',
        )}
      >
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
      <MastraResizablePanel
        defaultWidth={30}
        minimumWidth={30}
        maximumWidth={50}
        className="flex flex-col min-w-[400px] absolute right-0 top-0 h-full z-20 bg-[#121212]"
      >
        <AgentInformation agentId={agentId!} />
      </MastraResizablePanel>
    </section>
  );
}

export default Agent;

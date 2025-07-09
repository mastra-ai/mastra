import { AgentChat as Chat, MainContentContent, AgentSettingsProvider } from '@mastra/playground-ui';
import { useEffect } from 'react';
import { useNavigate, useParams } from 'react-router';
import { v4 as uuid } from '@lukeed/uuid';

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

  const withSidebar = Boolean(memory?.result);

  return (
    <AgentSettingsProvider agentId={agentId!}>
      <MainContentContent isDivided={true} hasLeftServiceColumn={withSidebar}>
        {withSidebar && (
          <AgentSidebar agentId={agentId!} threadId={threadId!} threads={threads} isLoading={isThreadsLoading} />
        )}

        <div className="grid overflow-y-auto relative bg-surface1 py-4">
          <Chat
            agentId={agentId!}
            agentName={agent?.name}
            threadId={threadId!}
            initialMessages={isMessagesLoading ? undefined : (messages as Message[])}
            memory={memory?.result}
            refreshThreadList={refreshThreads}
          />
        </div>

        <AgentInformation agentId={agentId!} />
      </MainContentContent>
    </AgentSettingsProvider>
  );
}

export default Agent;

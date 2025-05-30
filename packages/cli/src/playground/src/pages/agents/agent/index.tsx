import { AgentProvider, AgentChat as Chat, MastraResizablePanel } from '@mastra/playground-ui';
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { v4 as uuid } from '@lukeed/uuid';

import { cn } from '@/lib/utils';

import { AgentInformation } from '@/domains/agents/agent-information';
import { AgentSidebar } from '@/domains/agents/agent-sidebar';
import { useAgent } from '@/hooks/use-agents';
import { useMemory, useMessages, useThreads } from '@/hooks/use-memory';
import type { Message } from '@/types';
import { useFeatureFlagEnabled } from 'posthog-js/react';

function Agent() {
  const isCliShowMultiModal = useFeatureFlagEnabled('cli_ShowMultiModal');

  const { agentId, threadId } = useParams();
  const { agent, isLoading: isAgentLoading } = useAgent(agentId!);
  const { memory } = useMemory(agentId!);
  const navigate = useNavigate();
  const { messages, isLoading: isMessagesLoading } = useMessages({
    agentId: agentId!,
    threadId: threadId!,
    memory: !!memory?.result,
  });
  const [sidebar] = useState(true);
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
    <AgentProvider
      agentId={agentId!}
      defaultGenerateOptions={agent?.defaultGenerateOptions}
      defaultStreamOptions={agent?.defaultStreamOptions}
    >
      {/* <section className={cn('relative h-[calc(100%-40px)] flex w-full')}> */}
      <div className="grid grid-cols-[auto_1fr_1fr] h-full overflow-x-auto min-w-[min-content]" style={{}}>
        {Boolean(sidebar && memory?.result) && (
          <AgentSidebar agentId={agentId!} threadId={threadId!} threads={threads} isLoading={isThreadsLoading} />
        )}

        {/* <div>Chat</div> */}
        {/* <div className={cn('relative overflow-y-hidden grow min-w-[325px] h-full')}> */}
        <Chat
          agentId={agentId!}
          agentName={agent?.name}
          threadId={threadId!}
          initialMessages={isMessagesLoading ? undefined : (messages as Message[])}
          memory={memory?.result}
          refreshThreadList={refreshThreads}
          showFileSupport={isCliShowMultiModal}
        />

        <AgentInformation agentId={agentId!} />
        {/* <MastraResizablePanel
          defaultWidth={30}
          minimumWidth={30}
          maximumWidth={60}
          className="flex flex-col min-w-[325px] right-0 top-0 h-full z-20 bg-surface2 [&>div:first-child]:-left-[1px] [&>div:first-child]:-right-[1px] [&>div:first-child]:w-[1px] [&>div:first-child]:bg-[#424242] [&>div:first-child]:hover:w-[2px] [&>div:first-child]:active:w-[2px]"
        >
          <AgentInformation agentId={agentId!} />
        </MastraResizablePanel> */}
      </div>
    </AgentProvider>
  );
}

export default Agent;

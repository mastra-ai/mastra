import {
  AgentChat,
  MainContentContent,
  AgentSettingsProvider,
  WorkingMemoryProvider,
  ThreadInputProvider,
  useAgent,
  useMemory,
  useThreads,
  AgentInformation,
} from '@mastra/playground-ui';
import { useEffect } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router';
import { v4 as uuid } from '@lukeed/uuid';

import { AgentSidebar } from '@/domains/agents/agent-sidebar';

function Agent() {
  const { agentId, threadId } = useParams();
  const [searchParams] = useSearchParams();
  const { data: agent, isLoading: isAgentLoading } = useAgent(agentId!);
  const { data: memory } = useMemory(agentId!);
  const navigate = useNavigate();
  const {
    data: threads,
    isLoading: isThreadsLoading,
    refetch: refreshThreads,
  } = useThreads({ resourceId: agentId!, agentId: agentId!, isMemoryEnabled: !!memory?.result });

  useEffect(() => {
    if (memory?.result && (!threadId || threadId === 'new')) {
      // use @lukeed/uuid because we don't need a cryptographically secure uuid (this is a debugging local uuid)
      // using crypto.randomUUID() on a domain without https (ex a local domain like local.lan:4111) will cause a TypeError
      navigate(`/agents/${agentId}/chat/${uuid()}`);
    }
  }, [memory?.result, threadId]);

  const messageId = searchParams.get('messageId') ?? undefined;

  if (isAgentLoading) {
    return null;
  }

  const withSidebar = Boolean(memory?.result);

  return (
    <AgentSettingsProvider agentId={agentId!}>
      <WorkingMemoryProvider agentId={agentId!} threadId={threadId!} resourceId={agentId!}>
        <ThreadInputProvider>
          <MainContentContent isDivided={true} hasLeftServiceColumn={withSidebar}>
            {withSidebar && (
              <AgentSidebar
                agentId={agentId!}
                threadId={threadId!}
                threads={threads || []}
                isLoading={isThreadsLoading}
              />
            )}

            <div className="grid overflow-y-auto relative bg-surface1 py-4">
              <AgentChat
                agentId={agentId!}
                agentName={agent?.name}
                modelVersion={agent?.modelVersion}
                threadId={threadId!}
                memory={memory?.result}
                refreshThreadList={refreshThreads}
                modelList={agent?.modelList}
                messageId={messageId}
              />
            </div>

            <AgentInformation agentId={agentId!} />
          </MainContentContent>
        </ThreadInputProvider>
      </WorkingMemoryProvider>
    </AgentSettingsProvider>
  );
}

export default Agent;

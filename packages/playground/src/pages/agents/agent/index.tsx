import {
  AgentChat,
  AgentLayout,
  AgentSettingsProvider,
  WorkingMemoryProvider,
  ThreadInputProvider,
  useAgent,
  useMemory,
  useThreads,
  AgentInformation,
  AgentPromptExperimentProvider,
  TracingSettingsProvider,
  ObservationalMemoryProvider,
  type AgentSettingsType,
} from '@mastra/playground-ui';
import { useEffect, useMemo } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router';
import { v4 as uuid } from '@lukeed/uuid';

import { AgentSidebar } from '@/domains/agents/agent-sidebar';

function Agent() {
  const { agentId, threadId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const { data: agent, isLoading: isAgentLoading } = useAgent(agentId!);
  const { data: memory } = useMemory(agentId!);
  const navigate = useNavigate();
  const isNewThread = searchParams.get('new') === 'true';
  const {
    data: threads,
    isLoading: isThreadsLoading,
    refetch: refreshThreads,
  } = useThreads({ resourceId: agentId!, agentId: agentId!, isMemoryEnabled: !!memory?.result });

  useEffect(() => {
    if (memory?.result && !threadId) {
      // use @lukeed/uuid because we don't need a cryptographically secure uuid (this is a debugging local uuid)
      // using crypto.randomUUID() on a domain without https (ex a local domain like local.lan:4111) will cause a TypeError
      navigate(`/agents/${agentId}/chat/${uuid()}?new=true`);
    }
  }, [memory?.result, threadId]);

  const messageId = searchParams.get('messageId') ?? undefined;

  const defaultSettings = useMemo((): AgentSettingsType => {
    if (!agent) {
      return { modelSettings: {} };
    }

    const agentDefaultOptions = agent.defaultOptions as
      | {
          maxSteps?: number;
          modelSettings?: Record<string, unknown>;
          providerOptions?: AgentSettingsType['modelSettings']['providerOptions'];
        }
      | undefined;

    // Map AI SDK v5 names back to UI names (maxOutputTokens -> maxTokens)
    const { maxOutputTokens, ...restModelSettings } = (agentDefaultOptions?.modelSettings ?? {}) as {
      maxOutputTokens?: number;
      [key: string]: unknown;
    };

    return {
      modelSettings: {
        ...(restModelSettings as AgentSettingsType['modelSettings']),
        // Only include properties if they have actual values (to not override fallback defaults)
        ...(maxOutputTokens !== undefined && { maxTokens: maxOutputTokens }),
        ...(agentDefaultOptions?.maxSteps !== undefined && { maxSteps: agentDefaultOptions.maxSteps }),
        ...(agentDefaultOptions?.providerOptions !== undefined && {
          providerOptions: agentDefaultOptions.providerOptions,
        }),
      },
    };
  }, [agent]);

  if (isAgentLoading) {
    return null;
  }

  const handleRefreshThreadList = () => {
    searchParams.delete('new');
    setSearchParams(searchParams);
    refreshThreads();
  };

  return (
    <TracingSettingsProvider entityId={agentId!} entityType="agent">
      <AgentPromptExperimentProvider initialPrompt={agent!.instructions} agentId={agentId!}>
        <AgentSettingsProvider agentId={agentId!} defaultSettings={defaultSettings}>
          <WorkingMemoryProvider agentId={agentId!} threadId={threadId!} resourceId={agentId!}>
            <ThreadInputProvider>
              <ObservationalMemoryProvider>
                <AgentLayout
                  agentId={agentId!}
                  leftSlot={
                    Boolean(memory?.result) && (
                      <AgentSidebar
                        agentId={agentId!}
                        threadId={threadId!}
                        threads={threads || []}
                        isLoading={isThreadsLoading}
                      />
                    )
                  }
                  rightSlot={<AgentInformation agentId={agentId!} threadId={threadId!} />}
                >
                  <AgentChat
                    key={threadId}
                    agentId={agentId!}
                    agentName={agent?.name}
                    modelVersion={agent?.modelVersion}
                    threadId={threadId}
                    memory={memory?.result}
                    refreshThreadList={handleRefreshThreadList}
                    modelList={agent?.modelList}
                    messageId={messageId}
                    isNewThread={isNewThread}
                  />
                </AgentLayout>
              </ObservationalMemoryProvider>
            </ThreadInputProvider>
          </WorkingMemoryProvider>
        </AgentSettingsProvider>
      </AgentPromptExperimentProvider>
    </TracingSettingsProvider>
  );
}

export default Agent;

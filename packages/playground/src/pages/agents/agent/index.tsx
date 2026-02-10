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
  ActivatedSkillsProvider,
  SchemaRequestContextProvider,
  type AgentSettingsType,
} from '@mastra/playground-ui';
import { useEffect, useMemo, useState } from 'react';
import { v4 as uuid } from '@lukeed/uuid';
import { useNavigate, useParams, useSearchParams } from 'react-router';

import { AgentSidebar } from '@/domains/agents/agent-sidebar';

function Agent() {
  const { agentId, threadId } = useParams();
  const [searchParams] = useSearchParams();
  const { data: agent, isLoading: isAgentLoading } = useAgent(agentId!);
  const { data: memory } = useMemory(agentId!);
  const navigate = useNavigate();
  const isNewThread = threadId === 'new';
  const [newThreadId, setNewThreadId] = useState<string>(() => uuid());

  const hasMemory = Boolean(memory?.result);

  const {
    data: threads,
    isLoading: isThreadsLoading,
    refetch: refreshThreads,
  } = useThreads({ resourceId: agentId!, agentId: agentId!, isMemoryEnabled: hasMemory });

  useEffect(() => {
    if (!hasMemory) return;
    if (threadId) return;

    // After redirects on /agents/:agentId
    navigate(`/agents/${agentId}/chat/new`);
  }, [hasMemory, threadId, agentId, navigate]);

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

  if (isAgentLoading || !agent) {
    return null;
  }

  if (!agent) {
    return <div className="text-center py-4">Agent not found</div>;
  }

  const actualThreadId = isNewThread ? newThreadId : threadId;

  const handleRefreshThreadList = async () => {
    await refreshThreads();

    if (isNewThread) {
      setNewThreadId(() => uuid());
      navigate(`/agents/${agentId}/chat/${newThreadId}`);
    }
  };

  return (
    <TracingSettingsProvider entityId={agentId!} entityType="agent">
      <AgentPromptExperimentProvider initialPrompt={agent!.instructions} agentId={agentId!}>
        <AgentSettingsProvider agentId={agentId!} defaultSettings={defaultSettings}>
          <SchemaRequestContextProvider>
            <WorkingMemoryProvider agentId={agentId!} threadId={actualThreadId!} resourceId={agentId!}>
              <ThreadInputProvider>
                <ObservationalMemoryProvider>
                  <ActivatedSkillsProvider>
                    <AgentLayout
                      agentId={agentId!}
                      leftSlot={
                        hasMemory && (
                          <AgentSidebar
                            agentId={agentId!}
                            threadId={actualThreadId!}
                            threads={threads || []}
                            isLoading={isThreadsLoading}
                          />
                        )
                      }
                      rightSlot={<AgentInformation agentId={agentId!} threadId={threadId!} />}
                    >
                      <AgentChat
                        agentId={agentId!}
                        agentName={agent?.name}
                        modelVersion={agent?.modelVersion}
                        threadId={actualThreadId!}
                        memory={hasMemory}
                        refreshThreadList={handleRefreshThreadList}
                        modelList={agent?.modelList}
                        messageId={messageId}
                        isNewThread={isNewThread}
                      />
                    </AgentLayout>
                  </ActivatedSkillsProvider>
                </ObservationalMemoryProvider>
              </ThreadInputProvider>
            </WorkingMemoryProvider>
          </SchemaRequestContextProvider>
        </AgentSettingsProvider>
      </AgentPromptExperimentProvider>
    </TracingSettingsProvider>
  );
}

export default Agent;

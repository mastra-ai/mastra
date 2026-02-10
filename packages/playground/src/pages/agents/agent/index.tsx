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
import { useNavigate, useParams, useSearchParams } from 'react-router';
import { v4 as uuid } from '@lukeed/uuid';
import type { StorageThreadType } from '@mastra/core/memory';

import { AgentSidebar } from '@/domains/agents/agent-sidebar';

function Agent() {
  const { agentId, threadId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const { data: agent, isLoading: isAgentLoading } = useAgent(agentId!);
  const { data: memory } = useMemory(agentId!);
  const navigate = useNavigate();
  const isNewThread = searchParams.get('new') === 'true';
  const [selectedResourceId, setSelectedResourceId] = useState<string>(() => {
    const stored = localStorage.getItem(`mastra-agent-resource-${agentId}`);
    return stored || agentId!;
  });

  const [resourceHistory, setResourceHistory] = useState<string[]>(() => {
    if (!agentId) return [];
    try {
      const raw = localStorage.getItem(`mastra-agent-resource-history-${agentId}`);
      const parsed = raw ? (JSON.parse(raw) as unknown) : [];
      return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : [];
    } catch {
      return [];
    }
  });

  // React Router may keep this page mounted while switching agents.
  // Reload persisted resource selection + history whenever agentId changes.
  useEffect(() => {
    if (!agentId) return;

    const stored = localStorage.getItem(`mastra-agent-resource-${agentId}`);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSelectedResourceId(stored || agentId);

    try {
      const raw = localStorage.getItem(`mastra-agent-resource-history-${agentId}`);
      const parsed = raw ? (JSON.parse(raw) as unknown) : [];
      setResourceHistory(Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : []);
    } catch {
      setResourceHistory([]);
    }
  }, [agentId]);

  const {
    data: threads,
    isLoading: isThreadsLoading,
    refetch: refreshThreads,
  } = useThreads({ resourceId: selectedResourceId, agentId: agentId!, isMemoryEnabled: !!memory?.result });

  const { data: allThreads } = useThreads({ agentId: agentId!, isMemoryEnabled: !!memory?.result });

  useEffect(() => {
    if (!agentId || !allThreads) return;

    const existingResourceIds = new Set<string>([agentId, selectedResourceId]);
    for (const t of allThreads as StorageThreadType[]) {
      existingResourceIds.add(t.resourceId);
    }

    // eslint-disable-next-line react-hooks/set-state-in-effect
    setResourceHistory(prev => {
      const cleaned = prev.filter(id => existingResourceIds.has(id));
      if (cleaned.length !== prev.length) {
        try {
          localStorage.setItem(`mastra-agent-resource-history-${agentId}`, JSON.stringify(cleaned));
        } catch {
          // ignore localStorage failures
        }
      }
      return cleaned.length !== prev.length ? cleaned : prev;
    });
  }, [agentId, allThreads, selectedResourceId]);

  const availableResourceIds = useMemo<string[]>(() => {
    const ids = new Set<string>();

    // Always include the currently selected resourceId so it shows up in the selector
    // even if the backend can't enumerate all resourceIds.
    if (selectedResourceId && selectedResourceId !== agentId) {
      ids.add(selectedResourceId);
    }

    // Include previously used resourceIds (localStorage history)
    for (const id of resourceHistory) {
      if (id && id !== agentId) ids.add(id);
    }

    // Best-effort discovery from all threads (when supported by server)
    if (allThreads) {
      for (const t of allThreads as StorageThreadType[]) {
        if (t.resourceId !== agentId) ids.add(t.resourceId);
      }
    }

    return Array.from(ids);
  }, [allThreads, agentId, resourceHistory, selectedResourceId]);

  const handleResourceIdChange = (newResourceId: string) => {
    if (!agentId) return;

    const next = newResourceId.trim();
    if (!next) return;

    setSelectedResourceId(next);
    localStorage.setItem(`mastra-agent-resource-${agentId}`, next);

    setResourceHistory(prev => {
      const deduped = [next, ...prev.filter(x => x !== next)].filter(x => x && x !== agentId);
      const capped = deduped.slice(0, 20);
      try {
        localStorage.setItem(`mastra-agent-resource-history-${agentId}`, JSON.stringify(capped));
      } catch {
        // ignore localStorage failures
      }
      return capped;
    });

    navigate(`/agents/${agentId}/chat/${uuid()}?new=true`);
  };

  useEffect(() => {
    if (memory?.result && !threadId) {
      // use @lukeed/uuid because we don't need a cryptographically secure uuid (this is a debugging local uuid)
      // using crypto.randomUUID() on a domain without https (ex a local domain like local.lan:4111) will cause a TypeError
      navigate(`/agents/${agentId}/chat/${uuid()}?new=true`);
    }
  }, [memory?.result, threadId, agentId, navigate]);

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

  const handleRefreshThreadList = () => {
    // Create a new URLSearchParams to avoid mutation issues
    const newParams = new URLSearchParams(searchParams);
    newParams.delete('new');
    setSearchParams(newParams, { replace: true });
    refreshThreads();
  };

  return (
    <TracingSettingsProvider entityId={agentId!} entityType="agent">
      <AgentPromptExperimentProvider initialPrompt={agent!.instructions} agentId={agentId!}>
        <AgentSettingsProvider agentId={agentId!} defaultSettings={defaultSettings}>
          <SchemaRequestContextProvider>
            <WorkingMemoryProvider
              agentId={agentId!}
              threadId={isNewThread ? '' : threadId!}
              resourceId={selectedResourceId}
            >
              <ThreadInputProvider>
                <ObservationalMemoryProvider>
                  <ActivatedSkillsProvider>
                    <AgentLayout
                      agentId={agentId!}
                      leftSlot={
                        Boolean(memory?.result) && (
                          <AgentSidebar
                            agentId={agentId!}
                            threadId={threadId!}
                            threads={threads || []}
                            isLoading={isThreadsLoading}
                            resourceId={selectedResourceId}
                            onResourceIdChange={handleResourceIdChange}
                            availableResourceIds={availableResourceIds}
                          />
                        )
                      }
                      rightSlot={
                        <AgentInformation
                          agentId={agentId!}
                          threadId={isNewThread ? '' : threadId!}
                          resourceId={selectedResourceId}
                        />
                      }
                    >
                      <AgentChat
                        key={`${threadId}-${selectedResourceId}`}
                        agentId={agentId!}
                        resourceId={selectedResourceId}
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

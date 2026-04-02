import { AgentWorkingMemory } from './agent-working-memory';
import { AgentMemoryConfig } from './agent-memory-config';
import { AgentObservationalMemory } from './agent-observational-memory';
import { useCallback } from 'react';
import { cn } from '@/lib/utils';
import { useLinkComponent } from '@/lib/framework';
import { useThreadInput } from '@/domains/conversation';
import { useMemoryConfig, useMemorySearch, useMemoryWithOMStatus, useThread } from '@/domains/memory/hooks';
import { MemorySearch } from '@/lib/ai-ui/memory-search';
import { Skeleton } from '@/ds/components/Skeleton';

interface AgentMemoryProps {
  agentId: string;
  threadId: string;
}

export function AgentMemory({ agentId, threadId }: AgentMemoryProps) {
  const { threadInput: chatInputValue } = useThreadInput();

  const { paths, navigate } = useLinkComponent();

  const { data: thread } = useThread({ threadId, agentId });
  const effectiveResourceId = thread?.resourceId ?? agentId;

  const { data, isLoading: isConfigLoading } = useMemoryConfig(agentId);

  const config = data?.config;
  const isSemanticRecallEnabled = Boolean(config?.semanticRecall);
  const isWorkingMemoryEnabled = Boolean(config?.workingMemory?.enabled);

  const { data: omStatus } = useMemoryWithOMStatus({
    agentId,
    resourceId: effectiveResourceId,
    threadId,
  });
  const isOMEnabled = omStatus?.observationalMemory?.enabled ?? false;

  const { mutateAsync: searchMemory, data: searchMemoryData } = useMemorySearch({
    agentId: agentId || '',
    resourceId: effectiveResourceId || '',
    threadId,
  });

  const handleResultClick = useCallback(
    (messageId: string, resultThreadId?: string) => {
      if (resultThreadId && resultThreadId !== threadId) {
        navigate(paths.agentThreadLink(agentId, resultThreadId, messageId));
      } else {
        const messageElement = document.querySelector(`[data-message-id="${messageId}"]`);
        if (messageElement) {
          messageElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
          messageElement.classList.add('bg-surface4');
          setTimeout(() => {
            messageElement.classList.remove('bg-surface4');
          }, 2000);
        }
      }
    },
    [agentId, threadId, navigate],
  );

  const searchScope = searchMemoryData?.searchScope;

  if (isConfigLoading) {
    return (
      <div className="flex flex-col h-full p-4 gap-4">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full min-w-0 overflow-y-auto">
      <div className="border-b border-border1">
        <AgentMemoryConfig agentId={agentId} />
      </div>

      {isOMEnabled && (
        <div className="border-b border-border1 min-w-0 overflow-hidden">
          <AgentObservationalMemory agentId={agentId} resourceId={effectiveResourceId} threadId={threadId} />
        </div>
      )}

      {isSemanticRecallEnabled && (
        <div className="p-4 border-b border-border1">
          <div className="mb-2">
            <div className="flex items-center gap-2 mb-2">
              <h3 className="text-sm font-medium text-neutral5">Semantic Recall</h3>
              {searchMemoryData?.searchScope && (
                <span
                  className={cn(
                    'text-xs font-medium px-2 py-0.5 rounded',
                    searchScope === 'resource' ? 'bg-purple-500/20 text-purple-400' : 'bg-blue-500/20 text-blue-400',
                  )}
                  title={
                    searchScope === 'resource' ? 'Searching across all threads' : 'Searching within current thread only'
                  }
                >
                  {searchScope}
                </span>
              )}
            </div>
          </div>
          <MemorySearch
            searchMemory={query => searchMemory({ searchQuery: query, memoryConfig: { lastMessages: 0 } })}
            onResultClick={handleResultClick}
            currentThreadId={threadId}
            className="w-full"
            chatInputValue={chatInputValue}
          />
        </div>
      )}

      {isWorkingMemoryEnabled && <AgentWorkingMemory agentId={agentId} />}
    </div>
  );
}

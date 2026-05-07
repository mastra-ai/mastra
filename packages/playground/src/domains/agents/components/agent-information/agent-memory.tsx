import { Button, Skeleton, cn } from '@mastra/playground-ui';
import { ExternalLink, Copy } from 'lucide-react';
import { useCallback } from 'react';
import { AgentMemoryConfig } from './agent-memory-config';
import { AgentObservationalMemory } from './agent-observational-memory';
import { AgentWorkingMemory } from './agent-working-memory';
import { useThreadInput } from '@/domains/conversation';
import {
  useMemoryConfig,
  useMemorySearch,
  useMemoryWithOMStatus,
  useThread,
} from '@/domains/memory/hooks';
import { MemorySearch } from '@/lib/ai-ui/memory-search';
import { useLinkComponent } from '@/lib/framework';

interface AgentMemoryProps {
  agentId: string;
  threadId: string;
  memoryType?: 'local' | 'gateway';
}

export function AgentMemory({ agentId, threadId, memoryType }: AgentMemoryProps) {
  const isGatewayMemory = memoryType === 'gateway';
  const { threadInput: chatInputValue } = useThreadInput();

  const { paths, navigate } = useLinkComponent();

  // Resolve the thread's actual resourceId (may differ from agentId for externally-created threads)
  const { data: thread } = useThread({ threadId, agentId });
  const effectiveResourceId = thread?.resourceId ?? agentId;

  // Get memory config to check if semantic recall is enabled
  const { data, isLoading: isConfigLoading } = useMemoryConfig(agentId);

  // Check if semantic recall is enabled
  const config = data?.config;
  const isSemanticRecallEnabled = Boolean(config?.semanticRecall);
  const isWorkingMemoryEnabled = Boolean(config?.workingMemory?.enabled);

  // Check if observational memory is enabled
  const { data: omStatus } = useMemoryWithOMStatus({
    agentId,
    resourceId: effectiveResourceId,
    threadId,
  });
  const isOMEnabled = omStatus?.observationalMemory?.enabled ?? false;

  // Get memory search hook
  const { mutateAsync: searchMemory, data: searchMemoryData } = useMemorySearch({
    agentId: agentId || '',
    resourceId: effectiveResourceId || '',
    threadId,
  });

  // Handle clicking on a search result to scroll to the message
  const handleResultClick = useCallback(
    (messageId: string, resultThreadId?: string) => {
      // If the result is from a different thread, navigate to that thread with message ID
      if (resultThreadId && resultThreadId !== threadId) {
        navigate(paths.agentThreadLink(agentId, resultThreadId, messageId));
      } else {
        // Find the message element by id and scroll to it
        const messageElement = document.querySelector(`[data-message-id="${messageId}"]`);
        if (messageElement) {
          messageElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
          // Optionally highlight the message
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
    <div className="flex flex-col h-full min-w-0 overflow-y-auto bg-surface2">
      {/* Memory Configuration at top */}
      <div className="border-b border-border1">
        <AgentMemoryConfig agentId={agentId} />
      </div>

      {/* Observational Memory Section */}
      {isOMEnabled && (
        <div className="border-b border-border1 min-w-0 overflow-hidden">
          <AgentObservationalMemory agentId={agentId} resourceId={effectiveResourceId} threadId={threadId} />
        </div>
      )}

      {/* Semantic Recall Section - only if enabled, hidden for gateway memory */}
      {isSemanticRecallEnabled && !isGatewayMemory && (
        <div className="p-4 border-b border-border1 overflow-hidden flex flex-col max-h-80">
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

      {/* Working Memory - only if enabled, hidden for gateway memory */}
      {isWorkingMemoryEnabled && !isGatewayMemory && <AgentWorkingMemory agentId={agentId} />}

      {/* Gateway Memory indicator */}
      {isGatewayMemory && (
        <div className="p-4 border-b border-border1">
          <div className="bg-surface3 border border-border1 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-medium px-2 py-0.5 rounded bg-green-500/20 text-green-400">Gateway</span>
              <h3 className="text-sm font-medium text-neutral5">Memory Gateway</h3>
            </div>
            <p className="text-xs text-neutral3">
              Memory is managed by the Memory Gateway. Threads and observations are stored remotely.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

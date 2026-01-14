import { AgentWorkingMemory } from './agent-working-memory';
import { AgentMemoryConfig } from './agent-memory-config';
import { useCallback } from 'react';
import { cn } from '@/lib/utils';
import { ExternalLink, Copy } from 'lucide-react';
import { useLinkComponent } from '@/lib/framework';
import { useThreadInput } from '@/domains/conversation';
import { useMemoryConfig, useMemorySearch, useCloneThread } from '@/domains/memory/hooks';
import { MemorySearch } from '@/lib/ai-ui/memory-search';
import { Button } from '@/ds/components/Button/Button';
import { Skeleton } from '@/ds/components/Skeleton';

interface AgentMemoryProps {
  agentId: string;
  threadId: string;
}

export function AgentMemory({ agentId, threadId }: AgentMemoryProps) {
  const { threadInput: chatInputValue } = useThreadInput();

  const { paths, navigate } = useLinkComponent();

  // Get memory config to check if semantic recall is enabled
  const { data, isLoading: isConfigLoading } = useMemoryConfig(agentId);

  // Check if semantic recall is enabled
  const config = data?.config;
  const isSemanticRecallEnabled = Boolean(config?.semanticRecall);

  // Get memory search hook
  const { mutateAsync: searchMemory, data: searchMemoryData } = useMemorySearch({
    agentId: agentId || '',
    resourceId: agentId || '', // In playground, agentId is the resourceId
    threadId,
  });

  // Get clone thread hook
  const { mutateAsync: cloneThread, isPending: isCloning } = useCloneThread();

  // Handle cloning the current thread
  const handleCloneThread = useCallback(async () => {
    if (!threadId || !agentId) return;

    const result = await cloneThread({ threadId, agentId });
    // Navigate to the cloned thread
    if (result?.thread?.id) {
      navigate(paths.agentThreadLink(agentId, result.thread.id));
    }
  }, [threadId, agentId, cloneThread, navigate, paths]);

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
    <div className="flex flex-col h-full">
      {/* Clone Thread Section */}
      {threadId && (
        <div className="p-4 border-b border-border1">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-medium text-icon5">Clone Thread</h3>
              <p className="text-xs text-icon3 mt-1">Create a copy of this conversation</p>
            </div>
            <Button onClick={handleCloneThread} disabled={isCloning}>
              <Copy className="w-4 h-4 mr-2" />
              {isCloning ? 'Cloning...' : 'Clone'}
            </Button>
          </div>
        </div>
      )}

      {/* Memory Search Section */}
      <div className="p-4 border-b border-border1">
        <div className="mb-2">
          <div className="flex items-center gap-2 mb-2">
            <h3 className="text-sm font-medium text-icon5">Semantic Recall</h3>
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
        {isSemanticRecallEnabled ? (
          <MemorySearch
            searchMemory={query => searchMemory({ searchQuery: query, memoryConfig: { lastMessages: 0 } })}
            onResultClick={handleResultClick}
            currentThreadId={threadId}
            className="w-full"
            chatInputValue={chatInputValue}
          />
        ) : (
          <div className="bg-surface3 border border-border1 rounded-lg p-4">
            <p className="text-sm text-icon3 mb-3">
              Semantic recall is not enabled for this agent. Enable it to search through conversation history.
            </p>
            <a
              href="https://mastra.ai/en/docs/memory/semantic-recall"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-sm text-blue-400 hover:text-blue-300 transition-colors"
            >
              Learn about semantic recall
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        )}
      </div>

      {/* Working Memory Section */}
      <div className="flex-1 overflow-y-auto">
        <AgentWorkingMemory agentId={agentId} />
        <div className="border-t border-border1">
          <AgentMemoryConfig agentId={agentId} />
        </div>
      </div>
    </div>
  );
}

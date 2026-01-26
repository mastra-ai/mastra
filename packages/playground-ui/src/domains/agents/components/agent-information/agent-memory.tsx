import { AgentWorkingMemory } from './agent-working-memory';
import { AgentMemoryConfig } from './agent-memory-config';
import { useCallback } from 'react';
import { ExternalLink, Copy } from 'lucide-react';
import { useLinkComponent } from '@/lib/framework';
import { useThreadInput } from '@/domains/conversation';
import { useMemoryConfig, useMemorySearch, useCloneThread } from '@/domains/memory/hooks';
import { MemorySearch } from '@/lib/ai-ui/memory-search';
import { Button } from '@/ds/components/Button/Button';
import { Skeleton } from '@/ds/components/Skeleton';
import { Badge } from '@/ds/components/Badge';
import { Txt } from '@/ds/components/Txt';

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
      <div className="flex flex-col h-full p-4 gap-4" data-testid="memory-tab-loading">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full" data-testid="memory-tab">
      {/* Clone Thread Section */}
      {threadId && (
        <div className="p-4 border-b border-border1" data-testid="clone-thread-section">
          <div className="flex items-center justify-between">
            <div>
              <Txt as="h3" variant="ui-sm" className="font-medium text-neutral5">
                Clone Thread
              </Txt>
              <Txt variant="ui-xs" className="text-neutral3 mt-1">
                Create a copy of this conversation
              </Txt>
            </div>
            <Button onClick={handleCloneThread} disabled={isCloning} data-testid="clone-thread-button">
              <Copy className="w-4 h-4 mr-2" />
              {isCloning ? 'Cloning...' : 'Clone'}
            </Button>
          </div>
        </div>
      )}

      {/* Memory Search Section */}
      <div className="p-4 border-b border-border1" data-testid="semantic-recall-section">
        <div className="mb-2">
          <div className="flex items-center gap-2 mb-2">
            <Txt as="h3" variant="ui-sm" className="font-medium text-neutral5">
              Semantic Recall
            </Txt>
            {searchMemoryData?.searchScope && (
              <Badge
                variant={searchScope === 'resource' ? 'warning' : 'info'}
                data-testid="semantic-recall-scope-badge"
              >
                {searchScope}
              </Badge>
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
          <div className="bg-surface3 border border-border1 rounded-lg p-4" data-testid="semantic-recall-disabled">
            <Txt variant="ui-sm" className="text-neutral3 mb-3">
              Semantic recall is not enabled for this agent. Enable it to search through conversation history.
            </Txt>
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

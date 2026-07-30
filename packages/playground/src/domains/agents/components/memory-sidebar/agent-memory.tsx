import { Button } from '@mastra/playground-ui/components/Button';
import { Skeleton } from '@mastra/playground-ui/components/Skeleton';
import { cn } from '@mastra/playground-ui/utils/cn';
import { ExternalLink, GitFork } from 'lucide-react';
import { useCallback } from 'react';
import { AgentObservationalMemory } from './agent-observational-memory';
import { AgentWorkingMemory } from './agent-working-memory';
import { useThreadInput } from '@/domains/conversation';
import {
  useMemoryConfig,
  useMemorySearch,
  useCloneThread,
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

function getRecentMessagesDescription(lastMessages: number | false | undefined): string {
  if (typeof lastMessages !== 'number') {
    return 'Recent message history is not included in context.';
  }

  const messageLabel = lastMessages === 1 ? 'message' : 'messages';
  return `Includes the last ${lastMessages} ${messageLabel} in context.`;
}

export function AgentMemory({ agentId, threadId, memoryType }: AgentMemoryProps) {
  const isGatewayMemory = memoryType === 'gateway';
  const { threadInput: chatInputValue } = useThreadInput(threadId);

  const { paths, navigate } = useLinkComponent();

  // Resolve the thread's actual resourceId (may differ from agentId for externally-created threads)
  const { data: thread } = useThread({ threadId, agentId });
  const effectiveResourceId = thread?.resourceId ?? agentId;

  // Get memory config to check if semantic recall is enabled
  const { data, isLoading: isConfigLoading } = useMemoryConfig(agentId);

  // Check if semantic recall is enabled
  const config = data?.config;
  const isSemanticRecallEnabled = Boolean(config?.semanticRecall);

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
    [agentId, threadId, navigate, paths],
  );

  const searchScope = searchMemoryData?.searchScope;

  if (isConfigLoading) {
    return (
      <div className="flex h-full flex-col gap-4 p-4">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  return (
    <div className="flex min-w-0 flex-col">
      {/* Clone Thread Section */}
      {threadId && (
        <div className="border-border1 border-b p-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-neutral5 text-sm font-medium">Clone Thread</h3>
              <p className="text-neutral3 mt-1 text-xs">Create a copy of this conversation</p>
            </div>
            <Button onClick={handleCloneThread} disabled={isCloning}>
              <GitFork className="mr-2 h-4 w-4" />
              {isCloning ? 'Cloning...' : 'Clone'}
            </Button>
          </div>
        </div>
      )}

      <div className="border-border1 border-b p-4">
        <h3 className="text-neutral5 text-sm font-medium">Recent Messages</h3>
        <p className="text-neutral3 mt-1 text-xs">{getRecentMessagesDescription(config?.lastMessages)}</p>
      </div>

      {/* Observational Memory Section - moved above Semantic Recall */}
      {isOMEnabled && (
        <div className="border-border1 min-w-0 overflow-hidden border-b">
          <AgentObservationalMemory agentId={agentId} resourceId={effectiveResourceId} threadId={threadId} />
        </div>
      )}

      {/* Memory Search Section - hidden for gateway memory */}
      {!isGatewayMemory && (
        <div className="border-border1 border-b p-4">
          <div className="mb-2">
            <div className="mb-2 flex items-center gap-2">
              <h3 className="text-neutral5 text-sm font-medium">Semantic Recall</h3>
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
            <div className="bg-surface3 border-border1 rounded-lg border p-4">
              <p className="text-neutral3 mb-3 text-sm">
                Semantic recall is not enabled for this agent. Enable it to search through conversation history.
              </p>
              <a
                href="https://mastra.ai/en/docs/memory/semantic-recall"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-sm text-blue-400 transition-colors hover:text-blue-300"
              >
                Learn about semantic recall
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          )}
        </div>
      )}

      {/* Working Memory Section - hidden for gateway memory */}
      {!isGatewayMemory && (
        <div>
          <AgentWorkingMemory agentId={agentId} />
        </div>
      )}

      {/* Gateway Memory indicator */}
      {isGatewayMemory && (
        <div className="border-border1 border-b p-4">
          <div className="bg-surface3 border-border1 rounded-lg border p-4">
            <div className="mb-1 flex items-center gap-2">
              <span className="rounded bg-green-500/20 px-2 py-0.5 text-xs font-medium text-green-400">Remote</span>
              <h3 className="text-neutral5 text-sm font-medium">Gateway</h3>
            </div>
            <p className="text-neutral3 text-xs">
              Memory is managed by the Gateway. Threads and observations are stored remotely.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

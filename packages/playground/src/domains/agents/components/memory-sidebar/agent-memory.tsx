import { Button } from '@mastra/playground-ui/components/Button';
import { Skeleton } from '@mastra/playground-ui/components/Skeleton';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { useEntityRequestContext } from '@mastra/playground-ui/domains/request-context/hooks/use-entity-request-context';
import { useLinkComponent } from '@mastra/playground-ui/lib/framework';
import { raisedSurfaceStyle } from '@mastra/playground-ui/primitives/raised-surface';
import { controlStateColorTransition } from '@mastra/playground-ui/primitives/transitions';
import { cn } from '@mastra/playground-ui/utils/cn';
import { ExternalLink, GitFork } from 'lucide-react';
import { useCallback } from 'react';
import { AgentObservationalMemory } from './agent-observational-memory';
import { AgentWorkingMemory } from './agent-working-memory';
import { getRecentMessagesSettings } from './lib/recent-messages';
import { useThreadInput } from '@/domains/conversation';
import {
  useMemoryConfig,
  useMemorySearch,
  useCloneThread,
  useMemoryWithOMStatus,
  useThread,
} from '@/domains/memory/hooks';
import { MemorySearch } from '@/lib/ai-ui/memory-search';

interface AgentMemoryProps {
  agentId: string;
  threadId: string;
  memoryType?: 'local' | 'gateway';
}

export function AgentMemory({ agentId, threadId, memoryType }: AgentMemoryProps) {
  const isGatewayMemory = memoryType === 'gateway';
  const { threadInput: chatInputValue } = useThreadInput(threadId);

  const { paths, navigate } = useLinkComponent();

  // Resolve the thread's actual resourceId (may differ from agentId for externally-created threads)
  const { data: thread } = useThread({ threadId, agentId }, useEntityRequestContext('agent', agentId)[0]);
  const effectiveResourceId = thread?.resourceId ?? agentId;

  // Get memory config to check if semantic recall is enabled
  const { data, isLoading: isConfigLoading } = useMemoryConfig(agentId, useEntityRequestContext('agent', agentId)[0]);

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
  const { mutateAsync: searchMemory, data: searchMemoryData } = useMemorySearch(
    {
      agentId: agentId || '',
      resourceId: effectiveResourceId || '',
      threadId,
    },
    useEntityRequestContext('agent', agentId)[0],
  );

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
          messageElement.classList.add('bg-muted');
          setTimeout(() => {
            messageElement.classList.remove('bg-muted');
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
        <div className="border-b border-border p-4">
          <div className="flex items-center justify-between">
            <div>
              <Txt as="h3" variant="subheading" tone="ink">
                Clone Thread
              </Txt>
              <Txt variant="caption" tone="muted" className="mt-1">
                Create a copy of this conversation
              </Txt>
            </div>
            <Button onClick={handleCloneThread} disabled={isCloning} icon={<GitFork />}>
              {isCloning ? 'Cloning...' : 'Clone'}
            </Button>
          </div>
        </div>
      )}

      <div className="border-b border-border p-4">
        <Txt as="h3" variant="subheading" tone="ink">
          Recent Messages
        </Txt>
        <Txt variant="caption" tone="muted" className="mt-1">
          {getRecentMessagesSettings(config?.lastMessages, config?.messageHistory).description}
        </Txt>
      </div>

      {/* Observational Memory Section - moved above Semantic Recall */}
      {isOMEnabled && (
        <div className="min-w-0 overflow-hidden border-b border-border">
          <AgentObservationalMemory agentId={agentId} resourceId={effectiveResourceId} threadId={threadId} />
        </div>
      )}

      {/* Memory Search Section - hidden for gateway memory */}
      {!isGatewayMemory && (
        <div className="border-b border-border p-4">
          <div className="mb-2">
            <div className="mb-2 flex items-center gap-2">
              <Txt as="h3" variant="subheading" tone="ink">
                Semantic Recall
              </Txt>
              {searchMemoryData?.searchScope && (
                <Txt
                  as="span"
                  variant="column"
                  className={cn(
                    'rounded px-2 py-0.5',
                    searchScope === 'resource'
                      ? 'bg-badge-purple-strong text-badge-purple-foreground'
                      : 'bg-badge-blue-strong text-badge-blue-foreground',
                  )}
                  title={
                    searchScope === 'resource' ? 'Searching across all threads' : 'Searching within current thread only'
                  }
                >
                  {searchScope}
                </Txt>
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
            <div className={cn(raisedSurfaceStyle, 'rounded-lg p-4')}>
              <Txt tone="muted" className="mb-3">
                Semantic recall is not enabled for this agent. Enable it to search through conversation history.
              </Txt>
              <a
                href="https://mastra.ai/en/docs/memory/semantic-recall"
                target="_blank"
                rel="noopener noreferrer"
                className={cn(
                  'inline-flex items-center gap-2 text-info-indicator hover:underline',
                  controlStateColorTransition,
                )}
              >
                <Txt as="span" variant="body" className="block">
                  Learn about semantic recall
                </Txt>
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
        <div className="border-b border-border p-4">
          <div className={cn(raisedSurfaceStyle, 'rounded-lg p-4')}>
            <div className="mb-1 flex items-center gap-2">
              <Txt
                as="span"
                variant="column"
                className="rounded bg-badge-green-strong px-2 py-0.5 text-badge-green-foreground"
              >
                Remote
              </Txt>
              <Txt as="h3" variant="subheading" tone="ink">
                Gateway
              </Txt>
            </div>
            <Txt variant="caption" tone="muted">
              Memory is managed by the Gateway. Threads and observations are stored remotely.
            </Txt>
          </div>
        </div>
      )}
    </div>
  );
}

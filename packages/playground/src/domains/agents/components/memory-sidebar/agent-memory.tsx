import { Txt } from '@mastra/playground-ui/components/Txt';
import { useAgentThreadInput } from '@mastra/playground-ui/domains/agents/chat';
import { AgentMemoryPanel } from '@mastra/playground-ui/domains/agents/chat/memory-sidebar/agent-memory-panel';
import { CloneThreadControl } from '@mastra/playground-ui/domains/memory/components/clone-thread-control';
import { useEntityRequestContext } from '@mastra/playground-ui/domains/request-context/hooks/use-entity-request-context';
import { useLinkComponent } from '@mastra/playground-ui/lib/framework';
import { cn } from '@mastra/playground-ui/utils/cn';
import { toast } from '@mastra/playground-ui/utils/toast';
import { useMemorySearch, useCloneThread, useMemoryWithOMStatus, useThread } from '@mastra/react/hooks/memory';
import { AgentObservationalMemory } from './agent-observational-memory';
import { AgentWorkingMemory } from './agent-working-memory';
import { MemorySearch } from '@/lib/ai-ui/memory-search';

interface AgentMemoryProps {
  agentId: string;
  threadId: string;
  memoryType?: 'local' | 'gateway';
}

export function AgentMemory({ agentId, threadId, memoryType }: AgentMemoryProps) {
  const { threadInput: chatInputValue } = useAgentThreadInput(threadId);
  const { paths, navigate } = useLinkComponent();
  const requestContext = useEntityRequestContext('agent', agentId)[0];
  const { data: thread } = useThread({
    threadId,
    agentId,
    requestContext,
    queryOptions: { enabled: Boolean(threadId) && threadId !== 'new' && Boolean(agentId) },
  });
  const effectiveResourceId = thread?.resourceId ?? agentId;
  const { data: omStatus } = useMemoryWithOMStatus({
    agentId,
    resourceId: effectiveResourceId,
    threadId,
    queryOptions: { enabled: Boolean(agentId) },
  });
  const isOMEnabled = omStatus?.observationalMemory?.enabled ?? false;
  const { mutateAsync: searchMemory, data: searchMemoryData } = useMemorySearch({
    agentId,
    resourceId: effectiveResourceId,
    threadId,
    requestContext,
  });
  const { mutateAsync: cloneThread, isPending: isCloning } = useCloneThread();

  const handleCloneThread = async () => {
    if (!threadId || !agentId) return;
    let result;
    try {
      result = await cloneThread({ threadId, agentId });
    } catch {
      toast.error('Failed to clone thread');
      return;
    }
    toast.success('Thread cloned successfully');
    if (result?.thread?.id) navigate(paths.agentThreadLink(agentId, result.thread.id));
  };

  const handleResultClick = (messageId: string, resultThreadId?: string) => {
    if (resultThreadId && resultThreadId !== threadId) {
      navigate(paths.agentThreadLink(agentId, resultThreadId, messageId));
      return;
    }
    const messageElement = document.querySelector(`[data-message-id="${messageId}"]`);
    if (messageElement) {
      messageElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
      messageElement.classList.add('bg-muted');
      setTimeout(() => messageElement.classList.remove('bg-muted'), 2000);
    }
  };
  const searchScope = searchMemoryData?.searchScope;

  return (
    <AgentMemoryPanel
      agentId={agentId}
      memoryType={memoryType}
      clone={threadId && <CloneThreadControl isCloning={isCloning} onClone={handleCloneThread} />}
      observationalMemory={
        isOMEnabled && (
          <AgentObservationalMemory agentId={agentId} resourceId={effectiveResourceId} threadId={threadId} />
        )
      }
      semanticRecallBadge={
        searchScope && (
          <Txt
            as="span"
            variant="column"
            className={cn(
              'rounded px-2 py-0.5',
              searchScope === 'resource'
                ? 'bg-badge-purple-strong text-badge-purple-foreground'
                : 'bg-badge-blue-strong text-badge-blue-foreground',
            )}
            title={searchScope === 'resource' ? 'Searching across all threads' : 'Searching within current thread only'}
          >
            {searchScope}
          </Txt>
        )
      }
      semanticRecallSearch={
        <MemorySearch
          searchMemory={query => searchMemory({ searchQuery: query, memoryConfig: { lastMessages: 0 } })}
          onResultClick={handleResultClick}
          currentThreadId={threadId}
          className="w-full"
          chatInputValue={chatInputValue}
        />
      }
      workingMemory={<AgentWorkingMemory agentId={agentId} />}
    />
  );
}

import { MemorySearch } from '@mastra/playground-ui';
import { useMemorySearch, useMemoryConfig } from '@/hooks/use-memory';
import { AgentWorkingMemory } from './agent-working-memory';
import { AgentMemoryConfig } from './agent-memory-config';
import { useParams, useNavigate } from 'react-router';
import { useCallback, useState } from 'react';
import { cn } from '@/lib/utils';
import { ExternalLink } from 'lucide-react';

interface AgentMemoryProps {
  agentId: string;
  chatInputValue?: string;
}

export function AgentMemory({ agentId, chatInputValue }: AgentMemoryProps) {
  const { threadId } = useParams();
  const navigate = useNavigate();
  const [searchScope, setSearchScope] = useState<string | null>(null);

  // Get memory config to check if semantic recall is enabled
  const { config } = useMemoryConfig(agentId);

  // Check if semantic recall is enabled
  const isSemanticRecallEnabled = config && config.semanticRecall !== false;

  // Get memory search hook
  const { searchMemory } = useMemorySearch({
    agentId: agentId || '',
    resourceId: agentId || '', // In playground, agentId is the resourceId
    threadId,
  });

  // Wrap searchMemory to always pass lastMessages: 0 for semantic-only search
  const searchSemanticRecall = useCallback(
    async (query: string) => {
      const result = await searchMemory(query, { lastMessages: 0 });
      // Update scope from response
      if (result.searchScope) {
        setSearchScope(result.searchScope);
      }
      return result;
    },
    [searchMemory],
  );

  // Handle clicking on a search result to scroll to the message
  const handleResultClick = useCallback(
    (messageId: string, resultThreadId?: string) => {
      // If the result is from a different thread, navigate to that thread with message ID
      if (resultThreadId && resultThreadId !== threadId) {
        navigate(`/agents/${agentId}/chat/${resultThreadId}?messageId=${messageId}`);
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

  return (
    <div className="flex flex-col h-full">
      {/* Memory Search Section */}
      <div className="p-4 border-b border-border1">
        <div className="mb-2">
          <div className="flex items-center gap-2 mb-2">
            <h3 className="text-sm font-medium text-icon5">Semantic Recall</h3>
            {searchScope && (
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
            searchMemory={searchSemanticRecall}
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

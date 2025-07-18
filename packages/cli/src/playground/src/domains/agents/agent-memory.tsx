import { MemorySearch } from '@mastra/playground-ui';
import { useMemorySearch } from '@/hooks/use-memory';
import { AgentWorkingMemory } from './agent-working-memory';
import { useParams } from 'react-router';
import { useCallback } from 'react';

interface AgentMemoryProps {
  agentId: string;
}

export function AgentMemory({ agentId }: AgentMemoryProps) {
  const { threadId } = useParams();

  // Get memory search hook
  const { searchMemory } = useMemorySearch({
    agentId: agentId || '',
    resourceId: agentId || '', // In playground, agentId is the resourceId
    threadId,
  });

  // Wrap searchMemory to always pass lastMessages: 0 for semantic-only search
  const searchSemanticRecall = useCallback(async (query: string) => {
    return searchMemory(query, { lastMessages: 0 });
  }, [searchMemory]);

  // Handle clicking on a search result to scroll to the message
  const handleResultClick = useCallback((messageId: string) => {
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
  }, []);

  return (
    <div className="flex flex-col h-full">
      {/* Memory Search Section */}
      <div className="p-4 border-b border-border1">
        <div className="mb-2">
          <h3 className="text-sm font-medium text-icon5">Search Semantic Recall</h3>
          {!threadId && (
            <p className="text-xs text-icon3 mt-1">Searching across all threads</p>
          )}
        </div>
        <MemorySearch 
          searchMemory={searchSemanticRecall}
          onResultClick={handleResultClick}
          className="w-full"
        />
      </div>

      {/* Working Memory Section */}
      <div className="flex-1 overflow-y-auto">
        <AgentWorkingMemory />
      </div>
    </div>
  );
}
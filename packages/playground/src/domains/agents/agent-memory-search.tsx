import { useState, useCallback, useEffect } from 'react';
import { useParams } from 'react-router';
import { MemorySearch } from '@mastra/playground-ui';
import { useMemorySearch } from '@/hooks/use-memory';
import { useThreadRuntime } from '@assistant-ui/react';

interface AgentMemorySearchProps {
  agentId: string;
}

export function AgentMemorySearch({ agentId }: AgentMemorySearchProps) {
  const { threadId } = useParams();
  const [isReady, setIsReady] = useState(false);

  // Get memory search hook
  const { searchMemory } = useMemorySearch({
    agentId: agentId || '',
    resourceId: agentId || '', // In playground, agentId is the resourceId
    threadId: threadId || '',
  });

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

  // Check if we have the required data
  useEffect(() => {
    setIsReady(!!agentId);
  }, [agentId]);

  if (!isReady) {
    return (
      <div className="p-4 text-center text-icon3">
        <p>Agent not available</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 flex-1">
        <MemorySearch searchMemory={searchMemory} onResultClick={handleResultClick} className="w-full h-full" />
      </div>
    </div>
  );
}

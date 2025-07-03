import React from 'react';
import { WorkingMemoryViewer } from './working-memory-viewer';
import { useAgentWorkingMemory } from '@/hooks/use-agent-working-memory';

interface AgentWorkingMemoryProps {
  agentId: string;
  threadId: string;
  resourceId: string;
}

export const AgentWorkingMemory: React.FC<AgentWorkingMemoryProps> = ({ agentId, threadId, resourceId }) => {
  const { workingMemory, workingMemorySource, isLoading, isUpdating, updateWorkingMemory } = useAgentWorkingMemory(
    agentId,
    threadId,
    resourceId,
  );

  console.log('workingMemory', workingMemory);
  console.log('workingMemorySource', workingMemorySource);

  return (
    <WorkingMemoryViewer
      workingMemory={workingMemory}
      workingMemorySource={workingMemorySource}
      isLoading={isLoading}
      isUpdating={isUpdating}
      onUpdate={updateWorkingMemory}
    />
  );
};

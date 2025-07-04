import { WorkingMemoryViewer } from './working-memory-viewer';
import { useWorkingMemory } from '@mastra/playground-ui';

export const AgentWorkingMemory = () => {
  const { workingMemoryData, workingMemorySource, isLoading, isUpdating, updateWorkingMemory } = useWorkingMemory();

  return (
    <WorkingMemoryViewer
      workingMemory={workingMemoryData}
      workingMemorySource={workingMemorySource}
      isLoading={isLoading}
      isUpdating={isUpdating}
      onUpdate={updateWorkingMemory}
    />
  );
};

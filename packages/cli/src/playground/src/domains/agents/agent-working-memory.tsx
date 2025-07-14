import { useWorkingMemory } from '@mastra/playground-ui';
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Txt } from '@mastra/playground-ui';
import { RefreshCcwIcon } from 'lucide-react';
import { useCopyToClipboard } from '@/hooks/use-copy-to-clipboard';
import { CodeDisplay } from '@/components/ui/code-display';
import { toast } from 'sonner';

export const AgentWorkingMemory = () => {
  const { threadExists, workingMemoryData, workingMemorySource, isLoading, isUpdating, updateWorkingMemory } =
    useWorkingMemory();

  const { isCopied, handleCopy } = useCopyToClipboard({
    text: workingMemoryData ?? '',
    copyMessage: 'Working memory copied!',
  });
  const [editValue, setEditValue] = useState<string>(workingMemoryData ?? '');
  const [isEditing, setIsEditing] = useState(false);

  React.useEffect(() => {
    setEditValue(workingMemoryData ?? '');
  }, [workingMemoryData]);

  if (isLoading) {
    return <Skeleton className="h-32 w-full" />;
  }

  return (
    <div className="flex flex-col gap-4 p-4">
      <Txt variant="header-md">Working Memory (Scope: {workingMemorySource})</Txt>
      {!threadExists && (
        <Txt variant="ui-sm" className="text-icon3 flex items-center gap-2 pt-0.5">
          Send a message to the agent to enable working memory.
        </Txt>
      )}

      {!isEditing ? (
        <CodeDisplay
          content={workingMemoryData || ''}
          isCopied={isCopied}
          onCopy={handleCopy}
          className="bg-surface2 text-[15px] font-mono min-h-[200px]"
        />
      ) : (
        <textarea
          className="w-full min-h-[200px] p-3 border border-border2 rounded bg-surface1 font-mono text-[15px] text-mastra-el-4"
          value={editValue}
          onChange={e => setEditValue(e.target.value)}
          disabled={isUpdating}
        />
      )}
      <div className="flex gap-2">
        {!isEditing ? (
          <Button variant="secondary" onClick={() => setIsEditing(true)} disabled={!threadExists || isUpdating}>
            Edit
          </Button>
        ) : (
          <>
            <Button
              variant="default"
              onClick={async () => {
                try {
                  await updateWorkingMemory(editValue);
                  setIsEditing(false);
                } catch (error) {
                  console.error('Failed to update working memory:', error);
                  toast.error('Failed to update working memory');
                }
              }}
            >
              {isUpdating ? <RefreshCcwIcon className="w-4 h-4 animate-spin" /> : 'Save'}
            </Button>
            <Button
              variant="secondary"
              onClick={() => {
                setEditValue(workingMemoryData ?? '');
                setIsEditing(false);
              }}
              disabled={isUpdating}
            >
              Cancel
            </Button>
          </>
        )}
      </div>
    </div>
  );
};

import { useWorkingMemory } from '@mastra/playground-ui';
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Txt } from '@mastra/playground-ui';
import { RefreshCcwIcon } from 'lucide-react';
import { useCopyToClipboard } from '@/hooks/use-copy-to-clipboard';
import { CodeDisplay } from '@/components/ui/code-display';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

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
      <div>
        <div className="flex items-center gap-2 mb-2">
          <h3 className="text-sm font-medium text-icon5">Working Memory</h3>
          <span
            className={cn(
              'text-xs font-medium px-2 py-0.5 rounded',
              workingMemorySource === 'resource' ? 'bg-purple-500/20 text-purple-400' : 'bg-blue-500/20 text-blue-400',
            )}
            title={
              workingMemorySource === 'resource'
                ? 'Shared across all threads for this agent'
                : 'Specific to this conversation thread'
            }
          >
            {workingMemorySource}
          </span>
        </div>
        {!threadExists && <p className="text-xs text-icon3">Send a message to the agent to enable working memory.</p>}
      </div>

      {!isEditing ? (
        <CodeDisplay
          content={workingMemoryData || ''}
          isCopied={isCopied}
          onCopy={handleCopy}
          className="bg-surface3 text-sm font-mono min-h-[150px] border border-border1 rounded-lg"
        />
      ) : (
        <textarea
          className="w-full min-h-[150px] p-3 border border-border1 rounded-lg bg-surface3 font-mono text-sm text-icon5 resize-none focus:outline-none focus:ring-2 focus:ring-surface4"
          value={editValue}
          onChange={e => setEditValue(e.target.value)}
          disabled={isUpdating}
          placeholder="Enter working memory content..."
        />
      )}
      <div className="flex gap-2">
        {!isEditing ? (
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setIsEditing(true)}
            disabled={!threadExists || isUpdating}
            className="text-xs"
          >
            Edit Working Memory
          </Button>
        ) : (
          <>
            <Button
              variant="default"
              size="sm"
              onClick={async () => {
                try {
                  await updateWorkingMemory(editValue);
                  setIsEditing(false);
                } catch (error) {
                  console.error('Failed to update working memory:', error);
                  toast.error('Failed to update working memory');
                }
              }}
              disabled={isUpdating}
              className="text-xs"
            >
              {isUpdating ? <RefreshCcwIcon className="w-3 h-3 animate-spin" /> : 'Save Changes'}
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                setEditValue(workingMemoryData ?? '');
                setIsEditing(false);
              }}
              disabled={isUpdating}
              className="text-xs"
            >
              Cancel
            </Button>
          </>
        )}
      </div>
    </div>
  );
};

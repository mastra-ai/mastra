import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Txt } from '@mastra/playground-ui';
import { RefreshCcwIcon } from 'lucide-react';
import { useCopyToClipboard } from '@/hooks/use-copy-to-clipboard';
import { CodeDisplay } from '@/components/ui/code-display';

interface WorkingMemoryViewerProps {
  workingMemory: string | null;
  workingMemorySource: 'thread' | 'resource' | null;
  isLoading: boolean;
  isUpdating: boolean;
  onUpdate: (newMemory: string) => Promise<void>;
}

export const WorkingMemoryViewer: React.FC<WorkingMemoryViewerProps> = ({
  workingMemory,
  workingMemorySource,
  isLoading,
  isUpdating,
  onUpdate,
}) => {
  const { isCopied, handleCopy } = useCopyToClipboard({
    text: workingMemory ?? '',
    copyMessage: 'Working memory copied!',
  });
  const [editValue, setEditValue] = useState<string>(workingMemory ?? '');
  const [isEditing, setIsEditing] = useState(false);

  React.useEffect(() => {
    setEditValue(workingMemory ?? '');
  }, [workingMemory]);

  if (isLoading) {
    return <Skeleton className="h-32 w-full" />;
  }

  return (
    <div className="flex flex-col gap-4 p-4">
      <Txt variant="header-md">Working Memory</Txt>
      <span className="text-xs text-mastra-el-6 mb-1">Source: {workingMemorySource}</span>
      {!isEditing ? (
        <CodeDisplay
          content={workingMemory || ''}
          isCopied={isCopied}
          onCopy={handleCopy}
          className="bg-surface2 text-[15px] font-mono min-h-[120px]"
        />
      ) : (
        <textarea
          className="w-full min-h-[120px] p-3 border border-border2 rounded bg-surface1 font-mono text-[15px] text-mastra-el-4"
          value={editValue}
          onChange={e => setEditValue(e.target.value)}
          disabled={isUpdating}
        />
      )}
      <div className="flex gap-2">
        {!isEditing ? (
          <Button variant="secondary" onClick={() => setIsEditing(true)} disabled={isUpdating}>
            Edit
          </Button>
        ) : (
          <>
            <Button
              variant="default"
              onClick={async () => {
                try {
                  await onUpdate(editValue);
                  setIsEditing(false);
                } catch (error) {
                  console.error('Failed to update working memory:', error);
                }
              }}
            >
              {isUpdating ? <RefreshCcwIcon className="w-4 h-4 animate-spin" /> : 'Save'}
            </Button>
            <Button
              variant="secondary"
              onClick={() => {
                setEditValue(workingMemory ?? '');
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

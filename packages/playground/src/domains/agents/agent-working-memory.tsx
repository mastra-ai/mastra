import { useWorkingMemory } from '@mastra/playground-ui';
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { RefreshCcwIcon, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useMemoryConfig } from '@/hooks/use-memory';
import MarkdownRenderer from '@/components/ui/markdown-renderer';
import { useCopyToClipboard } from '@/hooks/use-copy-to-clipboard';
import { CodeDisplay } from '@/components/ui/code-display';
import { ScrollArea } from '@/components/ui/scroll-area';

interface AgentWorkingMemoryProps {
  agentId: string;
}

export const AgentWorkingMemory = ({ agentId }: AgentWorkingMemoryProps) => {
  const { threadExists, workingMemoryData, workingMemorySource, isLoading, isUpdating, updateWorkingMemory } =
    useWorkingMemory();

  // Get memory config to check if working memory is enabled
  const { config } = useMemoryConfig(agentId);

  // Check if working memory is enabled
  const isWorkingMemoryEnabled = config?.workingMemory?.enabled;

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
          {isWorkingMemoryEnabled && workingMemorySource && (
            <span
              className={cn(
                'text-xs font-medium px-2 py-0.5 rounded',
                workingMemorySource === 'resource'
                  ? 'bg-purple-500/20 text-purple-400'
                  : 'bg-blue-500/20 text-blue-400',
              )}
              title={
                workingMemorySource === 'resource'
                  ? 'Shared across all threads for this agent'
                  : 'Specific to this conversation thread'
              }
            >
              {workingMemorySource}
            </span>
          )}
        </div>
        {isWorkingMemoryEnabled && !threadExists && (
          <p className="text-xs text-icon3">Send a message to the agent to enable working memory.</p>
        )}
      </div>

      {isWorkingMemoryEnabled ? (
        <>
          {!isEditing ? (
            <>
              {workingMemoryData ? (
                <>
                  {workingMemoryData.trim().startsWith('{') ? (
                    <CodeDisplay
                      content={workingMemoryData || ''}
                      isCopied={isCopied}
                      onCopy={handleCopy}
                      className="bg-surface3 text-sm font-mono min-h-[150px] border border-border1 rounded-lg"
                    />
                  ) : (
                    <>
                      <div className="bg-surface3 border border-border1 rounded-lg" style={{ height: '300px' }}>
                        <ScrollArea className="h-full">
                          <div
                            className="p-3 cursor-pointer hover:bg-surface4/20 transition-colors relative group text-[10px]"
                            onClick={handleCopy}
                          >
                            <MarkdownRenderer>{workingMemoryData}</MarkdownRenderer>
                            {isCopied && (
                              <span className="absolute top-2 right-2 text-[10px] px-1.5 py-0.5 rounded-full bg-green-500/20 text-green-500">
                                Copied!
                              </span>
                            )}
                            <span className="absolute top-2 right-2 text-[10px] px-1.5 py-0.5 rounded-full bg-surface3 text-icon4 opacity-0 group-hover:opacity-100 transition-opacity">
                              Click to copy
                            </span>
                          </div>
                        </ScrollArea>
                      </div>
                    </>
                  )}
                </>
              ) : (
                <div className="text-sm text-icon3 font-mono">
                  No working memory content yet. Click "Edit Working Memory" to add content.
                </div>
              )}
            </>
          ) : (
            <textarea
              className="w-full min-h-[150px] p-3 border border-border1 rounded-lg bg-surface3 font-mono text-sm text-icon5 resize-none"
              value={editValue}
              onChange={e => setEditValue(e.target.value)}
              disabled={isUpdating}
              placeholder="Enter working memory content..."
            />
          )}
          <div className="flex gap-2">
            {!isEditing ? (
              <>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setIsEditing(true)}
                  disabled={!threadExists || isUpdating}
                  className="text-xs"
                >
                  Edit Working Memory
                </Button>
              </>
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
        </>
      ) : (
        <div className="bg-surface3 border border-border1 rounded-lg p-4">
          <p className="text-sm text-icon3 mb-3">
            Working memory is not enabled for this agent. Enable it to maintain context across conversations.
          </p>
          <a
            href="https://mastra.ai/en/docs/memory/working-memory"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-sm text-blue-400 hover:text-blue-300 transition-colors"
          >
            Learn about working memory
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      )}
    </div>
  );
};

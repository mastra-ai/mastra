import { Button } from '@mastra/playground-ui/components/Button';
import { MarkdownRenderer } from '@mastra/playground-ui/components/MarkdownRenderer';
import { ScrollArea } from '@mastra/playground-ui/components/ScrollArea';
import { Skeleton } from '@mastra/playground-ui/components/Skeleton';
import { Tooltip, TooltipContent, TooltipTrigger } from '@mastra/playground-ui/components/Tooltip';
import { useCopyToClipboard } from '@mastra/playground-ui/hooks/use-copy-to-clipboard';
import { cn } from '@mastra/playground-ui/utils/cn';
import { toast } from '@mastra/playground-ui/utils/toast';
import { RefreshCcwIcon, ExternalLink } from 'lucide-react';
import { useState } from 'react';
import { useWorkingMemory } from '../../context/agent-working-memory-context';
import { CodeDisplay } from './code-display';
import { useMemoryConfig } from '@/domains/memory/hooks';

interface AgentWorkingMemoryProps {
  agentId: string;
}

export const AgentWorkingMemory = ({ agentId }: AgentWorkingMemoryProps) => {
  const { threadExists, workingMemoryData, workingMemorySource, isLoading, isUpdating, updateWorkingMemory } =
    useWorkingMemory();

  // Get memory config to check if working memory is enabled
  const { data, isLoading: isConfigLoading } = useMemoryConfig(agentId);
  const config = data?.config;
  // Check if working memory is enabled
  const isWorkingMemoryEnabled = Boolean(config?.workingMemory?.enabled);

  // All hooks must be called before any early returns
  const { isCopied, handleCopy } = useCopyToClipboard({
    text: workingMemoryData ?? '',
    copyMessage: 'Working memory copied!',
  });
  const [editState, setEditState] = useState({
    source: workingMemoryData,
    value: workingMemoryData ?? '',
  });
  const [isEditing, setIsEditing] = useState(false);

  // Sync the buffer to fresh data, but not while editing — a background refetch or
  // streamed update would otherwise discard the user's in-progress edits.
  if (!isEditing && editState.source !== workingMemoryData) {
    setEditState({ source: workingMemoryData, value: workingMemoryData ?? '' });
  }

  if (isLoading || isConfigLoading) {
    return <Skeleton className="h-32 w-full" />;
  }

  return (
    <div className="flex flex-col gap-4 p-4">
      <div>
        <div className="mb-2 flex items-center gap-2">
          <h3 className="text-neutral5 text-sm font-medium">Working Memory</h3>
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
          <p className="text-neutral3 text-xs">Send a message to the agent to enable working memory.</p>
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
                      className="bg-surface3 border-border1 min-h-[150px] rounded-lg border font-mono text-sm"
                    />
                  ) : (
                    <>
                      <div className="bg-surface3 border-border1 rounded-lg border" style={{ height: '300px' }}>
                        <ScrollArea className="h-full">
                          <div className="hover:bg-surface4/20 group text-ui-xs relative cursor-pointer p-3 transition-colors">
                            <button
                              type="button"
                              onClick={handleCopy}
                              aria-label="Copy working memory"
                              className="focus-visible:ring-accent1 absolute inset-0 z-10 rounded-lg focus-visible:ring-2 focus-visible:outline-hidden"
                            />
                            <div className="pointer-events-none">
                              <MarkdownRenderer>{workingMemoryData}</MarkdownRenderer>
                            </div>
                            {isCopied && (
                              <span className="text-ui-xs pointer-events-none absolute top-2 right-2 z-20 rounded-full bg-green-500/20 px-1.5 py-0.5 text-green-500">
                                Copied!
                              </span>
                            )}
                            <span className="text-ui-xs bg-surface3 text-neutral4 pointer-events-none absolute top-2 right-2 z-20 rounded-full px-1.5 py-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                              Click to copy
                            </span>
                          </div>
                        </ScrollArea>
                      </div>
                    </>
                  )}
                </>
              ) : (
                <div className="text-neutral3 font-mono text-sm">
                  No working memory content yet. Click "Edit Working Memory" to add content.
                </div>
              )}
            </>
          ) : (
            <textarea
              className="border-border1 bg-surface3 text-neutral5 min-h-[150px] w-full resize-none rounded-lg border p-3 font-mono text-sm"
              value={editState.value}
              onChange={e => setEditState(state => ({ ...state, value: e.target.value }))}
              disabled={isUpdating}
              aria-label="Working memory content"
              placeholder="Enter working memory content..."
            />
          )}
          <div className="flex gap-2">
            {!isEditing ? (
              <>
                {!threadExists ? (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        type="button"
                        aria-disabled="true"
                        onClick={event => event.preventDefault()}
                        className="cursor-not-allowed text-xs opacity-50"
                      >
                        Edit Working Memory
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Working memory will be available after the agent calls updateWorkingMemory</p>
                    </TooltipContent>
                  </Tooltip>
                ) : (
                  <Button onClick={() => setIsEditing(true)} disabled={isUpdating} className="text-xs">
                    Edit Working Memory
                  </Button>
                )}
              </>
            ) : (
              <>
                <Button
                  onClick={async () => {
                    try {
                      await updateWorkingMemory(editState.value);
                      setIsEditing(false);
                    } catch (error) {
                      console.error('Failed to update working memory:', error);
                      toast.error('Failed to update working memory');
                    }
                  }}
                  disabled={isUpdating}
                  className="text-xs"
                >
                  {isUpdating ? <RefreshCcwIcon className="h-3 w-3 animate-spin" /> : 'Save Changes'}
                </Button>
                <Button
                  onClick={() => {
                    setEditState({ source: workingMemoryData, value: workingMemoryData ?? '' });
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
        <div className="bg-surface3 border-border1 rounded-lg border p-4">
          <p className="text-neutral3 mb-3 text-sm">
            Working memory is not enabled for this agent. Enable it to maintain context across conversations.
          </p>
          <a
            href="https://mastra.ai/en/docs/memory/working-memory"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-sm text-blue-400 transition-colors hover:text-blue-300"
          >
            Learn about working memory
            <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      )}
    </div>
  );
};

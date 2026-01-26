import { useMemoryConfig } from '@/domains/memory/hooks';
import React, { useState } from 'react';
import { Button } from '@/ds/components/Button/Button';
import { Skeleton } from '@/ds/components/Skeleton';
import { Badge } from '@/ds/components/Badge';
import { Txt } from '@/ds/components/Txt';
import { RefreshCcwIcon, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';
import { MarkdownRenderer } from '@/ds/components/MarkdownRenderer';
import { useCopyToClipboard } from '@/hooks/use-copy-to-clipboard';
import { CodeDisplay } from './code-display';
import { ScrollArea } from '@/ds/components/ScrollArea';
import { useWorkingMemory } from '../../context/agent-working-memory-context';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/ds/components/Tooltip';

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

  if (isLoading || isConfigLoading) {
    return <Skeleton className="h-32 w-full" data-testid="working-memory-loading" />;
  }

  const { isCopied, handleCopy } = useCopyToClipboard({
    text: workingMemoryData ?? '',
    copyMessage: 'Working memory copied!',
  });
  const [editValue, setEditValue] = useState<string>(workingMemoryData ?? '');
  const [isEditing, setIsEditing] = useState(false);

  React.useEffect(() => {
    setEditValue(workingMemoryData ?? '');
  }, [workingMemoryData]);

  return (
    <div className="flex flex-col gap-4 p-4" data-testid="working-memory">
      <div>
        <div className="flex items-center gap-2 mb-2">
          <Txt as="h3" variant="ui-sm" className="font-medium text-neutral5">
            Working Memory
          </Txt>
          {isWorkingMemoryEnabled && workingMemorySource && (
            <Badge
              variant={workingMemorySource === 'resource' ? 'warning' : 'info'}
              data-testid="working-memory-source-badge"
            >
              {workingMemorySource}
            </Badge>
          )}
        </div>
        {isWorkingMemoryEnabled && !threadExists && (
          <Txt variant="ui-xs" className="text-neutral3">
            Send a message to the agent to enable working memory.
          </Txt>
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
                            className="p-3 cursor-pointer hover:bg-surface4/20 transition-colors relative group text-ui-xs"
                            onClick={handleCopy}
                            data-testid="working-memory-content"
                          >
                            <MarkdownRenderer>{workingMemoryData}</MarkdownRenderer>
                            {isCopied && (
                              <Badge variant="success" className="absolute top-2 right-2">
                                Copied!
                              </Badge>
                            )}
                            <Txt
                              variant="ui-xs"
                              className="absolute top-2 right-2 px-1.5 py-0.5 rounded-full bg-surface3 text-neutral4 opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              Click to copy
                            </Txt>
                          </div>
                        </ScrollArea>
                      </div>
                    </>
                  )}
                </>
              ) : (
                <Txt variant="ui-sm" className="text-neutral3 font-mono" data-testid="working-memory-empty">
                  No working memory content yet. Click "Edit Working Memory" to add content.
                </Txt>
              )}
            </>
          ) : (
            <textarea
              className="w-full min-h-[150px] p-3 border border-border1 rounded-lg bg-surface3 font-mono text-sm text-neutral5 resize-none"
              value={editValue}
              onChange={e => setEditValue(e.target.value)}
              disabled={isUpdating}
              placeholder="Enter working memory content..."
              data-testid="working-memory-editor"
            />
          )}
          <div className="flex gap-2">
            {!isEditing ? (
              <>
                {!threadExists ? (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span tabIndex={0}>
                        <Button disabled className="text-xs pointer-events-none">
                          Edit Working Memory
                        </Button>
                      </span>
                    </TooltipTrigger>
                    <TooltipContent>
                      <Txt variant="ui-xs">
                        Working memory will be available after the agent calls updateWorkingMemory
                      </Txt>
                    </TooltipContent>
                  </Tooltip>
                ) : (
                  <Button
                    onClick={() => setIsEditing(true)}
                    disabled={isUpdating}
                    className="text-xs"
                    data-testid="edit-working-memory-button"
                  >
                    Edit Working Memory
                  </Button>
                )}
              </>
            ) : (
              <>
                <Button
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
                  data-testid="save-working-memory-button"
                >
                  {isUpdating ? <RefreshCcwIcon className="w-3 h-3 animate-spin" /> : 'Save Changes'}
                </Button>
                <Button
                  onClick={() => {
                    setEditValue(workingMemoryData ?? '');
                    setIsEditing(false);
                  }}
                  disabled={isUpdating}
                  className="text-xs"
                  data-testid="cancel-working-memory-button"
                >
                  Cancel
                </Button>
              </>
            )}
          </div>
        </>
      ) : (
        <div className="bg-surface3 border border-border1 rounded-lg p-4" data-testid="working-memory-disabled">
          <Txt variant="ui-sm" className="text-neutral3 mb-3">
            Working memory is not enabled for this agent. Enable it to maintain context across conversations.
          </Txt>
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

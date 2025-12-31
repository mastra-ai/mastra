import { AgentWorkingMemory } from './agent-working-memory';
import { AgentMemoryConfig } from './agent-memory-config';
import { useCallback } from 'react';
import { cn } from '@/lib/utils';
import { ExternalLink, Copy, GitBranch, ArrowUpRight, ChevronRight } from 'lucide-react';
import { useLinkComponent } from '@/lib/framework';
import { useThreadInput } from '@/domains/conversation';
import {
  useMemoryConfig,
  useMemorySearch,
  useCloneThread,
  useParentThread,
  useListBranches,
  usePromoteBranch,
  useBranchHistory,
} from '@/domains/memory/hooks';
import { MemorySearch } from '@/components/assistant-ui/memory-search';
import { Button } from '@/components/ui/button';
import { AlertDialog } from '@/components/ui/alert-dialog';

interface AgentMemoryProps {
  agentId: string;
  threadId: string;
}

export function AgentMemory({ agentId, threadId }: AgentMemoryProps) {
  const { threadInput: chatInputValue } = useThreadInput();

  const { Link, paths, navigate } = useLinkComponent();

  // Get memory config to check if semantic recall is enabled
  const { data } = useMemoryConfig(agentId);

  // Check if semantic recall is enabled
  const config = data?.config;
  const isSemanticRecallEnabled = Boolean(config?.semanticRecall);

  // Get memory search hook
  const { mutateAsync: searchMemory, data: searchMemoryData } = useMemorySearch({
    agentId: agentId || '',
    resourceId: agentId || '', // In playground, agentId is the resourceId
    threadId,
  });

  // Get clone thread hook
  const { mutateAsync: cloneThread, isPending: isCloning } = useCloneThread();

  // Get branch-related data
  const { data: parentThread } = useParentThread({
    threadId: threadId || '',
    agentId: agentId || '',
    enabled: Boolean(threadId && agentId),
  });

  const { data: branches } = useListBranches({
    threadId: threadId || '',
    agentId: agentId || '',
    enabled: Boolean(threadId && agentId),
  });

  const { data: branchHistory } = useBranchHistory({
    threadId: threadId || '',
    agentId: agentId || '',
    enabled: Boolean(threadId && agentId && parentThread),
  });

  const { mutateAsync: promoteBranch, isPending: isPromoting } = usePromoteBranch();

  const isBranch = Boolean(parentThread);
  const hasBranches = Boolean(branches && branches.length > 0);

  // Handle cloning the current thread
  const handleCloneThread = useCallback(async () => {
    if (!threadId || !agentId) return;

    const result = await cloneThread({ threadId, agentId });
    // Navigate to the cloned thread
    if (result?.thread?.id) {
      navigate(paths.agentThreadLink(agentId, result.thread.id));
    }
  }, [threadId, agentId, cloneThread, navigate, paths]);

  // Handle promoting the current branch
  const handlePromoteBranch = useCallback(async () => {
    if (!threadId || !agentId || !parentThread) return;

    const result = await promoteBranch({ threadId, agentId });
    // Navigate to the promoted (parent) thread
    if (result?.promotedThread?.id) {
      navigate(paths.agentThreadLink(agentId, result.promotedThread.id));
    }
  }, [threadId, agentId, parentThread, promoteBranch, navigate, paths]);

  // Helper to format thread title
  const getThreadTitle = (thread: { id: string; title?: string }) => {
    if (!thread?.title) return `Thread ${thread?.id?.substring(thread.id.length - 5)}`;
    const defaultPattern = /^New Thread \d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/;
    if (defaultPattern.test(thread.title)) {
      return `Thread ${thread.id?.substring(thread.id.length - 5)}`;
    }
    return thread.title;
  };

  // Handle clicking on a search result to scroll to the message
  const handleResultClick = useCallback(
    (messageId: string, resultThreadId?: string) => {
      // If the result is from a different thread, navigate to that thread with message ID
      if (resultThreadId && resultThreadId !== threadId) {
        navigate(paths.agentThreadLink(agentId, resultThreadId, messageId));
      } else {
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
      }
    },
    [agentId, threadId, navigate],
  );

  const searchScope = searchMemoryData?.searchScope;

  return (
    <div className="flex flex-col h-full">
      {/* Branch Information Section */}
      {threadId && (isBranch || hasBranches) && (
        <div className="p-4 border-b border-border1">
          <div className="flex items-center gap-2 mb-3">
            <GitBranch className="w-4 h-4 text-icon3" />
            <h3 className="text-sm font-medium text-icon5">Branch Info</h3>
          </div>

          {/* Parent Thread Link */}
          {isBranch && parentThread && (
            <div className="mb-3">
              <p className="text-xs text-icon3 mb-1">Branched from:</p>
              <Link
                href={paths.agentThreadLink(agentId, parentThread.id)}
                className="text-sm text-accent1 hover:underline flex items-center gap-1"
              >
                {getThreadTitle(parentThread)}
                <ArrowUpRight className="w-3 h-3" />
              </Link>
            </div>
          )}

          {/* Branch History */}
          {isBranch && branchHistory && branchHistory.length > 1 && (
            <div className="mb-3">
              <p className="text-xs text-icon3 mb-1">Branch history:</p>
              <div className="flex items-center gap-1 flex-wrap text-xs">
                {branchHistory.map((thread, index) => (
                  <span key={thread.id} className="flex items-center">
                    {index > 0 && <ChevronRight className="w-3 h-3 text-icon3 mx-1" />}
                    {thread.id === threadId ? (
                      <span className="text-icon5 font-medium">{getThreadTitle(thread)}</span>
                    ) : (
                      <Link href={paths.agentThreadLink(agentId, thread.id)} className="text-accent1 hover:underline">
                        {getThreadTitle(thread)}
                      </Link>
                    )}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Promote Branch Button */}
          {isBranch && (
            <div className="flex items-center justify-between mt-3 pt-3 border-t border-border1">
              <div>
                <p className="text-xs text-icon3">Make this the main thread</p>
              </div>
              <Button variant="outline" size="sm" onClick={handlePromoteBranch} disabled={isPromoting}>
                <ArrowUpRight className="w-4 h-4 mr-2" />
                {isPromoting ? 'Promoting...' : 'Promote'}
              </Button>
            </div>
          )}

          {/* Child Branches List */}
          {hasBranches && branches && (
            <div className={cn(isBranch && 'mt-3 pt-3 border-t border-border1')}>
              <p className="text-xs text-icon3 mb-2">Branches from this thread:</p>
              <div className="space-y-1">
                {branches.map(branch => (
                  <Link
                    key={branch.id}
                    href={paths.agentThreadLink(agentId, branch.id)}
                    className="text-sm text-accent1 hover:underline flex items-center gap-1"
                  >
                    <GitBranch className="w-3 h-3" />
                    {getThreadTitle(branch)}
                    <ArrowUpRight className="w-3 h-3" />
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Clone Thread Section */}
      {threadId && (
        <div className="p-4 border-b border-border1">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-medium text-icon5">Clone Thread</h3>
              <p className="text-xs text-icon3 mt-1">Create a copy of this conversation</p>
            </div>
            <Button variant="outline" size="sm" onClick={handleCloneThread} disabled={isCloning}>
              <Copy className="w-4 h-4 mr-2" />
              {isCloning ? 'Cloning...' : 'Clone'}
            </Button>
          </div>
        </div>
      )}

      {/* Memory Search Section */}
      <div className="p-4 border-b border-border1">
        <div className="mb-2">
          <div className="flex items-center gap-2 mb-2">
            <h3 className="text-sm font-medium text-icon5">Semantic Recall</h3>
            {searchMemoryData?.searchScope && (
              <span
                className={cn(
                  'text-xs font-medium px-2 py-0.5 rounded',
                  searchScope === 'resource' ? 'bg-purple-500/20 text-purple-400' : 'bg-blue-500/20 text-blue-400',
                )}
                title={
                  searchScope === 'resource' ? 'Searching across all threads' : 'Searching within current thread only'
                }
              >
                {searchScope}
              </span>
            )}
          </div>
        </div>
        {isSemanticRecallEnabled ? (
          <MemorySearch
            searchMemory={query => searchMemory({ searchQuery: query, memoryConfig: { lastMessages: 0 } })}
            onResultClick={handleResultClick}
            currentThreadId={threadId}
            className="w-full"
            chatInputValue={chatInputValue}
          />
        ) : (
          <div className="bg-surface3 border border-border1 rounded-lg p-4">
            <p className="text-sm text-icon3 mb-3">
              Semantic recall is not enabled for this agent. Enable it to search through conversation history.
            </p>
            <a
              href="https://mastra.ai/en/docs/memory/semantic-recall"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-sm text-blue-400 hover:text-blue-300 transition-colors"
            >
              Learn about semantic recall
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        )}
      </div>

      {/* Working Memory Section */}
      <div className="flex-1 overflow-y-auto">
        <AgentWorkingMemory agentId={agentId} />
        <div className="border-t border-border1">
          <AgentMemoryConfig agentId={agentId} />
        </div>
      </div>
    </div>
  );
}

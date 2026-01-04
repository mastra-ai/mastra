import { useState, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { Txt } from '@/ds/components/Txt';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  ExternalLink,
  Copy,
  MessageSquare,
  Brain,
  Settings,
  Search,
  BarChart3,
} from 'lucide-react';
import { useLinkComponent } from '@/lib/framework';
import { useThreadInput } from '@/domains/conversation';
import { useMemoryConfig, useMemorySearch, useCloneThread } from '@/domains/memory/hooks';
import { MemorySearch } from '@/components/assistant-ui/memory-search';
import { ThreadMessageBrowser } from './thread-message-browser';
import { ThreadStats } from './thread-stats';
import type { StorageThreadType } from '@mastra/core/memory';

export type MemoryExplorerTab = 'messages' | 'search' | 'working-memory' | 'stats' | 'config';

export type MemoryExplorerProps = {
  agentId: string;
  threadId: string;
  thread?: StorageThreadType | null;
  defaultTab?: MemoryExplorerTab;
  className?: string;
  // Optional components for working memory and config (allows customization)
  WorkingMemoryComponent?: React.ComponentType<{ agentId: string }>;
  MemoryConfigComponent?: React.ComponentType<{ agentId: string }>;
};

type TabButtonProps = {
  active: boolean;
  icon: React.ReactNode;
  label: string;
  badge?: string | number;
  onClick: () => void;
};

const TabButton = ({ active, icon, label, badge, onClick }: TabButtonProps) => (
  <button
    onClick={onClick}
    className={cn(
      'flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-md transition-colors',
      active
        ? 'bg-accent1/20 text-accent1'
        : 'text-icon3 hover:bg-surface3 hover:text-icon5'
    )}
  >
    {icon}
    <span className="hidden sm:inline">{label}</span>
    {badge !== undefined && (
      <Badge variant="secondary" className="h-5 px-1.5 text-[10px] ml-1">
        {badge}
      </Badge>
    )}
  </button>
);

export const MemoryExplorer = ({
  agentId,
  threadId,
  thread,
  defaultTab = 'messages',
  className,
  WorkingMemoryComponent,
  MemoryConfigComponent,
}: MemoryExplorerProps) => {
  const [activeTab, setActiveTab] = useState<MemoryExplorerTab>(defaultTab);
  const { threadInput: chatInputValue } = useThreadInput();
  const { paths, navigate } = useLinkComponent();

  // Get memory config to check if features are enabled
  const { data: memoryConfigData } = useMemoryConfig(agentId);
  const config = memoryConfigData?.config;
  const isSemanticRecallEnabled = Boolean(config?.semanticRecall);
  const isWorkingMemoryEnabled = Boolean(
    config?.workingMemory && typeof config.workingMemory === 'object' && config.workingMemory.enabled
  );

  // Get memory search hook
  const { mutateAsync: searchMemory, data: searchMemoryData } = useMemorySearch({
    agentId: agentId || '',
    resourceId: agentId || '',
    threadId,
  });

  // Get clone thread hook
  const { mutateAsync: cloneThread, isPending: isCloning } = useCloneThread();

  const handleCloneThread = useCallback(async () => {
    if (!threadId || !agentId) return;
    const result = await cloneThread({ threadId, agentId });
    if (result?.thread?.id) {
      navigate(paths.agentThreadLink(agentId, result.thread.id));
    }
  }, [threadId, agentId, cloneThread, navigate, paths]);

  const handleSearchResultClick = useCallback(
    (messageId: string, resultThreadId?: string) => {
      if (resultThreadId && resultThreadId !== threadId) {
        navigate(paths.agentThreadLink(agentId, resultThreadId, messageId));
      } else {
        const messageElement = document.querySelector(`[data-message-id="${messageId}"]`);
        if (messageElement) {
          messageElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
          messageElement.classList.add('ring-2', 'ring-blue-400/50');
          setTimeout(() => {
            messageElement.classList.remove('ring-2', 'ring-blue-400/50');
          }, 2000);
        }
      }
    },
    [agentId, threadId, navigate, paths]
  );

  const searchScope = searchMemoryData?.searchScope;

  return (
    <div className={cn('flex flex-col h-full', className)}>
      {/* Header with thread actions */}
      {threadId && (
        <div className="p-3 border-b border-border1 flex items-center justify-between">
          <Txt variant="ui-sm" className="font-medium text-icon5">
            Memory Explorer
          </Txt>
          <Button
            variant="outline"
            size="sm"
            onClick={handleCloneThread}
            disabled={isCloning}
            className="h-7 text-xs"
          >
            <Copy className="w-3.5 h-3.5 mr-1.5" />
            {isCloning ? 'Cloning...' : 'Clone Thread'}
          </Button>
        </div>
      )}

      {/* Tab navigation */}
      <div className="px-3 py-2 border-b border-border1 flex items-center gap-1 overflow-x-auto">
        <TabButton
          active={activeTab === 'messages'}
          icon={<MessageSquare className="w-4 h-4" />}
          label="Messages"
          onClick={() => setActiveTab('messages')}
        />
        <TabButton
          active={activeTab === 'search'}
          icon={<Search className="w-4 h-4" />}
          label="Search"
          badge={isSemanticRecallEnabled ? undefined : '!'}
          onClick={() => setActiveTab('search')}
        />
        {isWorkingMemoryEnabled && WorkingMemoryComponent && (
          <TabButton
            active={activeTab === 'working-memory'}
            icon={<Brain className="w-4 h-4" />}
            label="Working Memory"
            onClick={() => setActiveTab('working-memory')}
          />
        )}
        <TabButton
          active={activeTab === 'stats'}
          icon={<BarChart3 className="w-4 h-4" />}
          label="Stats"
          onClick={() => setActiveTab('stats')}
        />
        <TabButton
          active={activeTab === 'config'}
          icon={<Settings className="w-4 h-4" />}
          label="Config"
          onClick={() => setActiveTab('config')}
        />
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-hidden">
        {activeTab === 'messages' && (
          <ThreadMessageBrowser agentId={agentId} threadId={threadId} className="h-full" />
        )}

        {activeTab === 'search' && (
          <ScrollArea className="h-full">
            <div className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <Txt variant="ui-sm" className="font-medium text-icon5">
                  Semantic Recall
                </Txt>
                {searchScope && (
                  <Badge
                    variant="outline"
                    className={cn(
                      'text-xs',
                      searchScope === 'resource'
                        ? 'bg-purple-500/10 text-purple-400 border-purple-500/30'
                        : 'bg-blue-500/10 text-blue-400 border-blue-500/30'
                    )}
                  >
                    {searchScope}
                  </Badge>
                )}
              </div>

              {isSemanticRecallEnabled ? (
                <MemorySearch
                  searchMemory={(query) =>
                    searchMemory({ searchQuery: query, memoryConfig: { lastMessages: 0 } })
                  }
                  onResultClick={handleSearchResultClick}
                  currentThreadId={threadId}
                  className="w-full"
                  chatInputValue={chatInputValue}
                />
              ) : (
                <div className="bg-surface3 border border-border1 rounded-lg p-4">
                  <Txt variant="ui-sm" className="text-icon3 mb-3">
                    Semantic recall is not enabled for this agent. Enable it to search through
                    conversation history using natural language.
                  </Txt>
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
          </ScrollArea>
        )}

        {activeTab === 'working-memory' && WorkingMemoryComponent && (
          <ScrollArea className="h-full">
            <WorkingMemoryComponent agentId={agentId} />
          </ScrollArea>
        )}

        {activeTab === 'stats' && thread && (
          <ScrollArea className="h-full">
            <div className="p-4">
              <ThreadStats agentId={agentId} thread={thread} />
            </div>
          </ScrollArea>
        )}

        {activeTab === 'stats' && !thread && (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <BarChart3 className="w-12 h-12 text-icon3 mx-auto mb-3" />
              <Txt variant="ui-sm" className="text-icon3">
                Select a thread to view statistics
              </Txt>
            </div>
          </div>
        )}

        {activeTab === 'config' && MemoryConfigComponent && (
          <ScrollArea className="h-full">
            <MemoryConfigComponent agentId={agentId} />
          </ScrollArea>
        )}

        {activeTab === 'config' && !MemoryConfigComponent && (
          <ScrollArea className="h-full">
            <div className="p-4">
              <Txt variant="ui-sm" className="text-icon3">
                Memory configuration display is not available.
              </Txt>
            </div>
          </ScrollArea>
        )}
      </div>
    </div>
  );
};

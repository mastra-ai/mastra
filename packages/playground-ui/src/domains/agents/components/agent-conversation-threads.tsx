import { AgentConversationSidebar } from './agent-conversation-sidebar';
import { ThreadListEmpty, ThreadListItem, ThreadListItems, ThreadListNewItem } from '@/ds/components/ThreadList';
import { Txt } from '@/ds/components/Txt';
import { Icon } from '@/ds/icons';
import { IconPlusMedium } from '@/ds/icons/central/IconPlusMedium';

export interface AgentConversationThread {
  id: string;
  title: string;
}

export interface AgentConversationThreadsProps {
  threads: AgentConversationThread[];
  selectedThreadId?: string;
  onSelectThread: (threadId: string) => void;
  onNewThread: () => void;
  onCollapse?: () => void;
  isLoading?: boolean;
  embedded?: boolean;
}

/** Simple controlled conversation navigation for hosts without Studio-specific thread actions. */
export const AgentConversationThreads = ({
  threads,
  selectedThreadId,
  onSelectThread,
  onNewThread,
  onCollapse,
  isLoading,
  embedded,
}: AgentConversationThreadsProps) => (
  <AgentConversationSidebar
    embedded={embedded}
    isLoading={isLoading}
    onCollapse={onCollapse}
    newThreadSlot={
      <ThreadListNewItem render={<button type="button" onClick={onNewThread} />}>
        <Icon>
          <IconPlusMedium />
        </Icon>
        New Thread
      </ThreadListNewItem>
    }
  >
    {threads.length === 0 ? (
      <ThreadListEmpty>Your conversations will appear here once you start chatting!</ThreadListEmpty>
    ) : (
      <ThreadListItems>
        {threads.map(thread => (
          <ThreadListItem
            key={thread.id}
            isActive={thread.id === selectedThreadId}
            onClick={() => onSelectThread(thread.id)}
          >
            <Txt as="span" variant="body-sm" className="block truncate">
              {thread.title}
            </Txt>
          </ThreadListItem>
        ))}
      </ThreadListItems>
    )}
  </AgentConversationSidebar>
);

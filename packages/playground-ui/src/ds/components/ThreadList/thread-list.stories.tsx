import type { Meta, StoryObj } from '@storybook/react-vite';
import { PlusIcon } from 'lucide-react';
import { useState } from 'react';

import {
  ThreadList,
  ThreadListEmpty,
  ThreadListItem,
  ThreadListItems,
  ThreadListNewItem,
  ThreadListSeparator,
} from './thread-list';

const initialThreads = [
  'Compare vector databases for semantic search',
  'Draft the product launch brief',
  'Investigate failed workflow runs',
  'Plan customer support routing',
];

const meta: Meta<typeof ThreadList> = {
  title: 'Navigation/ThreadList',
  component: ThreadList,
  parameters: { layout: 'centered' },
};

export default meta;
type Story = StoryObj<typeof ThreadList>;

function ThreadListPreview({ embedded = false }: { embedded?: boolean }) {
  const [threads, setThreads] = useState(initialThreads);
  const [active, setActive] = useState(initialThreads[0]);

  return (
    <div className="h-96 w-80">
      <ThreadList embedded={embedded}>
        <ThreadListNewItem as="a" href="#new">
          <PlusIcon />
          New thread
        </ThreadListNewItem>
        <ThreadListSeparator />
        {threads.length === 0 ? (
          <ThreadListEmpty>Your conversations will appear here.</ThreadListEmpty>
        ) : (
          <ThreadListItems>
            {threads.map(thread => (
              <ThreadListItem
                key={thread}
                isActive={active === thread}
                onClick={() => setActive(thread)}
                onDelete={() => setThreads(current => current.filter(candidate => candidate !== thread))}
                deleteLabel={`Delete ${thread}`}
              >
                <span className="block truncate">{thread}</span>
              </ThreadListItem>
            ))}
          </ThreadListItems>
        )}
      </ThreadList>
    </div>
  );
}

export const Default: Story = {
  render: () => <ThreadListPreview />,
};

export const Embedded: Story = {
  render: () => (
    <div className="border-border1 bg-surface2 rounded-xl border p-3">
      <ThreadListPreview embedded />
    </div>
  ),
};

export const Empty: Story = {
  render: () => (
    <div className="h-56 w-80">
      <ThreadList>
        <ThreadListEmpty>Your conversations will appear here.</ThreadListEmpty>
      </ThreadList>
    </div>
  ),
};

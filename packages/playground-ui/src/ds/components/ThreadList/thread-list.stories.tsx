import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';

import { DropdownMenu } from '../DropdownMenu/dropdown-menu';
import {
  ThreadList,
  ThreadListEmpty,
  ThreadListItem,
  ThreadListItems,
  ThreadListNewItem,
  ThreadListSeparator,
} from './thread-list';
import { IconDotGrid1x3Vertical } from '@/ds/icons/central/IconDotGrid1x3Vertical';
import { IconPlusLarge } from '@/ds/icons/central/IconPlusLarge';

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
        <ThreadListNewItem render={<a href="#new" />}>
          <IconPlusLarge />
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
    <div className="rounded-xl border border-border bg-background p-3">
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

export const WithActions: Story = {
  render: () => (
    <div className="h-96 w-80">
      <ThreadList>
        <ThreadListItems>
          {initialThreads.map(thread => (
            <ThreadListItem
              key={thread}
              actions={
                <DropdownMenu>
                  <DropdownMenu.Trigger aria-label={`Actions for ${thread}`}>
                    <IconDotGrid1x3Vertical />
                  </DropdownMenu.Trigger>
                  <DropdownMenu.Content align="end">
                    <DropdownMenu.Item>Rename</DropdownMenu.Item>
                    <DropdownMenu.Item variant="destructive">Delete</DropdownMenu.Item>
                  </DropdownMenu.Content>
                </DropdownMenu>
              }
            >
              <span className="block truncate">{thread}</span>
            </ThreadListItem>
          ))}
        </ThreadListItems>
      </ThreadList>
    </div>
  ),
};

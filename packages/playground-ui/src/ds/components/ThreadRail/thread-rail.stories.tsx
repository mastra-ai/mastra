import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';

import { ThreadRail } from './thread-rail';
import type { ThreadRailTurn } from './thread-rail-turns';

const turns: ThreadRailTurn[] = [
  {
    key: 'turn-1',
    messageId: 'message-1',
    prompt: 'Compare vector databases for semantic search',
    reply: 'Here is a comparison of latency, filtering, and operational tradeoffs.',
    files: [],
    hiddenFileCount: 0,
  },
  {
    key: 'turn-2',
    messageId: 'message-2',
    prompt: 'Use the production requirements from the attached brief',
    reply: 'The brief favors regional availability and predictable filtering performance.',
    files: ['requirements.md', 'architecture.pdf'],
    hiddenFileCount: 2,
  },
  {
    key: 'turn-3',
    messageId: 'message-3',
    prompt: 'Turn that into a recommendation for the platform team',
    reply: 'Start with the managed option and keep the storage adapter boundary explicit.',
    files: [],
    hiddenFileCount: 0,
  },
  {
    key: 'turn-4',
    messageId: 'message-4',
    prompt: 'What would change at ten times the current traffic?',
    reply: 'Index build time and cross-region replication become the main constraints.',
    files: [],
    hiddenFileCount: 0,
  },
];

const meta: Meta<typeof ThreadRail> = {
  title: 'Navigation/ThreadRail',
  component: ThreadRail,
  parameters: { layout: 'centered' },
  args: {
    turns,
    currentAnchorId: 'message-2',
    visibleMessageIds: ['message-2', 'message-3'],
    onSelect: fn(),
  },
};

export default meta;
type Story = StoryObj<typeof ThreadRail>;

export const ConversationTimeline: Story = {
  render: args => (
    <div className="border-border1 bg-surface2 flex h-80 w-112 items-center rounded-xl border px-10">
      <ThreadRail {...args} maxHeight="16rem" />
      <p className="text-ui-sm text-neutral3 ml-10">Hover or focus a rail stop to preview that turn.</p>
    </div>
  ),
};

export const Empty: Story = {
  args: { turns: [] },
  render: args => (
    <div className="border-border1 h-40 w-80 rounded-xl border border-dashed">
      <ThreadRail {...args} />
    </div>
  ),
};

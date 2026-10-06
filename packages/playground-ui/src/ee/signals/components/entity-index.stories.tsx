import type { ThemeLearningEntity } from '@mastra/client-js';
import type { Meta, StoryObj } from '@storybook/react-vite';

import { EntityIndexCompactGrid } from './entity-index-compact-grid';
import { EntityIndexList } from './entity-index-list';
import { TooltipProvider } from '@/ds/components/Tooltip';

const entities: ThemeLearningEntity[] = [
  {
    entityId: 'support-agent',
    entityType: 'agent',
    availableSignals: ['goal', 'outcome'],
    traceCount: 12480,
    readySignalCount: 4,
    enabledSignalCount: 4,
    status: 'ready',
    updatedAt: '2026-10-06T08:00:00Z',
  },
  {
    entityId: 'billing-agent',
    entityType: 'agent',
    availableSignals: [],
    traceCount: 42,
    readySignalCount: 0,
    enabledSignalCount: 4,
    status: 'collecting',
    updatedAt: '2026-10-06T07:45:00Z',
  },
  {
    entityId: 'research-agent',
    entityType: 'agent',
    availableSignals: ['goal'],
    traceCount: 512,
    readySignalCount: 1,
    enabledSignalCount: 4,
    status: 'processing',
    updatedAt: '2026-10-06T07:30:00Z',
  },
];

const getEntityHref = (entity: ThemeLearningEntity) => `/intelligence/entities/${entity.entityType}/${entity.entityId}`;

const meta = {
  title: 'Features/Trace Intelligence/Agents',
  component: EntityIndexList,
  parameters: { layout: 'padded' },
  decorators: [
    Story => (
      <TooltipProvider>
        <div className="h-100 w-full">
          <Story />
        </div>
      </TooltipProvider>
    ),
  ],
  args: { entities, hasSearch: false, LinkComponent: 'a', getEntityHref },
} satisfies Meta<typeof EntityIndexList>;

export default meta;
type Story = StoryObj<typeof meta>;

export const List: Story = {};

export const Compact: Story = {
  render: args => <EntityIndexCompactGrid {...args} />,
};

export const UnknownTraceCount: Story = {
  args: { entities: [{ entityId: 'new-agent', entityType: 'agent', availableSignals: [], status: 'collecting' }] },
};

export const NoMatches: Story = {
  args: { entities: [], hasSearch: true },
};

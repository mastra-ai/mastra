import type { Meta, StoryObj } from '@storybook/react-vite';
import { BotIcon } from 'lucide-react';

import { Badge } from '../Badge';
import { PageHeader } from './page-header';

const meta: Meta<typeof PageHeader> = {
  title: 'Layout/PageHeader',
  component: PageHeader,
  parameters: { layout: 'centered' },
};

export default meta;
type Story = StoryObj<typeof PageHeader>;

export const Default: Story = {
  render: () => (
    <PageHeader className="w-[min(42rem,calc(100vw-3rem))]">
      <PageHeader.Title>
        <BotIcon />
        Research agent <Badge variant="green">Active</Badge>
      </PageHeader.Title>
      <PageHeader.Description>
        Searches trusted sources and writes cited summaries.
        <span className="font-mono">agent_8f3a91b2</span>
      </PageHeader.Description>
    </PageHeader>
  ),
};

export const Loading: Story = {
  render: () => (
    <PageHeader className="w-[min(42rem,calc(100vw-3rem))] overflow-x-auto">
      <PageHeader.Title isLoading />
      <PageHeader.Description isLoading />
    </PageHeader>
  ),
};

export const SmallerTitle: Story = {
  render: () => (
    <PageHeader className="w-[min(42rem,calc(100vw-3rem))]">
      <PageHeader.Title size="smaller">Infrastructure</PageHeader.Title>
      <PageHeader.Description>Runtime, storage, and observability configuration.</PageHeader.Description>
    </PageHeader>
  ),
};

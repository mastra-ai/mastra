import type { Meta, StoryObj } from '@storybook/react-vite';
import { BotIcon } from 'lucide-react';

import { PageHeader } from './page-header';
import type { PageHeaderTitleSize } from './page-header';
import { Badge } from '@/ds/components/Badge';
import { Button } from '@/ds/components/Button';

function StoryFrame({ children }: { children: React.ReactNode }) {
  return <div className="w-[min(42rem,calc(100vw-7rem))] py-10">{children}</div>;
}

type PageHeaderStoryProps = {
  description: string;
  isLoading: boolean;
  metaBeside: boolean;
  showAction: boolean;
  showDescription: boolean;
  showIcon: boolean;
  showMeta: boolean;
  showTitle: boolean;
  title: string;
  titleSize: PageHeaderTitleSize;
};

function PageHeaderStory({
  description,
  isLoading,
  metaBeside,
  showAction,
  showDescription,
  showIcon,
  showMeta,
  showTitle,
  title,
  titleSize,
}: PageHeaderStoryProps) {
  return (
    <StoryFrame>
      <PageHeader>
        {showIcon && (
          <PageHeader.Icon>
            <BotIcon strokeWidth={2.5} />
          </PageHeader.Icon>
        )}
        {showTitle && (
          <PageHeader.Title size={titleSize} isLoading={isLoading}>
            {title}
          </PageHeader.Title>
        )}
        {showMeta && (
          <PageHeader.Meta beside={metaBeside}>
            <Badge variant="green">Active</Badge>
            {!metaBeside && <span className="text-ui-xs text-neutral2 font-mono">agent_8f3a91b2</span>}
          </PageHeader.Meta>
        )}
        {showDescription && <PageHeader.Description isLoading={isLoading}>{description}</PageHeader.Description>}
        {showAction && (
          <PageHeader.Action>
            <Button size="sm">Edit agent</Button>
          </PageHeader.Action>
        )}
      </PageHeader>
    </StoryFrame>
  );
}

const meta = {
  title: 'Layout/PageHeader',
  component: PageHeaderStory,
  parameters: { layout: 'centered' },
  args: {
    description: 'Searches trusted sources and writes cited summaries.',
    isLoading: false,
    metaBeside: false,
    showAction: true,
    showDescription: true,
    showIcon: false,
    showMeta: false,
    showTitle: true,
    title: 'Research agent',
    titleSize: 'md',
  },
  argTypes: {
    title: { control: 'text' },
    titleSize: { control: 'inline-radio', options: ['sm', 'md', 'lg', 'xl'] },
    description: { control: 'text' },
    metaBeside: { control: 'boolean' },
    isLoading: { control: 'boolean' },
    showIcon: { control: 'boolean' },
    showTitle: { control: 'boolean' },
    showMeta: { control: 'boolean' },
    showDescription: { control: 'boolean' },
    showAction: { control: 'boolean' },
  },
} satisfies Meta<typeof PageHeaderStory>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const AllSlots: Story = {
  args: {
    showIcon: true,
    showMeta: true,
  },
};

export const MetaBeside: Story = {
  render: () => (
    <StoryFrame>
      <PageHeader>
        <PageHeader.Title>production</PageHeader.Title>
        <PageHeader.Meta beside>
          <Badge variant="green">Live</Badge>
        </PageHeader.Meta>
        <PageHeader.Action>
          <Button size="sm">Settings</Button>
        </PageHeader.Action>
        <PageHeader.Description>Runtime configuration for the production environment.</PageHeader.Description>
      </PageHeader>
    </StoryFrame>
  ),
};

export const MetaBoth: Story = {
  render: () => (
    <StoryFrame>
      <PageHeader>
        <PageHeader.Title>production</PageHeader.Title>
        <PageHeader.Meta beside>
          <Badge variant="green">Live</Badge>
        </PageHeader.Meta>
        <PageHeader.Meta>
          <span className="text-ui-xs text-neutral2 font-mono">env_01j9</span>
        </PageHeader.Meta>
        <PageHeader.Action>
          <Button size="sm">Settings</Button>
        </PageHeader.Action>
      </PageHeader>
    </StoryFrame>
  ),
};

export const IconOnly: Story = {
  render: () => (
    <StoryFrame>
      <PageHeader>
        <PageHeader.Icon>
          <BotIcon strokeWidth={2.5} />
        </PageHeader.Icon>
      </PageHeader>
    </StoryFrame>
  ),
};

export const TitleOnly: Story = {
  render: () => (
    <StoryFrame>
      <PageHeader>
        <PageHeader.Title>Title only</PageHeader.Title>
      </PageHeader>
    </StoryFrame>
  ),
};

export const MetaOnly: Story = {
  render: () => (
    <StoryFrame>
      <PageHeader>
        <PageHeader.Meta>
          <Badge variant="green">Meta only</Badge>
        </PageHeader.Meta>
      </PageHeader>
    </StoryFrame>
  ),
};

export const DescriptionOnly: Story = {
  render: () => (
    <StoryFrame>
      <PageHeader>
        <PageHeader.Description>Description only</PageHeader.Description>
      </PageHeader>
    </StoryFrame>
  ),
};

export const ActionOnly: Story = {
  render: () => (
    <StoryFrame>
      <PageHeader>
        <PageHeader.Action>
          <Button size="sm">Action only</Button>
        </PageHeader.Action>
      </PageHeader>
    </StoryFrame>
  ),
};

export const TallAction: Story = {
  render: () => (
    <div className="grid w-[min(42rem,calc(100vw-7rem))] gap-6 py-10">
      <PageHeader>
        <PageHeader.Title>Environment variables</PageHeader.Title>
      </PageHeader>
      <PageHeader>
        <PageHeader.Title>Environments</PageHeader.Title>
        <PageHeader.Action>
          <div className="flex flex-col gap-2">
            <Button size="sm">Create environment</Button>
            <Button size="sm" variant="outline">
              Import
            </Button>
          </div>
        </PageHeader.Action>
      </PageHeader>
    </div>
  ),
};

export const TitleSizes: Story = {
  render: () => (
    <div className="grid w-[min(42rem,calc(100vw-7rem))] gap-6 py-10">
      <PageHeader>
        <PageHeader.Title size="sm">Small title</PageHeader.Title>
      </PageHeader>
      <PageHeader>
        <PageHeader.Title>Medium title</PageHeader.Title>
      </PageHeader>
      <PageHeader>
        <PageHeader.Title size="lg">Large title</PageHeader.Title>
      </PageHeader>
      <PageHeader>
        <PageHeader.Title size="xl">Extra large title</PageHeader.Title>
      </PageHeader>
      <PageHeader>
        <PageHeader.Title size="smaller">Legacy smaller title</PageHeader.Title>
      </PageHeader>
    </div>
  ),
};

export const Loading: Story = {
  render: () => (
    <StoryFrame>
      <PageHeader className="overflow-x-auto">
        <PageHeader.Title isLoading />
        <PageHeader.Description isLoading />
      </PageHeader>
    </StoryFrame>
  ),
};

export const LegacyProps: Story = {
  render: () => (
    <StoryFrame>
      <PageHeader
        title="Legacy header"
        description="The legacy prop API remains supported."
        icon={<BotIcon strokeWidth={2.5} />}
      />
    </StoryFrame>
  ),
};

export const LegacyLoading: Story = {
  render: () => (
    <StoryFrame>
      <PageHeader
        title="Legacy header"
        description="The legacy prop API remains supported."
        icon={<BotIcon strokeWidth={2.5} />}
        isLoading
      />
    </StoryFrame>
  ),
};

export const Empty: Story = {
  render: () => (
    <StoryFrame>
      <PageHeader />
    </StoryFrame>
  ),
};

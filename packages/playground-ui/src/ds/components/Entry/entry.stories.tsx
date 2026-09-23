import type { Meta, StoryObj } from '@storybook/react-vite';
import { Badge } from '../Badge';
import { Txt } from '../Txt';
import { Entry } from './entry';

const meta: Meta<typeof Entry> = {
  title: 'DataDisplay/Entry',
  component: Entry,
  parameters: {
    layout: 'centered',
  },
};

export default meta;
type Story = StoryObj<typeof Entry>;

export const Default: Story = {
  args: {
    label: 'Label',
    children: <Txt variant="body">Value content</Txt>,
  },
};

export const WithText: Story = {
  args: {
    label: 'Name',
    children: (
      <Txt variant="body" tone="ink">
        John Doe
      </Txt>
    ),
  },
};

export const WithBadge: Story = {
  args: {
    label: 'Status',
    children: <Badge variant="green">Active</Badge>,
  },
};

export const WithLongContent: Story = {
  args: {
    label: 'Description',
    children: (
      <Txt variant="body" tone="ink">
        This is a longer description that contains multiple lines of text to show how the component handles longer
        content.
      </Txt>
    ),
  },
};

export const MultipleEntries: Story = {
  render: () => (
    <div className="flex w-75 flex-col gap-4">
      <Entry label="Name">
        <Txt variant="body" tone="ink">
          My Agent
        </Txt>
      </Entry>
      <Entry label="Status">
        <Badge variant="green">Running</Badge>
      </Entry>
      <Entry label="Created">
        <Txt variant="body" tone="ink">
          Jan 14, 2026
        </Txt>
      </Entry>
    </div>
  ),
};

export const WithComplexContent: Story = {
  args: {
    label: 'Configuration',
    children: (
      <div className="flex flex-col gap-1">
        <Txt variant="caption" tone="ink">
          Model: GPT-4
        </Txt>
        <Txt variant="caption" tone="ink">
          Temperature: 0.7
        </Txt>
        <Txt variant="caption" tone="ink">
          Max tokens: 4096
        </Txt>
      </div>
    ),
  },
};

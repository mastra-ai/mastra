import type { Meta, StoryObj } from '@storybook/react-vite';
import { Entry } from './entry';
import { Txt } from '../Txt';
import { Badge } from '../Badge';

const meta: Meta<typeof Entry> = {
  title: 'DataDisplay/Entry',
  component: Entry,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof Entry>;

export const Default: Story = {
  args: {
    label: 'Label',
    children: <Txt variant="ui-md">Value content</Txt>,
  },
};

export const WithText: Story = {
  args: {
    label: 'Name',
    children: (
      <Txt variant="ui-md" className="text-neutral6">
        John Doe
      </Txt>
    ),
  },
};

export const WithBadge: Story = {
  args: {
    label: 'Status',
    children: <Badge variant="success">Active</Badge>,
  },
};

export const WithLongContent: Story = {
  args: {
    label: 'Description',
    children: (
      <Txt variant="ui-md" className="text-neutral6">
        This is a longer description that contains multiple lines of text to show how the component handles longer
        content.
      </Txt>
    ),
  },
};

export const MultipleEntries: Story = {
  render: () => (
    <div className="flex flex-col gap-4 w-[300px]">
      <Entry label="Name">
        <Txt variant="ui-md" className="text-neutral6">
          My Agent
        </Txt>
      </Entry>
      <Entry label="Status">
        <Badge variant="success">Running</Badge>
      </Entry>
      <Entry label="Created">
        <Txt variant="ui-md" className="text-neutral6">
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
        <Txt variant="ui-sm" className="text-neutral5">
          Model: GPT-4
        </Txt>
        <Txt variant="ui-sm" className="text-neutral5">
          Temperature: 0.7
        </Txt>
        <Txt variant="ui-sm" className="text-neutral5">
          Max tokens: 4096
        </Txt>
      </div>
    ),
  },
};

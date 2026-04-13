import type { Meta, StoryObj } from '@storybook/react-vite';
import { DataKeysAndValues } from './data-keys-and-values';
import type { DataKeysAndValuesProps } from './data-keys-and-values-root';
import { forwardRef } from 'react';
import { TooltipProvider } from '@/ds/components/Tooltip';
import type { LinkComponentProps } from '@/ds/types/link-component';

const meta: Meta<typeof DataKeysAndValues> = {
  title: 'Elements/DataKeysAndValues',
  component: DataKeysAndValues,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {
    numOfCol: {
      control: { type: 'inline-radio' },
      options: [1, 2],
    },
  },
  decorators: [
    Story => (
      <div className="w-[480px]">
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<DataKeysAndValuesProps>;

export const Default: Story = {
  args: {
    numOfCol: 1,
  },
  render: args => (
    <DataKeysAndValues {...args}>
      <DataKeysAndValues.Key>Status</DataKeysAndValues.Key>
      <DataKeysAndValues.Value>Running</DataKeysAndValues.Value>
      <DataKeysAndValues.Key>Duration</DataKeysAndValues.Key>
      <DataKeysAndValues.Value>1.23s</DataKeysAndValues.Value>
      <DataKeysAndValues.Key>Model</DataKeysAndValues.Key>
      <DataKeysAndValues.Value>gpt-4o</DataKeysAndValues.Value>
    </DataKeysAndValues>
  ),
};

export const TwoColumns: Story = {
  args: {
    numOfCol: 2,
  },
  render: args => (
    <DataKeysAndValues {...args}>
      <DataKeysAndValues.Key>Status</DataKeysAndValues.Key>
      <DataKeysAndValues.Value>Running</DataKeysAndValues.Value>
      <DataKeysAndValues.Key>Duration</DataKeysAndValues.Key>
      <DataKeysAndValues.Value>1.23s</DataKeysAndValues.Value>
      <DataKeysAndValues.Key>Model</DataKeysAndValues.Key>
      <DataKeysAndValues.Value>gpt-4o</DataKeysAndValues.Value>
      <DataKeysAndValues.Key>Tokens</DataKeysAndValues.Key>
      <DataKeysAndValues.Value>2,451</DataKeysAndValues.Value>
    </DataKeysAndValues>
  ),
};

export const WithHeader: Story = {
  args: {
    numOfCol: 1,
  },
  render: args => (
    <DataKeysAndValues {...args}>
      <DataKeysAndValues.Header>General</DataKeysAndValues.Header>
      <DataKeysAndValues.Key>Status</DataKeysAndValues.Key>
      <DataKeysAndValues.Value>Running</DataKeysAndValues.Value>
      <DataKeysAndValues.Key>Duration</DataKeysAndValues.Key>
      <DataKeysAndValues.Value>1.23s</DataKeysAndValues.Value>
      <DataKeysAndValues.Header>Model</DataKeysAndValues.Header>
      <DataKeysAndValues.Key>Name</DataKeysAndValues.Key>
      <DataKeysAndValues.Value>gpt-4o</DataKeysAndValues.Value>
      <DataKeysAndValues.Key>Tokens</DataKeysAndValues.Key>
      <DataKeysAndValues.Value>2,451</DataKeysAndValues.Value>
    </DataKeysAndValues>
  ),
};

export const WithHeaderTwoColumns: Story = {
  args: {
    numOfCol: 2,
  },
  render: args => (
    <DataKeysAndValues {...args}>
      <DataKeysAndValues.Header>Span Details</DataKeysAndValues.Header>
      <DataKeysAndValues.Key>Status</DataKeysAndValues.Key>
      <DataKeysAndValues.Value>Running</DataKeysAndValues.Value>
      <DataKeysAndValues.Key>Duration</DataKeysAndValues.Key>
      <DataKeysAndValues.Value>1.23s</DataKeysAndValues.Value>
      <DataKeysAndValues.Key>Model</DataKeysAndValues.Key>
      <DataKeysAndValues.Value>gpt-4o</DataKeysAndValues.Value>
      <DataKeysAndValues.Key>Tokens</DataKeysAndValues.Key>
      <DataKeysAndValues.Value>2,451</DataKeysAndValues.Value>
    </DataKeysAndValues>
  ),
};

export const TruncatedValues: Story = {
  decorators: [
    Story => (
      <div className="w-[200px]">
        <Story />
      </div>
    ),
  ],
  render: () => (
    <DataKeysAndValues>
      <DataKeysAndValues.Key>Trace ID</DataKeysAndValues.Key>
      <DataKeysAndValues.Value>abc123def456ghi789jkl012mno345pqr678stu901vwx234</DataKeysAndValues.Value>
      <DataKeysAndValues.Key>Span ID</DataKeysAndValues.Key>
      <DataKeysAndValues.Value>span-001-very-long-identifier-that-should-truncate</DataKeysAndValues.Value>
    </DataKeysAndValues>
  ),
};

const StoryLink = forwardRef<HTMLAnchorElement, LinkComponentProps>(({ href, children, ...props }, ref) => (
  <a ref={ref} href={href} {...props}>
    {children}
  </a>
));

export const ValueLink: Story = {
  render: () => (
    <DataKeysAndValues>
      <DataKeysAndValues.Key>Agent</DataKeysAndValues.Key>
      <DataKeysAndValues.ValueLink href="/agents/my-agent" LinkComponent={StoryLink}>
        my-agent
      </DataKeysAndValues.ValueLink>
      <DataKeysAndValues.Key>Workflow</DataKeysAndValues.Key>
      <DataKeysAndValues.ValueLink href="/workflows/data-pipeline" LinkComponent={StoryLink}>
        data-pipeline
      </DataKeysAndValues.ValueLink>
    </DataKeysAndValues>
  ),
};

export const ValueWithTooltip: Story = {
  decorators: [
    Story => (
      <TooltipProvider>
        <div>
          <Story />
        </div>
      </TooltipProvider>
    ),
  ],
  render: () => (
    <DataKeysAndValues>
      <DataKeysAndValues.Key>Trace ID</DataKeysAndValues.Key>
      <DataKeysAndValues.ValueWithTooltip tooltip="abc123def456ghi789jkl012mno345pqr678stu901vwx234">
        abc123def456ghi7...
      </DataKeysAndValues.ValueWithTooltip>
      <DataKeysAndValues.Key>Status</DataKeysAndValues.Key>
      <DataKeysAndValues.ValueWithTooltip tooltip="Completed successfully with no errors">
        Completed
      </DataKeysAndValues.ValueWithTooltip>
    </DataKeysAndValues>
  ),
};

export const ValueWithCopyBtn: Story = {
  decorators: [
    Story => (
      <TooltipProvider>
        <Story />
      </TooltipProvider>
    ),
  ],
  render: () => (
    <DataKeysAndValues>
      <DataKeysAndValues.Key>Trace ID</DataKeysAndValues.Key>
      <DataKeysAndValues.ValueWithCopyBtn copyValue="abc123def456">abc123def456</DataKeysAndValues.ValueWithCopyBtn>
      <DataKeysAndValues.Key>Span ID</DataKeysAndValues.Key>
      <DataKeysAndValues.ValueWithCopyBtn copyValue="span-001-xyz">span-001-xyz</DataKeysAndValues.ValueWithCopyBtn>
      <DataKeysAndValues.Key>API Key</DataKeysAndValues.Key>
      <DataKeysAndValues.ValueWithCopyBtn copyValue="sk-1234" copyTooltip="Copy API key">
        sk-1234
      </DataKeysAndValues.ValueWithCopyBtn>
    </DataKeysAndValues>
  ),
};

export const MixedValueTypes: Story = {
  decorators: [
    Story => (
      <TooltipProvider>
        <Story />
      </TooltipProvider>
    ),
  ],
  render: () => (
    <DataKeysAndValues>
      <DataKeysAndValues.Key>Status</DataKeysAndValues.Key>
      <DataKeysAndValues.Value>Running</DataKeysAndValues.Value>
      <DataKeysAndValues.Key>Agent</DataKeysAndValues.Key>
      <DataKeysAndValues.ValueLink href="/agents/my-agent" LinkComponent={StoryLink}>
        my-agent
      </DataKeysAndValues.ValueLink>
      <DataKeysAndValues.Key>Trace ID</DataKeysAndValues.Key>
      <DataKeysAndValues.ValueWithCopyBtn copyValue="abc123def456">abc123def456</DataKeysAndValues.ValueWithCopyBtn>
      <DataKeysAndValues.Key>Description</DataKeysAndValues.Key>
      <DataKeysAndValues.ValueWithTooltip tooltip="A very long description that gets truncated in the UI">
        A very long description that gets truncated in the UI
      </DataKeysAndValues.ValueWithTooltip>
    </DataKeysAndValues>
  ),
};

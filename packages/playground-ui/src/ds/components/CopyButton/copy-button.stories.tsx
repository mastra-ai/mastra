import type { Meta, StoryObj } from '@storybook/react-vite';
import { CopyButton } from './copy-button';
import { TooltipProvider } from '../Tooltip';

const meta: Meta<typeof CopyButton> = {
  title: 'Composite/CopyButton',
  component: CopyButton,
  decorators: [
    Story => (
      <TooltipProvider>
        <Story />
      </TooltipProvider>
    ),
  ],
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof CopyButton>;

export const Default: Story = {
  args: {
    content: 'Hello, World!',
  },
};

export const WithCustomTooltip: Story = {
  args: {
    content: 'npm install @mastra/core',
    tooltip: 'Copy command',
  },
};

export const WithCopyMessage: Story = {
  args: {
    content: 'agent-id-12345',
    copyMessage: 'Agent ID copied!',
  },
};

export const SmallIcon: Story = {
  args: {
    content: 'some-text',
    iconSize: 'sm',
  },
};

export const LargeIcon: Story = {
  args: {
    content: 'some-text',
    iconSize: 'lg',
  },
};

export const InContext: Story = {
  render: () => (
    <div className="flex items-center gap-2 p-3 bg-surface4 rounded-md">
      <code className="text-sm font-mono text-neutral5">npm install @mastra/core</code>
      <CopyButton content="npm install @mastra/core" />
    </div>
  ),
};

export const CodeBlock: Story = {
  render: () => (
    <div className="relative p-4 bg-surface4 rounded-md w-[300px]">
      <CopyButton content="const agent = new Agent()" className="absolute top-2 right-2" />
      <pre className="text-sm font-mono text-neutral5">const agent = new Agent()</pre>
    </div>
  ),
};

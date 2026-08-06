import type { Meta, StoryObj } from '@storybook/react-vite';
import { TooltipProvider } from '../Tooltip';
import { CopyButton } from './copy-button';

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

// export const SmallIcon: Story = {
//   args: {
//     content: 'some-text',
//     iconSize: 'sm',
//   },
// };

// export const LargeIcon: Story = {
//   args: {
//     content: 'some-text',
//     iconSize: 'lg',
//   },
// };

export const InContext: Story = {
  render: () => (
    <div className="bg-surface4 flex items-center gap-2 rounded-md p-3">
      <code className="text-neutral5 font-mono text-sm">npm install @mastra/core</code>
      <CopyButton content="npm install @mastra/core" />
    </div>
  ),
};

export const CodeBlock: Story = {
  render: () => (
    <div className="w-dropdown-max-height bg-surface4 relative rounded-md p-4">
      <CopyButton content="const agent = new Agent()" className="absolute top-2 right-2" />
      <pre className="text-neutral5 font-mono text-sm">const agent = new Agent()</pre>
    </div>
  ),
};

export const Sizes: Story = {
  render: () => (
    <div className="flex items-center gap-3">
      {(['sm', 'md', 'lg'] as const).map(size => (
        <CopyButton key={size} content="copy me" size={size} />
      ))}
    </div>
  ),
};

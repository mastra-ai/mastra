import type { Meta, StoryObj } from '@storybook/react-vite';
import { Button } from '../Button';
import { DropdownMenu } from '../DropdownMenu';
import { TooltipProvider } from '../Tooltip';
import { CopyButton } from './copy-button';
import { CopyIcon, CopyLabel } from './copy-feedback';

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

export const WithLabel: Story = {
  args: {
    content: 'Connect this project to Mastra.',
    children: 'Copy prompt',
  },
};

/** The menu stays open long enough to show "Copied" on the item, then closes. */
export const InMenu: Story = {
  render: () => (
    <DropdownMenu>
      <DropdownMenu.Trigger>Account</DropdownMenu.Trigger>
      <DropdownMenu.Content>
        <DropdownMenu.CopyItem value="org_01KJGEY54">Copy organization ID</DropdownMenu.CopyItem>
        <DropdownMenu.CopyItem value="acme">Copy organization slug</DropdownMenu.CopyItem>
      </DropdownMenu.Content>
    </DropdownMenu>
  ),
};

/** What a control shows before the copy, after it, and when the browser blocked it. */
export const Statuses: Story = {
  render: () => (
    <div className="flex flex-col gap-3">
      {(['idle', 'copied', 'failed'] as const).map(status => (
        <div key={status} className="flex items-center gap-3">
          <Button size="icon-md" aria-label="Copy prompt">
            <CopyIcon status={status} />
          </Button>
          <Button icon={<CopyIcon status={status} />}>
            <CopyLabel status={status}>Copy prompt</CopyLabel>
          </Button>
        </div>
      ))}
    </div>
  ),
};

// export const SmallIcon: Story = {
// args: {
// content: 'some-text',
// iconSize: 'sm',
// },
// };

// export const LargeIcon: Story = {
// args: {
// content: 'some-text',
// iconSize: 'lg',
// },
// };

export const InContext: Story = {
  render: () => (
    <div className="flex items-center gap-2 rounded-md bg-muted p-3">
      <code className="font-mono text-body text-foreground">npm install @mastra/core</code>
      <CopyButton content="npm install @mastra/core" />
    </div>
  ),
};

export const CodeBlock: Story = {
  render: () => (
    <div className="relative w-75 rounded-md bg-muted p-4">
      <CopyButton content="const agent = new Agent()" className="absolute top-2 right-2" />
      <pre className="font-mono text-body text-foreground">const agent = new Agent()</pre>
    </div>
  ),
};

export const Sizes: Story = {
  render: () => (
    <div className="flex items-center gap-3">
      {(['icon-sm', 'icon-md', 'icon-lg'] as const).map(size => (
        <CopyButton key={size} content="copy me" size={size} />
      ))}
    </div>
  ),
};

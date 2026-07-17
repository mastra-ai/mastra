import type { Meta, StoryObj } from '@storybook/react-vite';
import { Info, SaveIcon } from 'lucide-react';
import { Button } from '../Button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './tooltip';

const meta: Meta<typeof Tooltip> = {
  title: 'Elements/Tooltip',
  component: Tooltip,
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
type Story = StoryObj<typeof Tooltip>;

const KbdHint = ({ children }: { children: React.ReactNode }) => (
  <kbd className="ml-1 inline-flex items-center justify-center rounded-sm bg-surface5 px-1.5 py-0.5 font-mono text-ui-xs leading-ui-xs text-neutral4">
    {children}
  </kbd>
);

export const Default: Story = {
  render: () => (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button variant="outline">Hover me</Button>
      </TooltipTrigger>
      <TooltipContent>This is a tooltip</TooltipContent>
    </Tooltip>
  ),
};

export const WithKeyboardShortcut: Story = {
  render: () => (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button variant="outline" size="icon-md" aria-label="Save changes">
          <SaveIcon />
        </Button>
      </TooltipTrigger>
      <TooltipContent>
        Save changes
        <KbdHint>S</KbdHint>
      </TooltipContent>
    </Tooltip>
  ),
};

export const WithIcon: Story = {
  render: () => (
    <Tooltip>
      <TooltipTrigger asChild>
        <button className="rounded p-1 hover:bg-surface2" aria-label="More information">
          <Info className="size-4 text-neutral3" />
        </button>
      </TooltipTrigger>
      <TooltipContent>More information</TooltipContent>
    </Tooltip>
  ),
};

export const UsingRenderProp: Story = {
  render: () => (
    <Tooltip>
      <TooltipTrigger render={<Button variant="outline">Render prop</Button>} />
      <TooltipContent>
        Uses Base UI&apos;s native <code>render</code> prop instead of <code>asChild</code>.
      </TooltipContent>
    </Tooltip>
  ),
};

export const AllSides: Story = {
  render: () => (
    <div className="grid grid-cols-2 gap-8 p-12">
      {(['top', 'right', 'bottom', 'left'] as const).map(side => (
        <Tooltip key={side}>
          <TooltipTrigger asChild>
            <Button variant="outline" className="capitalize">
              {side}
            </Button>
          </TooltipTrigger>
          <TooltipContent side={side}>Tooltip on {side}</TooltipContent>
        </Tooltip>
      ))}
    </div>
  ),
};

export const TopSide: Story = {
  render: () => (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button variant="outline">Top tooltip</Button>
      </TooltipTrigger>
      <TooltipContent side="top">Tooltip on top</TooltipContent>
    </Tooltip>
  ),
};

export const RightSide: Story = {
  render: () => (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button variant="outline">Right tooltip</Button>
      </TooltipTrigger>
      <TooltipContent side="right">Tooltip on right</TooltipContent>
    </Tooltip>
  ),
};

export const BottomSide: Story = {
  render: () => (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button variant="outline">Bottom tooltip</Button>
      </TooltipTrigger>
      <TooltipContent side="bottom">Tooltip on bottom</TooltipContent>
    </Tooltip>
  ),
};

export const LeftSide: Story = {
  render: () => (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button variant="outline">Left tooltip</Button>
      </TooltipTrigger>
      <TooltipContent side="left">Tooltip on left</TooltipContent>
    </Tooltip>
  ),
};

export const LongContent: Story = {
  render: () => (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button variant="outline">Hover for details</Button>
      </TooltipTrigger>
      <TooltipContent className="max-w-50">
        This is a longer tooltip that contains more detailed information about the element.
      </TooltipContent>
    </Tooltip>
  ),
};

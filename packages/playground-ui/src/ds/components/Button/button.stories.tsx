import type { Meta, StoryObj } from '@storybook/react-vite';
import { Plus, Settings, Trash } from 'lucide-react';
import { TooltipProvider } from '../Tooltip';
import type { ButtonVariant } from './Button';
import { Button } from './Button';

const ALL_VARIANTS: ButtonVariant[] = ['default', 'primary', 'cta', 'outline', 'ghost', 'link'];

const meta: Meta<typeof Button> = {
  title: 'Elements/Button',
  component: Button,
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
  argTypes: {
    variant: {
      control: { type: 'select' },
      options: ALL_VARIANTS,
    },
    size: {
      control: { type: 'select' },
      options: ['sm', 'md', 'default', 'lg', 'icon-sm', 'icon-md', 'icon-lg'],
    },
    disabled: {
      control: { type: 'boolean' },
    },
  },
};

export default meta;
type Story = StoryObj<typeof Button>;

export const Default: Story = {
  args: {
    children: 'Button',
  },
};

export const Variants: Story = {
  render: () => (
    <div className="flex flex-wrap items-center gap-4">
      {ALL_VARIANTS.map(variant => (
        <Button key={variant} variant={variant}>
          {variant}
        </Button>
      ))}
    </div>
  ),
};

export const Sizes: Story = {
  render: () => (
    <div className="flex items-center gap-4">
      <Button size="sm">Small</Button>
      <Button size="md">Medium</Button>
      <Button size="default">Default</Button>
      <Button size="lg">Large</Button>
    </div>
  ),
};

export const Disabled: Story = {
  render: () => (
    <div className="flex flex-wrap items-center gap-4">
      {ALL_VARIANTS.map(variant => (
        <Button key={variant} variant={variant} disabled>
          {variant}
        </Button>
      ))}
    </div>
  ),
};

export const WithIcon: Story = {
  args: {
    children: (
      <>
        <Plus />
        Add Item
      </>
    ),
  },
};

export const WithTooltip: Story = {
  args: {
    children: 'Hover me',
    tooltip: 'I am a tooltip',
  },
};

export const IconAutoDetect: Story = {
  render: () => (
    <div className="flex items-center gap-4">
      {(['sm', 'md', 'default', 'lg'] as const).map(size => (
        <Button key={size} size={size}>
          <Settings />
        </Button>
      ))}
    </div>
  ),
};

export const IconButtonDefault: Story = {
  args: {
    children: <Settings />,
    tooltip: 'Settings',
    size: 'icon-md',
    variant: 'default',
  },
};

export const IconButtonVariants: Story = {
  render: () => (
    <div className="flex flex-wrap items-center gap-2">
      {ALL_VARIANTS.map(variant => (
        <Button key={variant} size="icon-md" variant={variant} tooltip={variant}>
          <Settings />
        </Button>
      ))}
    </div>
  ),
};

export const IconButtonSizes: Story = {
  render: () => (
    <div className="flex items-center gap-2">
      <Button size="icon-sm" tooltip="Small">
        <Settings />
      </Button>
      <Button size="icon-md" tooltip="Medium">
        <Settings />
      </Button>
      <Button size="icon-lg" tooltip="Large">
        <Settings />
      </Button>
    </div>
  ),
};

export const IconButtonDisabled: Story = {
  args: {
    children: <Settings />,
    tooltip: 'Settings (disabled)',
    size: 'icon-md',
    disabled: true,
  },
};

export const VariantSizeMatrix: Story = {
  render: () => (
    <div className="flex flex-col gap-3">
      {ALL_VARIANTS.map(variant => (
        <div key={variant} className="flex flex-wrap items-center gap-3">
          <span className="text-ui-sm text-neutral3 w-24">{variant}</span>
          <Button variant={variant} size="sm">
            sm
          </Button>
          <Button variant={variant} size="md">
            md
          </Button>
          <Button variant={variant} size="default">
            default
          </Button>
          <Button variant={variant} size="lg">
            lg
          </Button>
          <Button variant={variant} size="default">
            <Trash />
            with icon
          </Button>
        </div>
      ))}
    </div>
  ),
};

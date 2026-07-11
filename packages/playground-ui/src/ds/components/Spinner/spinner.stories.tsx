import type { Meta, StoryObj } from '@storybook/react-vite';
import { Button } from '../Button';
import { Spinner } from './spinner';

const meta: Meta<typeof Spinner> = {
  title: 'Elements/Spinner',
  component: Spinner,
  parameters: {
    layout: 'centered',
    controls: {
      disable: true,
    },
  },
  argTypes: {
    size: {
      table: {
        disable: true,
      },
    },
    variant: {
      table: {
        disable: true,
      },
    },
    className: {
      table: {
        disable: true,
      },
    },
    'aria-label': {
      table: {
        disable: true,
      },
    },
    role: {
      table: {
        disable: true,
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof Spinner>;

export const Default: Story = {
  args: {},
};

export const Pulse: Story = {
  args: {
    variant: 'pulse',
  },
};

export const ClassNameColor: Story = {
  args: {
    className: 'text-neutral3',
  },
};

export const Small: Story = {
  args: {
    size: 'sm',
  },
};

export const InButton: Story = {
  render: () => (
    <Button>
      <Spinner />
      Loading...
    </Button>
  ),
};

export const Sizes: Story = {
  render: () => (
    <div className="flex items-center gap-4">
      <Spinner size="sm" />
      <Spinner />
    </div>
  ),
};

export const ClassNameSizeOverride: Story = {
  args: {
    className: 'size-3',
  },
};

export const AllVariants: Story = {
  render: () => (
    <div className="flex items-center gap-4">
      <Spinner />
      <Spinner variant="pulse" />
    </div>
  ),
};

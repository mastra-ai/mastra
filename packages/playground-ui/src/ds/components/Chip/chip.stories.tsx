import type { Meta, StoryObj } from '@storybook/react-vite';
import { Chip } from './chip';
import { StarIcon, ZapIcon, FlameIcon } from 'lucide-react';

const meta: Meta<typeof Chip> = {
  title: 'Elements/Chip',
  component: Chip,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {
    color: {
      control: { type: 'select' },
      options: ['gray', 'red', 'orange', 'blue', 'green'],
    },
    size: {
      control: { type: 'select' },
      options: ['small', 'default', 'large'],
    },
  },
};

export default meta;
type Story = StoryObj<typeof Chip>;

export const Default: Story = {
  args: {
    children: 'Latest',
  },
};

export const Colors: Story = {
  render: () => (
    <div className="flex items-center gap-2">
      <Chip color="gray">Gray</Chip>
      <Chip color="red">Red</Chip>
      <Chip color="orange">Orange</Chip>
      <Chip color="blue">Blue</Chip>
      <Chip color="green">Green</Chip>
    </div>
  ),
};

export const Sizes: Story = {
  render: () => (
    <div className="grid gap-3">
      <div className="flex gap-2 items-baseline">
        <Chip size="small">Small</Chip>
        <Chip size="default">Default</Chip>
        <Chip size="large">Large</Chip>
      </div>
      <div className="flex gap-2">
        <Chip size="small">Small</Chip>
        <Chip size="default">Default</Chip>
        <Chip size="large">Large</Chip>
      </div>
    </div>
  ),
};

export const WithIcons: Story = {
  render: () => (
    <div className="flex gap-2">
      <Chip size="small">
        <StarIcon /> Small
      </Chip>
      <Chip size="default">
        <ZapIcon /> Default
      </Chip>
      <Chip size="large">
        <FlameIcon /> Large
      </Chip>
    </div>
  ),
};

export const IconsOnly: Story = {
  render: () => (
    <div className="flex items-baseline gap-2">
      <Chip size="small">
        <StarIcon />
      </Chip>
      <Chip size="default">
        <ZapIcon />
      </Chip>
      <Chip size="large">
        <FlameIcon />
      </Chip>
    </div>
  ),
};

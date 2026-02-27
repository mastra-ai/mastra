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
      options: ['gray', 'red', 'orange', 'blue', 'green', 'purple', 'yellow', 'cyan', 'pink'],
    },
    size: {
      control: { type: 'select' },
      options: ['small', 'default', 'large'],
    },
    intensity: {
      control: { type: 'select' },
      options: ['bright', 'muted'],
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
      <Chip color="purple">Purple</Chip>
      <Chip color="yellow">Yellow</Chip>
      <Chip color="cyan">Cyan</Chip>
      <Chip color="pink">Pink</Chip>
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

export const Intensity: Story = {
  render: () => (
    <div className="grid gap-3">
      <div className="flex items-center gap-2">
        <Chip color="purple">Bright</Chip>
        <Chip color="purple" intensity="muted">
          Muted
        </Chip>
      </div>
      <div className="flex items-center gap-2">
        <Chip color="cyan">Bright</Chip>
        <Chip color="cyan" intensity="muted">
          Muted
        </Chip>
      </div>
      <div className="flex items-center gap-2">
        <Chip color="green">Bright</Chip>
        <Chip color="green" intensity="muted">
          Muted
        </Chip>
      </div>
      <div className="flex items-center gap-2">
        <Chip color="red">Bright</Chip>
        <Chip color="red" intensity="muted">
          Muted
        </Chip>
      </div>
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

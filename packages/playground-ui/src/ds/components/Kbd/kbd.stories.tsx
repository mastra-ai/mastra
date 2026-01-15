import type { Meta, StoryObj } from '@storybook/react-vite';
import { Kbd } from './kbd';

const meta: Meta<typeof Kbd> = {
  title: 'Elements/Kbd',
  component: Kbd,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {
    theme: {
      control: { type: 'select' },
      options: ['light', 'dark'],
    },
  },
};

export default meta;
type Story = StoryObj<typeof Kbd>;

export const Default: Story = {
  args: {
    children: 'K',
    theme: 'dark',
  },
};

export const Light: Story = {
  args: {
    children: 'K',
    theme: 'light',
  },
};

export const Dark: Story = {
  args: {
    children: 'K',
    theme: 'dark',
  },
};

export const ModifierKey: Story = {
  args: {
    children: 'Ctrl',
  },
};

export const KeyCombination: Story = {
  render: () => (
    <div className="flex items-center gap-1">
      <Kbd>Ctrl</Kbd>
      <span className="text-neutral3">+</span>
      <Kbd>K</Kbd>
    </div>
  ),
};

export const CommonShortcuts: Story = {
  render: () => (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1">
          <Kbd>Ctrl</Kbd>
          <span className="text-neutral3">+</span>
          <Kbd>C</Kbd>
        </div>
        <span className="text-neutral5">Copy</span>
      </div>
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1">
          <Kbd>Ctrl</Kbd>
          <span className="text-neutral3">+</span>
          <Kbd>V</Kbd>
        </div>
        <span className="text-neutral5">Paste</span>
      </div>
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1">
          <Kbd>Ctrl</Kbd>
          <span className="text-neutral3">+</span>
          <Kbd>Z</Kbd>
        </div>
        <span className="text-neutral5">Undo</span>
      </div>
    </div>
  ),
};

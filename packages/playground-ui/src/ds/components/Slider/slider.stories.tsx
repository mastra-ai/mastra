import type { Meta, StoryObj } from '@storybook/react-vite';
import { Slider } from './slider';

const meta: Meta<typeof Slider> = {
  title: 'Elements/Slider',
  component: Slider,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {
    disabled: {
      control: { type: 'boolean' },
    },
  },
};

export default meta;
type Story = StoryObj<typeof Slider>;

export const Default: Story = {
  args: {
    defaultValue: [50],
    max: 100,
    step: 1,
    className: 'w-[200px]',
  },
};

export const WithRange: Story = {
  args: {
    defaultValue: [25, 75],
    max: 100,
    step: 1,
    className: 'w-[200px]',
  },
};

export const Disabled: Story = {
  args: {
    defaultValue: [50],
    max: 100,
    disabled: true,
    className: 'w-[200px]',
  },
};

export const CustomRange: Story = {
  args: {
    defaultValue: [0],
    min: -10,
    max: 10,
    step: 1,
    className: 'w-[200px]',
  },
};

export const FineGrained: Story = {
  args: {
    defaultValue: [0.5],
    min: 0,
    max: 1,
    step: 0.01,
    className: 'w-[200px]',
  },
};

export const WithLabel: Story = {
  render: () => (
    <div className="flex flex-col gap-2 w-[250px]">
      <div className="flex justify-between">
        <span className="text-sm text-icon5">Volume</span>
        <span className="text-sm text-icon3">50%</span>
      </div>
      <Slider defaultValue={[50]} max={100} step={1} />
    </div>
  ),
};

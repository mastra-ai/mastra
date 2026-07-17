import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { Slider } from './slider';

const meta: Meta<typeof Slider> = {
  title: 'Elements/Slider',
  component: Slider,
  parameters: {
    layout: 'centered',
  },
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
    className: 'w-[240px]',
  },
};

export const WithRange: Story = {
  args: {
    defaultValue: [25, 75],
    max: 100,
    step: 1,
    className: 'w-[240px]',
  },
};

export const ThreeThumbs: Story = {
  args: {
    defaultValue: [10, 50, 90],
    max: 100,
    step: 1,
    className: 'w-[240px]',
  },
};

export const Disabled: Story = {
  args: {
    defaultValue: [50],
    max: 100,
    disabled: true,
    className: 'w-[240px]',
  },
};

export const CustomRange: Story = {
  args: {
    defaultValue: [0],
    min: -10,
    max: 10,
    step: 1,
    className: 'w-[240px]',
  },
};

export const FineGrained: Story = {
  args: {
    defaultValue: [0.5],
    min: 0,
    max: 1,
    step: 0.01,
    className: 'w-[240px]',
  },
};

export const WithLabel: Story = {
  render: () => {
    const [value, setValue] = useState<number[]>([50]);
    return (
      <div className="w-70 flex flex-col gap-2">
        <div className="flex justify-between">
          <span className="text-sm text-neutral5">Volume</span>
          <span className="text-sm text-neutral3 tabular-nums">{value[0]}%</span>
        </div>
        <Slider value={value} max={100} step={1} onValueChange={setValue} />
      </div>
    );
  },
};

export const PriceRange: Story = {
  render: () => {
    const [value, setValue] = useState<number[]>([200, 800]);
    return (
      <div className="w-70 flex flex-col gap-2">
        <div className="flex justify-between">
          <span className="text-sm text-neutral5">Price range</span>
          <span className="text-sm text-neutral3 tabular-nums">
            ${value[0]} – ${value[1]}
          </span>
        </div>
        <Slider value={value} min={0} max={1000} step={10} onValueChange={setValue} />
      </div>
    );
  },
};

export const Vertical: Story = {
  args: {
    defaultValue: [60],
    max: 100,
    step: 1,
    orientation: 'vertical',
    className: 'h-[160px]',
  },
};

export const States: Story = {
  render: () => (
    <div className="w-70 flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <span className="text-sm text-neutral5">Default</span>
        <Slider defaultValue={[40]} max={100} step={1} />
      </div>
      <div className="flex flex-col gap-2">
        <span className="text-sm text-neutral5">Range</span>
        <Slider defaultValue={[20, 80]} max={100} step={1} />
      </div>
      <div className="flex flex-col gap-2">
        <span className="text-sm text-neutral5">Disabled</span>
        <Slider defaultValue={[50]} max={100} step={1} disabled />
      </div>
      <div className="flex flex-col gap-2">
        <span className="text-sm text-neutral5">Disabled range</span>
        <Slider defaultValue={[20, 80]} max={100} step={1} disabled />
      </div>
    </div>
  ),
};

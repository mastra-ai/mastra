import type { Meta, StoryObj } from '@storybook/react-vite';
import { Popover, PopoverContent, PopoverTrigger } from './popover';
import { Button } from '../Button';
import { Input } from '../Input';
import { Label } from '../Label';
import { Settings } from 'lucide-react';

const meta: Meta<typeof Popover> = {
  title: 'Feedback/Popover',
  component: Popover,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof Popover>;

export const Default: Story = {
  render: () => (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline">Open Popover</Button>
      </PopoverTrigger>
      <PopoverContent>
        <div className="grid gap-4">
          <div className="space-y-2">
            <h4 className="font-medium leading-none">Dimensions</h4>
            <p className="text-sm text-icon3">Set the dimensions for the layer.</p>
          </div>
          <div className="grid gap-2">
            <div className="grid grid-cols-3 items-center gap-4">
              <Label htmlFor="width">Width</Label>
              <Input id="width" defaultValue="100%" className="col-span-2 h-8" />
            </div>
            <div className="grid grid-cols-3 items-center gap-4">
              <Label htmlFor="height">Height</Label>
              <Input id="height" defaultValue="25px" className="col-span-2 h-8" />
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  ),
};

export const WithIconTrigger: Story = {
  render: () => (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="md">
          <Settings className="h-4 w-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80">
        <div className="grid gap-4">
          <div className="space-y-2">
            <h4 className="font-medium leading-none">Settings</h4>
            <p className="text-sm text-icon3">Manage your preferences.</p>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  ),
};

export const AlignStart: Story = {
  render: () => (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline">Align Start</Button>
      </PopoverTrigger>
      <PopoverContent align="start">
        <p className="text-sm">This popover is aligned to the start.</p>
      </PopoverContent>
    </Popover>
  ),
};

export const AlignEnd: Story = {
  render: () => (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline">Align End</Button>
      </PopoverTrigger>
      <PopoverContent align="end">
        <p className="text-sm">This popover is aligned to the end.</p>
      </PopoverContent>
    </Popover>
  ),
};

export const SideTop: Story = {
  render: () => (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline">Open Above</Button>
      </PopoverTrigger>
      <PopoverContent side="top">
        <p className="text-sm">This popover opens above the trigger.</p>
      </PopoverContent>
    </Popover>
  ),
};

export const SideRight: Story = {
  render: () => (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline">Open Right</Button>
      </PopoverTrigger>
      <PopoverContent side="right">
        <p className="text-sm">This popover opens to the right.</p>
      </PopoverContent>
    </Popover>
  ),
};

export const SimpleText: Story = {
  render: () => (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost">?</Button>
      </PopoverTrigger>
      <PopoverContent className="w-60">
        <p className="text-sm text-icon5">This is helpful information about the feature.</p>
      </PopoverContent>
    </Popover>
  ),
};

import type { Meta, StoryObj } from '@storybook/react-vite';
import { RadioGroup, RadioGroupItem } from './radio-group';
import { Label } from '../Label';

const meta: Meta<typeof RadioGroup> = {
  title: 'Elements/RadioGroup',
  component: RadioGroup,
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
type Story = StoryObj<typeof RadioGroup>;

export const Default: Story = {
  render: args => (
    <RadioGroup defaultValue="option-1" {...args}>
      <div className="flex items-center space-x-2">
        <RadioGroupItem value="option-1" id="option-1" />
        <Label htmlFor="option-1" className="text-neutral6">
          Option 1
        </Label>
      </div>
      <div className="flex items-center space-x-2">
        <RadioGroupItem value="option-2" id="option-2" />
        <Label htmlFor="option-2" className="text-neutral6">
          Option 2
        </Label>
      </div>
      <div className="flex items-center space-x-2">
        <RadioGroupItem value="option-3" id="option-3" />
        <Label htmlFor="option-3" className="text-neutral6">
          Option 3
        </Label>
      </div>
    </RadioGroup>
  ),
};

export const Disabled: Story = {
  render: () => (
    <RadioGroup defaultValue="option-1" disabled>
      <div className="flex items-center space-x-2">
        <RadioGroupItem value="option-1" id="disabled-1" />
        <Label htmlFor="disabled-1" className="text-neutral6">
          Option 1
        </Label>
      </div>
      <div className="flex items-center space-x-2">
        <RadioGroupItem value="option-2" id="disabled-2" />
        <Label htmlFor="disabled-2" className="text-neutral6">
          Option 2
        </Label>
      </div>
    </RadioGroup>
  ),
};

export const Horizontal: Story = {
  render: () => (
    <RadioGroup defaultValue="small" className="flex flex-row gap-4">
      <div className="flex items-center space-x-2">
        <RadioGroupItem value="small" id="small" />
        <Label htmlFor="small" className="text-neutral6">
          Small
        </Label>
      </div>
      <div className="flex items-center space-x-2">
        <RadioGroupItem value="medium" id="medium" />
        <Label htmlFor="medium" className="text-neutral6">
          Medium
        </Label>
      </div>
      <div className="flex items-center space-x-2">
        <RadioGroupItem value="large" id="large" />
        <Label htmlFor="large" className="text-neutral6">
          Large
        </Label>
      </div>
    </RadioGroup>
  ),
};

export const WithDescriptions: Story = {
  render: () => (
    <RadioGroup defaultValue="startup">
      <div className="flex items-start space-x-2">
        <RadioGroupItem value="startup" id="startup" className="mt-1" />
        <div className="grid gap-1">
          <Label htmlFor="startup" className="text-neutral6">
            Startup
          </Label>
          <p className="text-xs text-neutral3">Best for small teams just getting started</p>
        </div>
      </div>
      <div className="flex items-start space-x-2">
        <RadioGroupItem value="business" id="business" className="mt-1" />
        <div className="grid gap-1">
          <Label htmlFor="business" className="text-neutral6">
            Business
          </Label>
          <p className="text-xs text-neutral3">For growing companies with advanced needs</p>
        </div>
      </div>
      <div className="flex items-start space-x-2">
        <RadioGroupItem value="enterprise" id="enterprise" className="mt-1" />
        <div className="grid gap-1">
          <Label htmlFor="enterprise" className="text-neutral6">
            Enterprise
          </Label>
          <p className="text-xs text-neutral3">For large organizations requiring customization</p>
        </div>
      </div>
    </RadioGroup>
  ),
};

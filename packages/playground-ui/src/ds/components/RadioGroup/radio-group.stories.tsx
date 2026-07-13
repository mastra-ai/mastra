import type { Meta, StoryObj } from '@storybook/react-vite';
import type { ReactNode } from 'react';
import { Label } from '../Label';
import { RadioGroup, RadioGroupItem } from './radio-group';

const SURFACES: { token: string; label: string; className: string }[] = [
  { token: 'surface1', label: 'surface1 · 0% (studio shell)', className: 'bg-surface1' },
  { token: 'surface2', label: 'surface2 · 16% (main frame)', className: 'bg-surface2' },
  { token: 'surface3', label: 'surface3 · 18%', className: 'bg-surface3' },
  { token: 'surface4', label: 'surface4 · 22%', className: 'bg-surface4' },
];

function SurfaceFrame({ className, label, children }: { className: string; label: string; children: ReactNode }) {
  return (
    <div className={`rounded-2xl border border-border1 p-5 ${className}`}>
      <p className="mb-4 text-ui-xs tracking-wide text-neutral3 uppercase">{label}</p>
      {children}
    </div>
  );
}

function RadioPreview({
  id,
  label,
  checked,
  disabled,
  className,
}: {
  id: string;
  label: string;
  checked?: boolean;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <RadioGroup aria-label={label} defaultValue={checked ? id : undefined} disabled={disabled}>
      <RadioGroupItem aria-label={label} value={id} id={id} className={className} />
    </RadioGroup>
  );
}

function RadioStateGrid({ idPrefix }: { idPrefix: string }) {
  return (
    <div className="grid grid-cols-[5rem_repeat(5,minmax(0,1fr))] items-center gap-x-4 gap-y-3 text-ui-sm text-neutral3">
      <span />
      <span>Default</span>
      <span>Selected</span>
      <span>Focus</span>
      <span>Disabled</span>
      <span>Disabled on</span>

      <span className="text-neutral5">State</span>
      <RadioPreview id={`${idPrefix}-default`} label={`${idPrefix} default`} />
      <RadioPreview id={`${idPrefix}-selected`} label={`${idPrefix} selected`} checked />
      <RadioPreview
        id={`${idPrefix}-focus`}
        label={`${idPrefix} focus preview`}
        checked
        className="border-neutral5/60 outline-1 outline-offset-2 outline-neutral5/55 outline-solid"
      />
      <RadioPreview id={`${idPrefix}-disabled`} label={`${idPrefix} disabled`} disabled />
      <RadioPreview id={`${idPrefix}-disabled-selected`} label={`${idPrefix} disabled selected`} checked disabled />
    </div>
  );
}

const meta: Meta<typeof RadioGroup> = {
  title: 'Elements/RadioGroup',
  component: RadioGroup,
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
type Story = StoryObj<typeof RadioGroup>;

export const Default: Story = {
  render: args => (
    <RadioGroup defaultValue="option-1" {...args}>
      <div className="flex items-center space-x-2">
        <RadioGroupItem value="option-1" id="option-1" />
        <Label htmlFor="option-1">Option 1</Label>
      </div>
      <div className="flex items-center space-x-2">
        <RadioGroupItem value="option-2" id="option-2" />
        <Label htmlFor="option-2">Option 2</Label>
      </div>
      <div className="flex items-center space-x-2">
        <RadioGroupItem value="option-3" id="option-3" />
        <Label htmlFor="option-3">Option 3</Label>
      </div>
    </RadioGroup>
  ),
};

export const Disabled: Story = {
  render: () => (
    <RadioGroup defaultValue="option-1" disabled>
      <div className="flex items-center space-x-2">
        <RadioGroupItem value="option-1" id="disabled-1" />
        <Label htmlFor="disabled-1">Option 1</Label>
      </div>
      <div className="flex items-center space-x-2">
        <RadioGroupItem value="option-2" id="disabled-2" />
        <Label htmlFor="disabled-2">Option 2</Label>
      </div>
    </RadioGroup>
  ),
};

export const AllStates: Story = {
  parameters: {
    layout: 'centered',
  },
  render: () => (
    <div className="grid min-w-md gap-4 rounded-lg border border-border1 bg-surface2 p-4">
      <RadioStateGrid idPrefix="all-states" />
    </div>
  ),
};

export const OnSurfaces: Story = {
  parameters: {
    layout: 'padded',
  },
  render: () => (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
      {SURFACES.map(({ token, label, className }) => (
        <SurfaceFrame key={token} className={className} label={label}>
          <RadioStateGrid idPrefix={token} />
        </SurfaceFrame>
      ))}
    </div>
  ),
};

export const Horizontal: Story = {
  render: () => (
    <RadioGroup defaultValue="small" className="flex flex-row gap-4">
      <div className="flex items-center space-x-2">
        <RadioGroupItem value="small" id="small" />
        <Label htmlFor="small">Small</Label>
      </div>
      <div className="flex items-center space-x-2">
        <RadioGroupItem value="medium" id="medium" />
        <Label htmlFor="medium">Medium</Label>
      </div>
      <div className="flex items-center space-x-2">
        <RadioGroupItem value="large" id="large" />
        <Label htmlFor="large">Large</Label>
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
          <Label htmlFor="startup">Startup</Label>
          <p className="text-xs text-neutral3">Best for small teams just getting started</p>
        </div>
      </div>
      <div className="flex items-start space-x-2">
        <RadioGroupItem value="business" id="business" className="mt-1" />
        <div className="grid gap-1">
          <Label htmlFor="business">Business</Label>
          <p className="text-xs text-neutral3">For growing companies with advanced needs</p>
        </div>
      </div>
      <div className="flex items-start space-x-2">
        <RadioGroupItem value="enterprise" id="enterprise" className="mt-1" />
        <div className="grid gap-1">
          <Label htmlFor="enterprise">Enterprise</Label>
          <p className="text-xs text-neutral3">For large organizations requiring customization</p>
        </div>
      </div>
    </RadioGroup>
  ),
};

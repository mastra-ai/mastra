import type { Meta, StoryObj } from '@storybook/react-vite';
import type { ReactNode } from 'react';
import { FieldContent, FieldDescription, FieldItem, FieldLabel } from '../Field';
import { RadioGroup, RadioGroupItem } from './radio-group';

const SURFACES: { token: string; label: string; className: string }[] = [
  { token: 'sidebar', label: 'sidebar · the recessed shell', className: 'bg-sidebar' },
  { token: 'background', label: 'background · the page canvas', className: 'bg-background' },
  { token: 'card', label: 'card · a raised surface', className: 'bg-card' },
  { token: 'muted', label: 'muted · the quiet step above the canvas', className: 'bg-muted' },
];

function SurfaceFrame({ className, label, children }: { className: string; label: string; children: ReactNode }) {
  return (
    <div className={`rounded-2xl border border-border p-5 ${className}`}>
      <p className="mb-4 text-meta tracking-wide text-muted-foreground uppercase">{label}</p>
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
      <RadioGroupItem aria-label={label} value={id} className={className} />
    </RadioGroup>
  );
}

function RadioStateGrid({ idPrefix }: { idPrefix: string }) {
  return (
    <div className="grid grid-cols-[5rem_repeat(5,minmax(0,1fr))] items-center gap-x-4 gap-y-3 text-caption text-muted-foreground">
      <span />
      <span>Default</span>
      <span>Selected</span>
      <span>Focus</span>
      <span>Disabled</span>
      <span>Disabled on</span>

      <span className="text-foreground">State</span>
      <RadioPreview id={`${idPrefix}-default`} label={`${idPrefix} default`} />
      <RadioPreview id={`${idPrefix}-selected`} label={`${idPrefix} selected`} checked />
      <RadioPreview
        id={`${idPrefix}-focus`}
        label={`${idPrefix} focus preview`}
        checked
        className="border-border-focus outline-1 outline-offset-2 outline-border-focus outline-solid"
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
      <FieldItem>
        <RadioGroupItem value="option-1" />
        <FieldLabel>Option 1</FieldLabel>
      </FieldItem>
      <FieldItem>
        <RadioGroupItem value="option-2" />
        <FieldLabel>Option 2</FieldLabel>
      </FieldItem>
      <FieldItem>
        <RadioGroupItem value="option-3" />
        <FieldLabel>Option 3</FieldLabel>
      </FieldItem>
    </RadioGroup>
  ),
};

export const Disabled: Story = {
  render: () => (
    <RadioGroup defaultValue="option-1" disabled>
      <FieldItem>
        <RadioGroupItem value="option-1" />
        <FieldLabel>Option 1</FieldLabel>
      </FieldItem>
      <FieldItem>
        <RadioGroupItem value="option-2" />
        <FieldLabel>Option 2</FieldLabel>
      </FieldItem>
    </RadioGroup>
  ),
};

export const AllStates: Story = {
  parameters: {
    layout: 'centered',
  },
  render: () => (
    <div className="grid min-w-md gap-4 rounded-lg border border-border bg-background p-4">
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
      <FieldItem>
        <RadioGroupItem value="small" />
        <FieldLabel>Small</FieldLabel>
      </FieldItem>
      <FieldItem>
        <RadioGroupItem value="medium" />
        <FieldLabel>Medium</FieldLabel>
      </FieldItem>
      <FieldItem>
        <RadioGroupItem value="large" />
        <FieldLabel>Large</FieldLabel>
      </FieldItem>
    </RadioGroup>
  ),
};

export const WithDescriptions: Story = {
  render: () => (
    <RadioGroup defaultValue="startup">
      <FieldItem className="items-start">
        <RadioGroupItem value="startup" className="mt-1" />
        <FieldContent className="gap-1">
          <FieldLabel>Startup</FieldLabel>
          <FieldDescription className="mt-0">Best for small teams just getting started</FieldDescription>
        </FieldContent>
      </FieldItem>
      <FieldItem className="items-start">
        <RadioGroupItem value="business" className="mt-1" />
        <FieldContent className="gap-1">
          <FieldLabel>Business</FieldLabel>
          <FieldDescription className="mt-0">For growing companies with advanced needs</FieldDescription>
        </FieldContent>
      </FieldItem>
      <FieldItem className="items-start">
        <RadioGroupItem value="enterprise" className="mt-1" />
        <FieldContent className="gap-1">
          <FieldLabel>Enterprise</FieldLabel>
          <FieldDescription className="mt-0">For large organizations requiring customization</FieldDescription>
        </FieldContent>
      </FieldItem>
    </RadioGroup>
  ),
};

import type { Meta, StoryObj } from '@storybook/react-vite';
import { Label } from '../Label';
import { Checkbox } from './checkbox';

const SURFACES: { token: string; label: string; className: string }[] = [
  { token: 'surface1', label: 'surface1 · 0% (studio shell)', className: 'bg-surface1' },
  { token: 'surface2', label: 'surface2 · 16% (main frame)', className: 'bg-surface2' },
  { token: 'surface3', label: 'surface3 · 18%', className: 'bg-surface3' },
  { token: 'surface4', label: 'surface4 · 22%', className: 'bg-surface4' },
];

function SurfaceFrame({ className, label, children }: { className: string; label: string; children: React.ReactNode }) {
  return (
    <div className={`border-border1 rounded-2xl border p-5 ${className}`}>
      <p className="text-ui-xs text-neutral3 mb-4 tracking-wide uppercase">{label}</p>
      {children}
    </div>
  );
}

function CheckboxStateGrid({ idPrefix }: { idPrefix: string }) {
  return (
    <div className="text-ui-sm text-neutral3 grid grid-cols-[5rem_repeat(5,minmax(0,1fr))] items-center gap-x-4 gap-y-3">
      <span />
      <span>Default</span>
      <span>Checked</span>
      <span>Mixed</span>
      <span>Disabled</span>
      <span>Disabled on</span>

      <span className="text-neutral5">State</span>
      <Checkbox aria-label={`${idPrefix} default`} />
      <Checkbox aria-label={`${idPrefix} checked`} checked onCheckedChange={() => {}} />
      <Checkbox aria-label={`${idPrefix} mixed`} checked="indeterminate" onCheckedChange={() => {}} />
      <Checkbox aria-label={`${idPrefix} disabled`} disabled />
      <Checkbox aria-label={`${idPrefix} disabled checked`} checked disabled onCheckedChange={() => {}} />
    </div>
  );
}

const meta: Meta<typeof Checkbox> = {
  title: 'Elements/Checkbox',
  component: Checkbox,
  parameters: {
    layout: 'centered',
  },
  argTypes: {
    disabled: {
      control: { type: 'boolean' },
    },
    checked: {
      control: { type: 'radio' },
      options: [false, true, 'indeterminate'],
    },
  },
};

export default meta;
type Story = StoryObj<typeof Checkbox>;

export const Default: Story = {
  args: {},
};

export const Checked: Story = {
  args: {
    checked: true,
  },
};

export const Disabled: Story = {
  args: {
    disabled: true,
  },
};

export const DisabledChecked: Story = {
  args: {
    disabled: true,
    checked: true,
  },
};

export const Indeterminate: Story = {
  args: {
    checked: 'indeterminate',
  },
};

export const AllStates: Story = {
  parameters: {
    layout: 'centered',
  },
  render: () => (
    <div className="border-border1 bg-surface2 grid min-w-104 gap-4 rounded-lg border p-4">
      <div className="text-ui-sm text-neutral3 grid grid-cols-[9rem_repeat(4,minmax(0,1fr))] items-center gap-x-5 gap-y-3">
        <span />
        <span>Default</span>
        <span>Checked</span>
        <span>Mixed</span>
        <span>Focus</span>

        <span className="text-neutral5">Enabled</span>
        <Checkbox aria-label="enabled unchecked" />
        <Checkbox aria-label="enabled checked" checked onCheckedChange={() => {}} />
        <Checkbox aria-label="enabled mixed" checked="indeterminate" onCheckedChange={() => {}} />
        <Checkbox
          aria-label="focused checked"
          checked
          onCheckedChange={() => {}}
          className="border-neutral5/60 outline-neutral5/55 outline-1 outline-offset-2 outline-solid"
        />

        <span className="text-neutral5">Disabled</span>
        <Checkbox aria-label="disabled unchecked" disabled />
        <Checkbox aria-label="disabled checked" checked disabled onCheckedChange={() => {}} />
        <Checkbox aria-label="disabled mixed" checked="indeterminate" disabled onCheckedChange={() => {}} />
        <Checkbox
          aria-label="disabled focus preview"
          checked
          disabled
          onCheckedChange={() => {}}
          className="border-neutral5/60 outline-neutral5/35 outline-1 outline-offset-2 outline-solid"
        />
      </div>
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
          <CheckboxStateGrid idPrefix={token} />
        </SurfaceFrame>
      ))}
    </div>
  ),
};

export const WithLabel: Story = {
  render: args => (
    <div className="flex items-center gap-2">
      <Checkbox id="terms" {...args} />
      <Label htmlFor="terms">Accept terms and conditions</Label>
    </div>
  ),
};

export const CheckboxGroup: Story = {
  render: () => (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <Checkbox id="option1" />
        <Label htmlFor="option1">Option 1</Label>
      </div>
      <div className="flex items-center gap-2">
        <Checkbox id="option2" defaultChecked />
        <Label htmlFor="option2">Option 2</Label>
      </div>
      <div className="flex items-center gap-2">
        <Checkbox id="option3" />
        <Label htmlFor="option3">Option 3</Label>
      </div>
    </div>
  ),
};

import type { Meta, StoryObj } from '@storybook/react-vite';
import { Label } from '../Label';
import { Switch } from './switch';

const SURFACES: { token: string; label: string; className: string }[] = [
  { token: 'surface1', label: 'surface1 · 0% (studio shell)', className: 'bg-surface1' },
  { token: 'surface2', label: 'surface2 · 16% (main frame)', className: 'bg-surface2' },
  { token: 'surface3', label: 'surface3 · 18%', className: 'bg-surface3' },
  { token: 'surface4', label: 'surface4 · 22%', className: 'bg-surface4' },
];

function SurfaceFrame({ className, label, children }: { className: string; label: string; children: React.ReactNode }) {
  return (
    <div className={`rounded-2xl border border-border1 p-5 ${className}`}>
      <p className="mb-4 text-ui-xs uppercase tracking-wide text-neutral3">{label}</p>
      {children}
    </div>
  );
}

function SwitchStateGrid({ idPrefix }: { idPrefix: string }) {
  return (
    <div className="grid grid-cols-[5rem_repeat(4,minmax(0,1fr))] items-center gap-x-4 gap-y-3 text-ui-sm text-neutral3">
      <span />
      <span>Default</span>
      <span>On</span>
      <span>Disabled</span>
      <span>Disabled on</span>

      <span className="text-neutral5">State</span>
      <Switch aria-label={`${idPrefix} default`} />
      <Switch aria-label={`${idPrefix} on`} checked onCheckedChange={() => {}} />
      <Switch aria-label={`${idPrefix} disabled`} disabled />
      <Switch aria-label={`${idPrefix} disabled on`} checked disabled onCheckedChange={() => {}} />
    </div>
  );
}

const meta: Meta<typeof Switch> = {
  title: 'Elements/Switch',
  component: Switch,
  parameters: {
    layout: 'centered',
  },
  argTypes: {
    disabled: {
      control: { type: 'boolean' },
    },
    checked: {
      control: { type: 'boolean' },
    },
  },
};

export default meta;
type Story = StoryObj<typeof Switch>;

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

export const AllStates: Story = {
  parameters: {
    layout: 'centered',
  },
  render: () => (
    <div className="grid min-w-[27rem] gap-4 rounded-lg border border-border1 bg-surface2 p-4">
      <div className="grid grid-cols-[9rem_repeat(3,minmax(0,1fr))] items-center gap-x-5 gap-y-3 text-ui-sm text-neutral3">
        <span />
        <span>Default</span>
        <span>On</span>
        <span>Focus</span>

        <span className="text-neutral5">Enabled</span>
        <Switch aria-label="enabled off" />
        <Switch aria-label="enabled on" checked onCheckedChange={() => {}} />
        <Switch
          aria-label="focused on"
          checked
          onCheckedChange={() => {}}
          className="border-neutral5/60 outline outline-1 outline-offset-2 outline-neutral5/55"
        />

        <span className="text-neutral5">Disabled</span>
        <Switch aria-label="disabled off" disabled />
        <Switch aria-label="disabled on" checked disabled onCheckedChange={() => {}} />
        <Switch
          aria-label="disabled focus preview"
          checked
          disabled
          onCheckedChange={() => {}}
          className="border-neutral5/50 outline outline-1 outline-offset-2 outline-neutral5/35"
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
          <SwitchStateGrid idPrefix={token} />
        </SurfaceFrame>
      ))}
    </div>
  ),
};

export const WithLabel: Story = {
  render: args => (
    <div className="flex items-center gap-2">
      <Switch id="notifications" {...args} />
      <Label htmlFor="notifications">Enable notifications</Label>
    </div>
  ),
};

export const SettingsList: Story = {
  render: () => (
    <div className="flex flex-col gap-4 w-dropdown-max-height">
      <div className="flex items-center justify-between">
        <Label htmlFor="email">Email notifications</Label>
        <Switch id="email" defaultChecked />
      </div>
      <div className="flex items-center justify-between">
        <Label htmlFor="push">Push notifications</Label>
        <Switch id="push" />
      </div>
      <div className="flex items-center justify-between">
        <Label htmlFor="sms">SMS notifications</Label>
        <Switch id="sms" disabled />
      </div>
    </div>
  ),
};

export const WithDescription: Story = {
  render: () => (
    <div className="flex items-start justify-between gap-4 w-[350px]">
      <div className="flex flex-col gap-1">
        <Label htmlFor="dark-mode">Dark mode</Label>
        <span className="text-xs text-neutral3">Switch to a darker color scheme</span>
      </div>
      <Switch id="dark-mode" />
    </div>
  ),
};

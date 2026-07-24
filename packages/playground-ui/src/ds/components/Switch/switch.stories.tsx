import type { Meta, StoryObj } from '@storybook/react-vite';
import { GlobeIcon, LockKeyhole, ZapIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { useState } from 'react';
import { Label } from '../Label';
import type { SwitchProps } from './switch';
import { Switch } from './switch';

const SURFACES: { token: string; label: string; className: string }[] = [
  { token: 'surface1', label: 'surface1 · 0% (studio shell)', className: 'bg-surface1' },
  { token: 'surface2', label: 'surface2 · 16% (main frame)', className: 'bg-surface2' },
  { token: 'surface3', label: 'surface3 · 18%', className: 'bg-surface3' },
  { token: 'surface4', label: 'surface4 · 22%', className: 'bg-surface4' },
];

type SwitchIconProps = Pick<SwitchProps, 'checkedIcon' | 'icon' | 'uncheckedIcon'>;

const visibilityIcons: SwitchIconProps = {
  checkedIcon: <LockKeyhole />,
  uncheckedIcon: <GlobeIcon />,
};

const withIconSource = `import { Switch } from '@mastra/playground-ui/components/Switch';
import { ZapIcon } from 'lucide-react';

<Switch aria-label="Enable boost" icon={<ZapIcon />} />;`;

const withStateIconsSource = `import { Label } from '@mastra/playground-ui/components/Label';
import { Switch } from '@mastra/playground-ui/components/Switch';
import { GlobeIcon, LockKeyhole } from 'lucide-react';
import { useState } from 'react';

function RepositoryVisibilitySwitch() {
  const [isPrivate, setIsPrivate] = useState(true);

  return (
    <div className="flex items-center justify-between gap-4">
      <Label htmlFor="repository-visibility">Repository visibility</Label>
      <span className="inline-flex items-center gap-2">
        <span>{isPrivate ? 'Private' : 'Public'}</span>
        <Switch
          id="repository-visibility"
          checked={isPrivate}
          onCheckedChange={setIsPrivate}
          aria-label="Private repository"
          checkedIcon={<LockKeyhole />}
          uncheckedIcon={<GlobeIcon />}
        />
      </span>
    </div>
  );
}`;

function SurfaceFrame({ className, label, children }: { className: string; label: string; children: ReactNode }) {
  return (
    <div className={`rounded-2xl border border-border1/70 p-5 ${className}`}>
      <p className="mb-4 text-ui-xs tracking-wide text-neutral3 uppercase">{label}</p>
      {children}
    </div>
  );
}

function SwitchStateGrid({ idPrefix, icons }: { idPrefix: string; icons?: SwitchIconProps }) {
  return (
    <div className="grid grid-cols-[5rem_repeat(4,minmax(0,1fr))] items-center gap-x-4 gap-y-3 text-ui-sm text-neutral3">
      <span />
      <span>Default</span>
      <span>On</span>
      <span>Disabled</span>
      <span>Disabled on</span>

      <span className="text-neutral5">State</span>
      <Switch aria-label={`${idPrefix} default`} {...icons} />
      <Switch aria-label={`${idPrefix} on`} checked onCheckedChange={() => {}} {...icons} />
      <Switch aria-label={`${idPrefix} disabled`} disabled {...icons} />
      <Switch aria-label={`${idPrefix} disabled on`} checked disabled onCheckedChange={() => {}} {...icons} />
    </div>
  );
}

function RepositoryVisibilitySwitch() {
  const [isPrivate, setIsPrivate] = useState(true);

  return (
    <div className="grid gap-4 rounded-lg bg-surface2 p-4">
      <div className="flex items-center justify-between gap-4">
        <Label htmlFor="repository-visibility-icons">Repository visibility</Label>
        <span className="inline-flex items-center gap-2">
          <span className="text-neutral7 text-ui-sm font-medium">{isPrivate ? 'Private' : 'Public'}</span>
          <Switch
            id="repository-visibility-icons"
            checked={isPrivate}
            onCheckedChange={setIsPrivate}
            aria-label="Private repository"
            {...visibilityIcons}
          />
        </span>
      </div>
      <SwitchStateGrid idPrefix="visibility icon" icons={visibilityIcons} />
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
    icon: {
      control: false,
      description: 'Any React node rendered inside the thumb for both checked and unchecked states.',
    },
    checkedIcon: {
      control: false,
      description: 'Any React node rendered inside the thumb when the switch is checked.',
    },
    uncheckedIcon: {
      control: false,
      description: 'Any React node rendered inside the thumb when the switch is unchecked.',
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

export const WithIcon: Story = {
  args: {
    icon: <ZapIcon />,
  },
  parameters: {
    docs: {
      source: {
        code: withIconSource,
      },
    },
  },
};

export const WithStateIcons: Story = {
  render: () => <RepositoryVisibilitySwitch />,
  parameters: {
    docs: {
      source: {
        code: withStateIconsSource,
      },
    },
  },
};

export const AllStates: Story = {
  parameters: {
    layout: 'centered',
  },
  render: () => (
    <div className="min-w-108 grid gap-4 rounded-lg bg-surface2 p-4">
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
          className="outline-1 outline-offset-2 outline-neutral5/55 outline-solid"
        />

        <span className="text-neutral5">Disabled</span>
        <Switch aria-label="disabled off" disabled />
        <Switch aria-label="disabled on" checked disabled onCheckedChange={() => {}} />
        <Switch
          aria-label="disabled focus preview"
          checked
          disabled
          onCheckedChange={() => {}}
          className="outline-1 outline-offset-2 outline-neutral5/35 outline-solid"
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
    <div className="flex w-dropdown-max-height flex-col gap-4">
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
    <div className="flex w-[350px] items-start justify-between gap-4">
      <div className="flex flex-col gap-1">
        <Label htmlFor="dark-mode">Dark mode</Label>
        <span className="text-xs text-neutral3">Switch to a darker color scheme</span>
      </div>
      <Switch id="dark-mode" />
    </div>
  ),
};

import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { CopyInput } from '../CopyInput';
import { AutosaveInput } from './autosave-input';
import { SettingsContainer, SettingsGroup, SettingsLayout, SettingsRow, SettingsTitle } from '@/ds/new/settings';

const meta: Meta<typeof AutosaveInput> = {
  title: 'Composite/AutosaveInput',
  component: AutosaveInput,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'A settings text field that saves itself. Leaving it or pressing Enter saves a changed value; Escape puts the saved one back. A spinner shows while it saves, then a check. A failed save or an invalid value shows an alert at the end of the field, and its tooltip says why.',
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof AutosaveInput>;

const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

function nameError(value: string) {
  return value.trim() ? undefined : "Name can't be empty.";
}

function avatarError(value: string) {
  if (!value) return undefined;
  return /^https:\/\/\S+$/.test(value) ? undefined : 'Use an https link to an image.';
}

function SavedField({
  label,
  initial,
  failWith,
  ...props
}: {
  label: string;
  initial: string;
  failWith?: string;
  placeholder?: string;
  validate?: (value: string) => string | undefined;
}) {
  const [value, setValue] = useState(initial);
  return (
    <AutosaveInput
      label={label}
      value={value}
      onSave={async next => {
        await wait(800);
        if (failWith) throw new Error(failWith);
        setValue(next);
      }}
      {...props}
    />
  );
}

/** On a settings page. Edit a field and press Enter or click away. */
export const Default: Story = {
  render: () => (
    <SettingsLayout title="General">
      <SettingsGroup>
        <SettingsTitle>Organization</SettingsTitle>
        <SettingsContainer>
          <SettingsRow label="Organization name" description="Shown across Mastra and in invitations.">
            <SavedField label="Organization name" initial="Acme" validate={nameError} />
          </SettingsRow>
          <SettingsRow label="Organization ID" description="Use it when you call the API or contact support.">
            <CopyInput value="org_01KJGEY548CS1D3VYS5YY27PGS" label="organization ID" />
          </SettingsRow>
          <SettingsRow label="Avatar" description="Shown next to the organization name.">
            <SavedField label="Avatar" initial="" placeholder="https://example.com/avatar.png" validate={avatarError} />
          </SettingsRow>
        </SettingsContainer>
      </SettingsGroup>
    </SettingsLayout>
  ),
};

/** Every save fails: the alert's tooltip shows the server's message and the draft stays. */
export const SaveFails: Story = {
  render: () => (
    <div className="w-55">
      <SavedField label="Organization name" initial="Acme" failWith="Couldn't save. Try again." />
    </div>
  ),
};

export const Disabled: Story = {
  render: () => (
    <div className="w-55">
      <AutosaveInput label="Organization name" value="Acme" onSave={async () => {}} disabled />
    </div>
  ),
};

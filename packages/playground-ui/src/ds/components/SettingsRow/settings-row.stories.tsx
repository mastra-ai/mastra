import type { Meta, StoryObj } from '@storybook/react-vite';
import { SettingsRow } from './settings-row';
import { Button } from '@/ds/components/Button';
import { SectionCard } from '@/ds/components/SectionCard';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/ds/components/Select';

const meta: Meta<typeof SettingsRow> = {
  title: 'Layout/SettingsRow',
  component: SettingsRow,
  parameters: {
    layout: 'padded',
  },
  decorators: [
    Story => (
      <div className="max-w-2xl">
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof SettingsRow>;

export const WithSelect: Story = {
  render: () => (
    <SectionCard title="Theme" description="Customize the appearance of the studio.">
      <SettingsRow label="Theme mode" htmlFor="theme">
        <Select defaultValue="dark">
          <SelectTrigger id="theme" className="w-full sm:w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="dark">Dark</SelectItem>
            <SelectItem value="light">Light</SelectItem>
            <SelectItem value="system">System</SelectItem>
          </SelectContent>
        </Select>
      </SettingsRow>
    </SectionCard>
  ),
};

export const WithDescription: Story = {
  render: () => (
    <SectionCard title="Appearance" description="Customize how the studio renders.">
      <SettingsRow
        label="Theme mode"
        description="Choose how the studio appears in different lighting."
        htmlFor="theme"
      >
        <Select defaultValue="dark">
          <SelectTrigger id="theme" className="w-full sm:w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="dark">Dark</SelectItem>
            <SelectItem value="light">Light</SelectItem>
            <SelectItem value="system">System</SelectItem>
          </SelectContent>
        </Select>
      </SettingsRow>
    </SectionCard>
  ),
};

export const ActionRow: Story = {
  render: () => (
    <SectionCard variant="danger" title="Danger zone" description="Irreversible actions for this project">
      <SettingsRow label="Delete project" description="Permanently delete this project and all its data.">
        <Button className="w-full sm:w-auto">Delete</Button>
      </SettingsRow>
    </SectionCard>
  ),
};

export const Stacked: Story = {
  render: () => (
    <SectionCard title="Preferences" description="Configure your studio experience.">
      <div className="flex flex-col gap-6">
        <SettingsRow label="Theme mode" description="Choose how the studio appears." htmlFor="theme">
          <Select defaultValue="dark">
            <SelectTrigger id="theme" className="w-full sm:w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="dark">Dark</SelectItem>
              <SelectItem value="light">Light</SelectItem>
              <SelectItem value="system">System</SelectItem>
            </SelectContent>
          </Select>
        </SettingsRow>
        <SettingsRow label="Density" description="Compact spacing reduces vertical padding." htmlFor="density">
          <Select defaultValue="comfortable">
            <SelectTrigger id="density" className="w-full sm:w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="comfortable">Comfortable</SelectItem>
              <SelectItem value="compact">Compact</SelectItem>
            </SelectContent>
          </Select>
        </SettingsRow>
      </div>
    </SectionCard>
  ),
};

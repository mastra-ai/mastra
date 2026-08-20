import type { Meta, StoryObj } from '@storybook/react-vite';
import { SettingsSectionAlt } from './SettingsSectionAlt';
import { Button } from '@/ds/components/Button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/ds/components/Select';
import { Switch } from '@/ds/components/Switch';

const meta: Meta<typeof SettingsSectionAlt> = {
  title: 'Layout/SettingsSectionAlt',
  component: SettingsSectionAlt,
  parameters: {
    layout: 'padded',
  },
  decorators: [
    Story => (
      <div className="mx-auto w-full max-w-2xl">
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof SettingsSectionAlt>;

export const StackedRows: Story = {
  render: () => (
    <SettingsSectionAlt title="Preferences" description="Configure your studio experience.">
      <SettingsSectionAlt.Row label="Theme mode" description="Choose how the studio appears." htmlFor="alt-theme">
        <Select defaultValue="dark">
          <SelectTrigger id="alt-theme" className="w-full sm:w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="dark">Dark</SelectItem>
            <SelectItem value="light">Light</SelectItem>
            <SelectItem value="system">System</SelectItem>
          </SelectContent>
        </Select>
      </SettingsSectionAlt.Row>
      <SettingsSectionAlt.Row
        label="Interface density"
        description="Compact spacing fits more information on screen."
        htmlFor="alt-density"
      >
        <Select defaultValue="comfortable">
          <SelectTrigger id="alt-density" className="w-full sm:w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="comfortable">Comfortable</SelectItem>
            <SelectItem value="compact">Compact</SelectItem>
          </SelectContent>
        </Select>
      </SettingsSectionAlt.Row>
      <SettingsSectionAlt.Row label="Sound effects" description="Play a sound when long-running tasks finish.">
        <Switch aria-label="Sound effects" />
      </SettingsSectionAlt.Row>
    </SettingsSectionAlt>
  ),
};

export const SelectiveDivider: Story = {
  render: () => (
    <SettingsSectionAlt title="Notifications" description="Choose which updates need your attention.">
      <SettingsSectionAlt.Row label="Run completed" description="Notify me when a long-running task finishes.">
        <Switch aria-label="Run completed" defaultChecked />
      </SettingsSectionAlt.Row>
      <SettingsSectionAlt.Row label="Weekly summary" description="Send a summary every Monday.">
        <Switch aria-label="Weekly summary" />
      </SettingsSectionAlt.Row>
      <SettingsSectionAlt.Divider />
      <SettingsSectionAlt.Row label="Product updates" description="Occasional news about new Studio features.">
        <Switch aria-label="Product updates" />
      </SettingsSectionAlt.Row>
    </SettingsSectionAlt>
  ),
};

export const BetweenSections: Story = {
  render: () => (
    <div>
      <SettingsSectionAlt>
        <SettingsSectionAlt.Row label="Theme mode" htmlFor="sections-theme">
          <Select defaultValue="dark">
            <SelectTrigger id="sections-theme" className="w-full sm:w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="dark">Dark</SelectItem>
              <SelectItem value="light">Light</SelectItem>
              <SelectItem value="system">System</SelectItem>
            </SelectContent>
          </Select>
        </SettingsSectionAlt.Row>
      </SettingsSectionAlt>
      <SettingsSectionAlt.Divider className="my-1" />
      <SettingsSectionAlt>
        <SettingsSectionAlt.Row label="Sound effects">
          <Switch aria-label="Sound effects" />
        </SettingsSectionAlt.Row>
      </SettingsSectionAlt>
    </div>
  ),
};

export const WithAction: Story = {
  render: () => (
    <SettingsSectionAlt
      title="API keys"
      description="Keys authenticate requests from your applications."
      action={<Button size="sm">Create key</Button>}
    >
      <SettingsSectionAlt.Row label="Production" description="Created two days ago">
        <Button size="sm" variant="ghost">
          Revoke
        </Button>
      </SettingsSectionAlt.Row>
      <SettingsSectionAlt.Row label="Development" description="Created three weeks ago">
        <Button size="sm" variant="ghost">
          Revoke
        </Button>
      </SettingsSectionAlt.Row>
    </SettingsSectionAlt>
  ),
};

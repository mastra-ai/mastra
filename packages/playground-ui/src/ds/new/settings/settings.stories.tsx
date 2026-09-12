import type { Meta, StoryObj } from '@storybook/react-vite';
import {
  SettingsContainer,
  SettingsDescription,
  SettingsGroup,
  SettingsHeader,
  SettingsLayout,
  SettingsRow,
  SettingsTitle,
} from './index';
import { Button } from '@/ds/components/Button';
import { Input } from '@/ds/components/Input';
import { Switch } from '@/ds/components/Switch';
import { ThemeProvider } from '@/ds/components/ThemeProvider';
import { ThemeToggle } from '@/ds/components/ThemeToggle';

const meta = {
  title: 'New/Settings',
  component: SettingsGroup,
  parameters: { layout: 'padded' },
  decorators: [
    Story => (
      <ThemeProvider defaultTheme="dark" storageKey="storybook-new-settings">
        <div className="mx-auto max-w-4xl">
          <Story />
        </div>
      </ThemeProvider>
    ),
  ],
} satisfies Meta<typeof SettingsGroup>;

export default meta;
type Story = StoryObj<typeof meta>;

export const General: Story = {
  render: () => (
    <SettingsGroup>
      <SettingsHeader>
        <SettingsTitle>General</SettingsTitle>
        <SettingsDescription>Stored in this browser.</SettingsDescription>
      </SettingsHeader>
      <SettingsContainer>
        <SettingsRow label="Theme" description="Color scheme for the interface">
          <ThemeToggle />
        </SettingsRow>
        <SettingsRow label="Notifications" description="Notify when a run finishes">
          <Switch aria-label="Notifications" defaultChecked />
        </SettingsRow>
      </SettingsContainer>
    </SettingsGroup>
  ),
};

export const Connection: Story = {
  render: () => (
    <SettingsLayout>
      <SettingsGroup>
        <SettingsHeader action={<Button>Save configuration</Button>}>
          <SettingsTitle>Mastra Connection</SettingsTitle>
          <SettingsDescription>Configure the connection used by Studio.</SettingsDescription>
        </SettingsHeader>
        <SettingsContainer>
          <SettingsRow label="Mastra instance URL" htmlFor="mastra-url">
            <Input id="mastra-url" defaultValue="http://localhost:4111" className="w-full lg:max-w-96" />
          </SettingsRow>
          <SettingsRow label="API prefix" htmlFor="api-prefix">
            <Input id="api-prefix" defaultValue="/api" className="w-full lg:max-w-96" />
          </SettingsRow>
        </SettingsContainer>
      </SettingsGroup>
    </SettingsLayout>
  ),
};

export const Permissions: Story = {
  render: () => (
    <SettingsGroup>
      <SettingsHeader>
        <SettingsTitle>Organization access</SettingsTitle>
        <SettingsDescription>Review inherited permissions and organization actions.</SettingsDescription>
      </SettingsHeader>
      <SettingsContainer>
        <SettingsRow label="Project access" description="Inherited from your organization role." viewOnly>
          Viewer
        </SettingsRow>
        <SettingsRow
          label="Leave organization"
          description="Remove your access to this organization."
          tone="destructive"
        >
          <Button variant="destructive-ghost">Leave</Button>
        </SettingsRow>
      </SettingsContainer>
    </SettingsGroup>
  ),
};

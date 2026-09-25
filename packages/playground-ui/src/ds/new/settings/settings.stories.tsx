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
import { Badge } from '@/ds/components/Badge';
import { Button } from '@/ds/components/Button';
import { fieldErrorId } from '@/ds/components/FormFieldBlocks/block/field-error-id';
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
    <SettingsGroup>
      <SettingsHeader action={<Button>Save configuration</Button>}>
        <SettingsTitle>Connection</SettingsTitle>
        <SettingsDescription>Configure the connection used by Studio.</SettingsDescription>
      </SettingsHeader>
      <SettingsContainer>
        <SettingsRow label="Mastra instance URL" htmlFor="mastra-url">
          <Input id="mastra-url" defaultValue="http://localhost:4111" className="w-full sm:max-w-96" />
        </SettingsRow>
        <SettingsRow label="API prefix" htmlFor="api-prefix">
          <Input id="api-prefix" defaultValue="/api" className="w-full sm:max-w-96" />
        </SettingsRow>
      </SettingsContainer>
    </SettingsGroup>
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

export const Validation: Story = {
  render: () => (
    <SettingsGroup>
      <SettingsHeader>
        <SettingsTitle>Agent</SettingsTitle>
      </SettingsHeader>
      <SettingsContainer>
        <SettingsRow label="Model" htmlFor="model" required errorMsg="Choose the model this agent runs on.">
          <Input
            id="model"
            className="w-56"
            placeholder="openai/gpt-5.2"
            error
            aria-describedby={fieldErrorId('model')}
          />
        </SettingsRow>
        <SettingsRow label="Max steps" htmlFor="max-steps" required>
          <Input id="max-steps" className="w-56" defaultValue="5" />
        </SettingsRow>
      </SettingsContainer>
    </SettingsGroup>
  ),
};

export const Page: Story = {
  parameters: { layout: 'fullscreen' },
  render: () => (
    <SettingsLayout
      title="Preferences"
      description="Manage your preferences and workspace defaults."
      action={<Button size="sm">Save changes</Button>}
    >
      <SettingsGroup>
        <SettingsHeader>
          <SettingsTitle>General</SettingsTitle>
          <SettingsDescription>Stored in this browser.</SettingsDescription>
        </SettingsHeader>
        <SettingsContainer>
          <SettingsRow label="Theme" description="Color scheme for the interface">
            <ThemeToggle />
          </SettingsRow>
          <SettingsRow label="Completion sound" description="Played when an agent run finishes in a workspace">
            <Switch aria-label="Play completion sound" defaultChecked />
          </SettingsRow>
        </SettingsContainer>
      </SettingsGroup>
      <SettingsGroup>
        <SettingsHeader>
          <SettingsTitle>Connection</SettingsTitle>
        </SettingsHeader>
        <SettingsContainer>
          <SettingsRow label="Mastra instance URL" htmlFor="page-mastra-url">
            <Input id="page-mastra-url" defaultValue="http://localhost:4111" className="w-full sm:max-w-96" />
          </SettingsRow>
        </SettingsContainer>
      </SettingsGroup>
    </SettingsLayout>
  ),
};

export const PageHeaderOnly: Story = {
  parameters: { layout: 'fullscreen' },
  render: () => (
    <SettingsLayout
      title="Deployment"
      titleAccessory={<Badge size="sm">Studio</Badge>}
      description="Jan 1, 2025 07:00:00 · abcdef1"
      variant="header"
    >
      <div className="mx-auto w-full max-w-5xl min-w-0 px-4 py-6">
        <SettingsGroup>
          <SettingsHeader>
            <SettingsTitle>Build</SettingsTitle>
          </SettingsHeader>
          <SettingsContainer>
            <SettingsRow label="Status">Ready</SettingsRow>
          </SettingsContainer>
        </SettingsGroup>
      </div>
    </SettingsLayout>
  ),
};

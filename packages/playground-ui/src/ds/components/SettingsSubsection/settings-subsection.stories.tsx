import type { Meta, StoryObj } from '@storybook/react-vite';
import { SettingsCard } from '../SettingsCard';
import { SettingsRow } from '../SettingsRow';
import { Switch } from '../Switch';
import { ThemeProvider } from '../ThemeProvider';
import { ThemeToggle } from '../ThemeToggle';
import { SettingsSubsection } from './settings-subsection';

const meta = {
  title: 'Layout/SettingsSubsection',
  component: SettingsSubsection,
  parameters: { layout: 'padded' },
  decorators: [
    Story => (
      <ThemeProvider storageKey="storybook-settings-subsection">
        <Story />
      </ThemeProvider>
    ),
  ],
  args: {
    title: 'General',
    description: 'Stored in this browser.',
  },
  render: args => (
    <div className="mx-auto max-w-4xl">
      <SettingsSubsection {...args}>
        <SettingsCard>
          <SettingsRow variant="factory" label="Theme" description="Color scheme for the interface">
            <ThemeToggle />
          </SettingsRow>
          <SettingsRow variant="factory" label="Notifications" description="Notify when a run finishes">
            <Switch aria-label="Notifications" defaultChecked />
          </SettingsRow>
        </SettingsCard>
      </SettingsSubsection>
    </div>
  ),
} satisfies Meta<typeof SettingsSubsection>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

import type { Meta, StoryObj } from '@storybook/react-vite';
import { SettingsContainer, SettingsItem, SettingsValue } from './index';
import { ThemeProvider } from '@/ds/components/ThemeProvider';

const meta = {
  title: 'New/SettingsValue',
  component: SettingsValue,
  parameters: { layout: 'padded' },
  decorators: [
    Story => (
      <ThemeProvider defaultTheme="dark" storageKey="storybook-new-settings-value">
        <div className="mx-auto max-w-160">
          <SettingsContainer>
            <Story />
          </SettingsContainer>
        </div>
      </ThemeProvider>
    ),
  ],
} satisfies Meta<typeof SettingsValue>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Values people read but don't change or copy. A long one truncates; hover it to see it in full. */
export const Default: Story = {
  render: () => (
    <>
      <SettingsItem title="Name" description="From your sign-in provider.">
        <SettingsValue>Ada Lovelace</SettingsValue>
      </SettingsItem>
      <SettingsItem title="Email" description="From your sign-in provider.">
        <SettingsValue>ada.lovelace@analytical-engines.example.com</SettingsValue>
      </SettingsItem>
      <SettingsItem title="Authentication" description="How you signed in.">
        <SettingsValue>Email and password</SettingsValue>
      </SettingsItem>
    </>
  ),
};

/** `mono` for machine identifiers: versions, branches, hashes. */
export const Mono: Story = {
  render: () => (
    <>
      <SettingsItem title="@mastra/core" description="Installed version.">
        <SettingsValue mono>1.32.0-alpha.4</SettingsValue>
      </SettingsItem>
      <SettingsItem title="Default branch">
        <SettingsValue mono>main</SettingsValue>
      </SettingsItem>
    </>
  ),
};

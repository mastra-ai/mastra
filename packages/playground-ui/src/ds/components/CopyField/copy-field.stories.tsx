import type { Meta, StoryObj } from '@storybook/react-vite';
import { Input } from '../Input';
import { ThemeProvider } from '../ThemeProvider';
import { TooltipProvider } from '../Tooltip';
import { CopyField } from './copy-field';
import { SettingsContainer, SettingsRow } from '@/ds/new/settings';

const meta: Meta<typeof CopyField> = {
  title: 'Composite/CopyField',
  component: CopyField,
  parameters: { layout: 'padded' },
  args: { label: 'organization ID', value: 'org_01KJGEY548CS1D3VYS5YY27PGS' },
  decorators: [
    Story => (
      <ThemeProvider defaultTheme="dark" storageKey="storybook-copy-field">
        <TooltipProvider>
          <Story />
        </TooltipProvider>
      </ThemeProvider>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof CopyField>;

/** On its own it fills its container, like an `Input`; a long value is cut in the middle. */
export const Default: Story = {
  render: args => (
    <div className="flex max-w-60 flex-col gap-3">
      <CopyField {...args} />
      <CopyField {...args} value="9141280b" label="project ID" />
    </div>
  ),
};

const rows = [
  { label: 'Name', value: <Input defaultValue="Acme" aria-label="Name" /> },
  { label: 'Account ID', value: <CopyField value="user_01KJGEXMA4MYC9B9M44JECM9AQ" label="account ID" /> },
  { label: 'Organization ID', value: <CopyField value="org_01KJGEY548CS1D3VYS5YY27PGS" label="organization ID" /> },
  { label: 'Project ID', value: <CopyField value="9141280b" label="project ID" /> },
  {
    label: 'Signing secret',
    value: <CopyField value="whsec_live_4f9b2c71e8a04d6f9a3b5c2e7d1f0a8b6c4e2d9f7a1b3c5e" label="signing secret" />,
  },
];

/**
 * In a `SettingsRow` it follows the row's field width: a short value hugs its text, a long one stops at the shared
 * width (the `Input` above it) and is cut in the middle.
 */
export const InSettingsRow: Story = {
  render: () => (
    <div className="mx-auto max-w-3xl">
      <SettingsContainer>
        {rows.map(row => (
          <SettingsRow key={row.label} label={row.label} description="Useful when contacting support.">
            {row.value}
          </SettingsRow>
        ))}
      </SettingsContainer>
    </div>
  ),
};

export const Disabled: Story = {
  args: { disabled: true },
  render: args => (
    <div className="max-w-60">
      <CopyField {...args} />
    </div>
  ),
};

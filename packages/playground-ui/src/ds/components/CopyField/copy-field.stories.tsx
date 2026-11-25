import type { Meta, StoryObj } from '@storybook/react-vite';
import { ThemeProvider } from '../ThemeProvider';
import { CopyField } from './copy-field';

const meta: Meta<typeof CopyField> = {
  title: 'Composite/CopyField',
  component: CopyField,
  parameters: { layout: 'padded' },
  decorators: [
    Story => (
      <ThemeProvider defaultTheme="dark" storageKey="storybook-copy-field">
        <Story />
      </ThemeProvider>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof CopyField>;

/** A long value is cut in the middle; a short one shows whole. */
export const Default: Story = {
  render: () => (
    <div className="flex max-w-55 flex-col gap-3">
      <CopyField value="org_01KJGEY548CS1D3VYS5YY27PGS" label="organization ID" />
      <CopyField value="9141280b" label="project ID" />
    </div>
  ),
};

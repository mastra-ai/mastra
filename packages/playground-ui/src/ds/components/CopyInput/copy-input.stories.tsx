import type { Meta, StoryObj } from '@storybook/react-vite';
import { CopyInput } from './copy-input';

const meta: Meta<typeof CopyInput> = {
  title: 'Composite/CopyInput',
  component: CopyInput,
  parameters: { layout: 'centered' },
};

export default meta;
type Story = StoryObj<typeof CopyInput>;

export const Default: Story = {
  render: () => (
    <div className="w-64">
      <CopyInput label="organization ID" value="org_01KJGEY548CS1D3VYS5YY27PGS" />
    </div>
  ),
};

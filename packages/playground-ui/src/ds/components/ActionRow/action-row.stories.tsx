import type { Meta, StoryObj } from '@storybook/react-vite';

import { Button } from '../Button';
import { Input } from '../Input';
import { ActionRow } from './index';

const meta: Meta<typeof ActionRow> = {
  title: 'Layout/ActionRow',
  component: ActionRow,
  parameters: { layout: 'padded' },
};

export default meta;
type Story = StoryObj<typeof ActionRow>;

export const StartOnly: Story = {
  render: () => (
    <ActionRow>
      <ActionRow.Start>
        <Input placeholder="Search…" className="max-w-120" />
      </ActionRow.Start>
    </ActionRow>
  ),
};

export const StartAndEnd: Story = {
  render: () => (
    <ActionRow>
      <ActionRow.Start>
        <Input placeholder="Search…" className="max-w-120" />
        <Button variant="outline">Status</Button>
        <Button variant="outline">Tags</Button>
      </ActionRow.Start>
      <ActionRow.End>
        <Button variant="outline">Columns</Button>
        <Button variant="primary">Run</Button>
      </ActionRow.End>
    </ActionRow>
  ),
};

export const EndOnly: Story = {
  render: () => (
    <ActionRow>
      <ActionRow.End>
        <Button variant="outline">Back</Button>
        <Button variant="primary">Open</Button>
      </ActionRow.End>
    </ActionRow>
  ),
};

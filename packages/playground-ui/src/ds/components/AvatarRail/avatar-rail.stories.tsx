import type { Meta, StoryObj } from '@storybook/react-vite';
import { PlusIcon } from 'lucide-react';
import { useState } from 'react';
import { expect, userEvent, within } from 'storybook/test';

import { Avatar } from '../Avatar/Avatar';
import { AvatarRail } from './index';

const meta = {
  title: 'Navigation/AvatarRail',
  component: AvatarRail,
  args: { 'aria-label': 'Organizations' },
  parameters: { layout: 'centered' },
} satisfies Meta<typeof AvatarRail>;

export default meta;
type Story = StoryObj<typeof meta>;

function OrganizationRailExample() {
  const [organization, setOrganization] = useState('mastra');
  return (
    <AvatarRail aria-label="Organizations">
      <AvatarRail.Item
        aria-label="Mastra"
        current={organization === 'mastra'}
        onClick={() => setOrganization('mastra')}
      >
        <Avatar name="Mastra" size="control" />
      </AvatarRail.Item>
      <AvatarRail.Item aria-label="Acme" current={organization === 'acme'} onClick={() => setOrganization('acme')}>
        <Avatar name="Acme" size="control" />
      </AvatarRail.Item>
      <AvatarRail.Item aria-label="Unavailable organization" disabled>
        <Avatar name="Unavailable" size="control" />
      </AvatarRail.Item>
      <AvatarRail.Item aria-label="Create an organization" variant="action">
        <PlusIcon />
      </AvatarRail.Item>
    </AvatarRail>
  );
}

export const Dark: Story = {
  render: () => <OrganizationRailExample />,
  globals: { theme: 'dark' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const mastra = canvas.getByRole('button', { name: 'Mastra' });
    mastra.focus();
    await userEvent.keyboard('{ArrowDown}');
    await expect(canvas.getByRole('button', { name: 'Acme' })).toHaveFocus();
    await expect(mastra).toHaveAttribute('aria-current', 'true');
    await userEvent.keyboard('{Enter}');
    await expect(canvas.getByRole('button', { name: 'Acme' })).toHaveAttribute('aria-current', 'true');
    await userEvent.keyboard('{ArrowDown}');
    await expect(canvas.getByRole('button', { name: 'Create an organization' })).toHaveFocus();
  },
};

export const Light: Story = {
  render: () => <OrganizationRailExample />,
  globals: { theme: 'light' },
};

export const ManyOrganizations: Story = {
  render: () => (
    <AvatarRail aria-label="Organizations" className="max-h-80">
      {Array.from({ length: 30 }, (_, index) => (
        <AvatarRail.Item key={index} aria-label={`Organization ${index + 1}`} current={index === 0}>
          <Avatar name={`Organization ${index + 1}`} size="control" />
        </AvatarRail.Item>
      ))}
    </AvatarRail>
  ),
};

export const Empty: Story = {
  render: () => (
    <AvatarRail aria-label="Organizations">
      <AvatarRail.Item aria-label="Create an organization" variant="action">
        <PlusIcon />
      </AvatarRail.Item>
    </AvatarRail>
  ),
};

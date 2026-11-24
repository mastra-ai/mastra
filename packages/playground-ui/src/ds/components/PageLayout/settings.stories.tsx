import type { Meta, StoryObj } from '@storybook/react-vite';
import type { ReactNode } from 'react';
import { expect, within } from 'storybook/test';

import { Badge } from '../Badge';
import { Breadcrumb, Crumb } from '../Breadcrumb';
import { Button } from '../Button';
import { EmptyState } from '../EmptyState';
import { Input } from '../Input';
import { Switch } from '../Switch';
import { PageLayout } from './index';
import type { PageLayoutSettingsProps } from './index';
import { MainCard } from '@/ds/new/layout/app-shell';
import { SettingsContainer, SettingsGroup, SettingsRow, SettingsTitle } from '@/ds/new/settings';

function StoryFrame({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-152 bg-sidebar p-2">
      <MainCard>{children}</MainCard>
    </div>
  );
}

const crumbs = (
  <Breadcrumb>
    <Crumb as="span">Settings</Crumb>
    <Crumb as="span" isCurrent>
      Organization
    </Crumb>
  </Breadcrumb>
);

const sections = (
  <>
    <SettingsGroup>
      <SettingsTitle>Organization</SettingsTitle>
      <SettingsContainer>
        <SettingsRow label="Organization name" description="Shown across Mastra and in invitations.">
          <Input defaultValue="Mastra" />
        </SettingsRow>
        <SettingsRow label="Require SSO" description="Members sign in with your identity provider.">
          <Switch aria-label="Require SSO" />
        </SettingsRow>
      </SettingsContainer>
    </SettingsGroup>
    <SettingsGroup>
      <SettingsTitle>Danger zone</SettingsTitle>
      <SettingsContainer>
        <SettingsRow label="Delete organization" description="Removes every project and member.">
          <Button size="sm">Delete</Button>
        </SettingsRow>
      </SettingsContainer>
    </SettingsGroup>
  </>
);

const meta = {
  title: 'Layout/PageLayout/Settings',
  component: PageLayout,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
    controls: {
      include: ['variant', 'breadcrumbs', 'headerActions', 'title', 'titleAccessory', 'action', 'header', 'children'],
    },
    docs: {
      description: {
        component: [
          'The frame for a settings page someone browses to and changes in place. It is `<PageLayout variant="settings">`: breadcrumbs and actions in the top bar, then a centered 640px column with the title above its `SettingsGroup`s.',
          'The title is inset to line up with the section titles, and sections sit 24px apart. Build the sections from the parts in New/Settings.',
          'Use `variant="form"` for a create or edit form, and `variant="page"` for every other page.',
        ].join('\n\n'),
      },
    },
  },
  decorators: [
    Story => (
      <StoryFrame>
        <Story />
      </StoryFrame>
    ),
  ],
  args: { variant: 'settings', breadcrumbs: crumbs, title: 'Organization', children: sections },
  argTypes: {
    variant: { control: false },
    title: { control: 'text' },
    breadcrumbs: { control: false },
    headerActions: { control: false },
    titleAccessory: { control: false },
    action: { control: false },
    header: { control: false },
    children: { control: false },
  },
} satisfies Meta<PageLayoutSettingsProps>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  parameters: {
    docs: {
      description: {
        story: 'Breadcrumbs in the top bar, the title, then the sections, all in one 640px column.',
      },
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const column = canvasElement.querySelector<HTMLElement>('[data-slot="settings-layout"]');
    if (!column) throw new Error('Missing the settings column');
    const title = canvas.getByRole('heading', { level: 1, name: 'Organization' });
    const firstSection = canvas.getByRole('heading', { level: 2, name: 'Organization' });

    await expect(column.getBoundingClientRect().width).toBeLessThanOrEqual(640);
    await expect(title.getBoundingClientRect().left).toBe(firstSection.getBoundingClientRect().left);
    await expect(canvas.getByRole('main').contains(canvas.getByText('Settings'))).toBe(false);
  },
};

export const WithTitleExtras: Story = {
  args: {
    title: 'Members',
    titleAccessory: <Badge size="sm">12 seats</Badge>,
    action: <Button size="sm">Invite</Button>,
    headerActions: <Button>Docs</Button>,
  },
  parameters: {
    docs: {
      description: {
        story:
          'A badge beside the title in `titleAccessory`, the page action at the end of the title row in `action`, and app-level actions in the top bar in `headerActions`.',
      },
    },
  },
};

export const Empty: Story = {
  args: {
    title: 'Webhooks',
    children: (
      <EmptyState
        variant="fill"
        titleSlot="No webhooks yet"
        descriptionSlot="Add a webhook to hear about runs as they finish."
      />
    ),
  },
  parameters: {
    docs: {
      description: {
        story: 'A fill `EmptyState` as the only content centers in the rest of the page.',
      },
    },
  },
};

import type { Meta, StoryObj } from '@storybook/react-vite';
import type { ReactNode } from 'react';
import { expect, within } from 'storybook/test';

import { Button } from '../Button/Button';
import { Input } from '../Input/input';
import { Switch } from '../Switch/switch';
import { FormLayout } from './index';
import { MainCard } from '@/ds/new/layout/app-shell/main-card';
import { SettingsContainer } from '@/ds/new/settings/settings-container';
import { SettingsGroup, SettingsTitle } from '@/ds/new/settings/settings-header';
import { SettingsRow } from '@/ds/new/settings/settings-row';
import { SettingsSkeleton } from '@/ds/new/settings/settings-skeleton';

const meta = {
  title: 'Layout/FormLayout',
  component: FormLayout,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component: [
          'The frame for any create or edit form page, such as New alert, New project or Edit destination. It is `PageLayout` with no breadcrumb bar, holding a centered 640px column (the `SettingsLayout` width) under a back link and the page title.',
          'The back link, the title, each `SettingsTitle` and the field labels share one left edge, and sections sit 28px apart. The back link is the only way out, so there is no breadcrumb to show the same thing twice. Pass the app router link as `LinkComponent`.',
          'Use `SettingsLayout` in a `PageLayout` with breadcrumbs for a settings page that someone browses to and changes in place. Use `PageLayout variant="narrow"` with a `PageHeader` for a one-column page to read, such as an overview, a feed or a detail page.',
        ].join('\n\n'),
      },
    },
  },
  args: {
    backHref: '#alerts',
    backLabel: 'Alerts',
    title: 'New alert',
    children: null,
  },
} satisfies Meta<typeof FormLayout>;

export default meta;
type Story = StoryObj<typeof meta>;

function StoryFrame({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-200 bg-sidebar p-2">
      <MainCard>{children}</MainCard>
    </div>
  );
}

function AlertSections() {
  return (
    <>
      <SettingsGroup>
        <SettingsTitle>Details</SettingsTitle>
        <SettingsContainer>
          <SettingsRow label="Name">
            <Input defaultValue="Deploy failed" />
          </SettingsRow>
          <SettingsRow label="Enabled">
            <Switch aria-label="Enabled" defaultChecked />
          </SettingsRow>
        </SettingsContainer>
      </SettingsGroup>
      <SettingsGroup>
        <SettingsTitle>Notify</SettingsTitle>
        <SettingsContainer>
          <SettingsRow label="Email">
            <Input defaultValue="oncall@mastra.ai" />
          </SettingsRow>
        </SettingsContainer>
      </SettingsGroup>
      <div className="flex items-center gap-2">
        <Button variant="primary">Create alert</Button>
        <Button variant="ghost">Cancel</Button>
      </div>
    </>
  );
}

/** A create form: a back link to where the user came from, the title, then the form's sections. */
export const Create: Story = {
  render: args => (
    <StoryFrame>
      <FormLayout {...args}>
        <AlertSections />
      </FormLayout>
    </StoryFrame>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const back = canvas.getByRole('link', { name: 'Back to Alerts' });
    const title = canvas.getByRole('heading', { level: 1, name: 'New alert' });
    const details = canvas.getByRole('heading', { level: 2, name: 'Details' });
    const notify = canvas.getByRole('heading', { level: 2, name: 'Notify' });
    const column = canvasElement.querySelector<HTMLElement>('[data-slot="form-layout"]');
    if (!column) throw new Error('Missing the form column');

    const main = canvas.getByRole('main');
    await expect(main.closest('[data-slot="page-layout"]')?.firstElementChild).toBe(main);
    await expect(column.getBoundingClientRect().width).toBeLessThanOrEqual(640);
    await expect(back.getBoundingClientRect().left).toBe(details.getBoundingClientRect().left);
    await expect(title.getBoundingClientRect().left).toBe(details.getBoundingClientRect().left);
    await expect(details.getBoundingClientRect().left).toBe(column.getBoundingClientRect().left);

    const firstSection = details.closest('section');
    const secondSection = notify.closest('section');
    if (!firstSection || !secondSection) throw new Error('Missing a section');
    await expect(secondSection.getBoundingClientRect().top - firstSection.getBoundingClientRect().bottom).toBe(28);
  },
};

/** An edit form while its record loads: the title holds its place and the sections show skeleton rows. */
export const Loading: Story = {
  args: { backHref: '#alerts/deploy-failed', backLabel: 'Deploy failed', title: 'Edit alert', isLoading: true },
  render: args => (
    <StoryFrame>
      <FormLayout {...args}>
        <SettingsGroup>
          <SettingsTitle>Details</SettingsTitle>
          <SettingsContainer>
            <SettingsSkeleton label="Loading alert" rows={2} />
          </SettingsContainer>
        </SettingsGroup>
      </FormLayout>
    </StoryFrame>
  ),
};

/** A long back label and title wrap inside the column instead of widening it. */
export const LongText: Story = {
  args: {
    backHref: '#destinations/ops',
    backLabel: 'Production on-call escalation channel for the platform infrastructure team',
    title: 'Edit destination for the production on-call escalation channel of the platform infrastructure team',
  },
  render: args => (
    <StoryFrame>
      <FormLayout {...args}>
        <AlertSections />
      </FormLayout>
    </StoryFrame>
  ),
};

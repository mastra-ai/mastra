import type { Meta, StoryObj } from '@storybook/react-vite';
import type { ReactNode } from 'react';
import { expect, within } from 'storybook/test';

import { Button } from '../Button/Button';
import { Input } from '../Input/input';
import { Kbd } from '../Kbd/kbd';
import { Switch } from '../Switch/switch';
import { Txt } from '../Txt/Txt';
import { PageLayout } from './index';
import type { PageLayoutFormProps } from './index';
import { MainCard } from '@/ds/new/layout/app-shell/main-card';
import { SettingsContainer } from '@/ds/new/settings/settings-container';
import { SettingsGroup, SettingsTitle } from '@/ds/new/settings/settings-header';
import { SettingsRow } from '@/ds/new/settings/settings-row';
import { SettingsSkeleton } from '@/ds/new/settings/settings-skeleton';

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

const meta = {
  title: 'Layout/PageLayout/Form',
  component: PageLayout,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
    controls: {
      include: ['variant', 'backHref', 'backLabel', 'title', 'isLoading', 'LinkComponent', 'aside', 'children'],
    },
    docs: {
      description: {
        component: [
          'The frame for any create or edit form page, such as New alert, New project or Edit destination. It is `<PageLayout variant="form">`: no breadcrumb bar, holding a centered 640px column (the settings width) under a back link and the page title.',
          'The back link, the title, each `SettingsTitle` and the field labels share one left edge, and sections sit 24px apart. The back link is the only way out, so there is no breadcrumb to show the same thing twice. Pass the app router link as `LinkComponent`.',
          'Use `variant="settings"` for a settings page that someone browses to and changes in place. Use `variant="page"` for every other page: lists, dashboards, detail pages and explorers.',
        ].join('\n\n'),
      },
    },
  },
  decorators: [
    (Story, { parameters }) =>
      parameters.frame === false ? (
        <Story />
      ) : (
        <StoryFrame>
          <Story />
        </StoryFrame>
      ),
  ],
  args: {
    variant: 'form',
    backHref: '#alerts',
    backLabel: 'Alerts',
    title: 'New alert',
    children: <AlertSections />,
  },
  argTypes: {
    variant: { control: false },
    title: { control: 'text' },
    aside: { control: false },
    children: { control: false },
    LinkComponent: { control: false },
  },
} satisfies Meta<PageLayoutFormProps>;

export default meta;
type Story = StoryObj<typeof meta>;

/** A create form: a back link to where the user came from, the title, then the form's sections. */
export const Create: Story = {
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
    await expect(secondSection.getBoundingClientRect().top - firstSection.getBoundingClientRect().bottom).toBe(24);
  },
};

/** An edit form while its record loads: the title holds its place and the sections show skeleton rows. */
export const Loading: Story = {
  args: {
    backHref: '#alerts/deploy-failed',
    backLabel: 'Deploy failed',
    title: 'Edit alert',
    isLoading: true,
    children: (
      <SettingsGroup>
        <SettingsTitle>Details</SettingsTitle>
        <SettingsContainer>
          <SettingsSkeleton label="Loading alert" rows={2} />
        </SettingsContainer>
      </SettingsGroup>
    ),
  },
};

/** A long back label and title wrap inside the column instead of widening it. */
export const LongText: Story = {
  args: {
    backHref: '#destinations/ops',
    backLabel: 'Production on-call escalation channel for the platform infrastructure team',
    title: 'Edit destination for the production on-call escalation channel of the platform infrastructure team',
  },
};

export const WithoutBackLink: Story = {
  args: { backHref: undefined, backLabel: undefined, title: 'New skill' },
  parameters: {
    docs: {
      description: {
        story:
          'The back link is optional. Leave out `backHref` and `backLabel` when the app navigation is the way out, such as a form reached from the sidebar.',
      },
    },
  },
};

export const WithAside: Story = {
  args: {
    aside: (
      <SettingsGroup>
        <SettingsTitle>Preview</SettingsTitle>
        <SettingsContainer>
          <SettingsRow label="Would have fired" description="Three times in the last 7 days.">
            <Button size="sm">Refresh</Button>
          </SettingsRow>
        </SettingsContainer>
      </SettingsGroup>
    ),
  },
  parameters: {
    docs: {
      description: {
        story:
          'A live preview in `aside` sits beside the form when the column is wide enough, and above the fields otherwise.',
      },
    },
  },
};

export const PhoneWidth: Story = {
  args: { backHref: '#factory', backLabel: 'Factory', title: 'New Factory' },
  parameters: {
    frame: false,
    docs: {
      description: {
        story: 'At phone width a row whose label must truncate keeps the form column inside the screen.',
      },
    },
  },
  render: args => (
    <div className="flex h-200 w-80 bg-sidebar p-2">
      <MainCard>
        <PageLayout {...args}>
          <div className="flex items-center gap-3">
            <Txt as="span" className="truncate">
              acme-platform/payments-billing-reliability-service-monorepo
            </Txt>
            <Kbd>Esc</Kbd>
          </div>
        </PageLayout>
      </MainCard>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const column = canvasElement.querySelector<HTMLElement>('[data-slot="form-layout"]');
    const content = canvasElement.querySelector<HTMLElement>('[data-slot="form-layout-content"]');
    const label = within(canvasElement).getByText(/acme-platform/);
    if (!column || !content) throw new Error('Missing the form column');

    const columnRight = column.getBoundingClientRect().right;
    await expect(content.getBoundingClientRect().right).toBeLessThanOrEqual(columnRight);
    await expect(label.getBoundingClientRect().right).toBeLessThanOrEqual(columnRight);
    await expect(label.scrollWidth).toBeGreaterThan(label.clientWidth);
  },
};

import type { Meta, StoryObj } from '@storybook/react-vite';
import type { ComponentProps, ReactNode } from 'react';
import { expect, within } from 'storybook/test';

import { ActionRow } from '../ActionRow';
import { Breadcrumb, Crumb } from '../Breadcrumb';
import { Button } from '../Button';
import { EmptyState } from '../EmptyState';
import { Input } from '../Input';
import { Txt } from '../Txt';
import { PageLayout } from './index';
import { IconArrowLeft } from '@/ds/icons/central/IconArrowLeft';
import { IconBox2 } from '@/ds/icons/central/IconBox2';
import { IconPlusMedium } from '@/ds/icons/central/IconPlusMedium';
import { MainCard } from '@/ds/new/layout/app-shell';
import { PageHeader } from '@/ds/new/layout/page-header';

const meta: Meta<typeof PageLayout> = {
  title: 'Layout/PageLayout',
  component: PageLayout,
  parameters: { layout: 'fullscreen' },
};

export default meta;
type Story = StoryObj<typeof PageLayout>;

function StoryFrame({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-152 bg-sidebar p-2">
      <MainCard>{children}</MainCard>
    </div>
  );
}

const resources = ['Research agent', 'Support workflow', 'Knowledge search tool'];

const crumbs = (
  <Breadcrumb>
    <Crumb as="span">Workspace</Crumb>
    <Crumb as="span" isCurrent>
      Resources
    </Crumb>
  </Breadcrumb>
);

const headerActions = <Button>Docs</Button>;

const pageHeader = (
  <PageHeader>
    <PageHeader.Icon>
      <IconBox2 />
    </PageHeader.Icon>
    <PageHeader.Title>Resources</PageHeader.Title>
    <PageHeader.Description>Agents, workflows and tools available in this workspace.</PageHeader.Description>
    <PageHeader.Action>
      <Button variant="primary">
        <IconPlusMedium />
        Create resource
      </Button>
    </PageHeader.Action>
  </PageHeader>
);

const resourceList = (
  <ul className="grid gap-2">
    {resources.map(resource => (
      <li key={resource} className="rounded border border-border px-3 py-2">
        {resource}
      </li>
    ))}
  </ul>
);

export const Container: Story = {
  render: () => (
    <StoryFrame>
      <PageLayout breadcrumbs={crumbs} headerActions={headerActions} header={pageHeader}>
        <div className="mt-6">{resourceList}</div>
      </PageLayout>
    </StoryFrame>
  ),
};

function ComparisonHeader({
  eyebrow,
  spacing,
}: {
  eyebrow?: ReactNode;
  spacing?: ComponentProps<typeof PageHeader>['spacing'];
}) {
  return (
    <PageHeader spacing={spacing}>
      {eyebrow}
      <PageHeader.Title>Resources</PageHeader.Title>
      <PageHeader.Description>Page details.</PageHeader.Description>
      <PageHeader.Action>
        <Button>Edit</Button>
      </PageHeader.Action>
    </PageHeader>
  );
}

const backLink = (
  <PageHeader.Eyebrow>
    <a href="#resources">
      <IconArrowLeft aria-hidden />
      Back to resources
    </a>
  </PageHeader.Eyebrow>
);

export const TopBarSpacingComparison: Story = {
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        story: [
          'The first three panels intentionally align their page titles: a real bar with default spacing, a bar-less header with `spacing="breathing"`, and the same opt-in header with an eyebrow inside its reserved 40px band.',
          'Choose breathing spacing only when a specific bar-less page should match the title position of related pages with a bar. The fourth panel shows an equally valid choice: no bar and unchanged default spacing. Missing a bar does not automatically mean a page needs more space.',
          'Keep default spacing when breadcrumbs or header actions render the PageLayout bar, in compact action rows, or when another layout already supplies the gap. Breathing spacing is an explicit PageHeader choice; PageLayout does not enable or suppress it.',
        ].join('\n\n'),
      },
    },
  },
  render: () => (
    <div className="grid grid-cols-4">
      <div>
        <Txt variant="caption" tone="muted">
          With top bar (default)
        </Txt>
        <StoryFrame>
          <PageLayout breadcrumbs={crumbs} headerActions={headerActions} header={<ComparisonHeader />}>
            <div className="mt-6">{resourceList}</div>
          </PageLayout>
        </StoryFrame>
      </div>
      <div>
        <Txt variant="caption" tone="muted">
          No bar + breathing spacing
        </Txt>
        <StoryFrame>
          <PageLayout header={<ComparisonHeader spacing="breathing" />}>
            <div className="mt-6">{resourceList}</div>
          </PageLayout>
        </StoryFrame>
      </div>
      <div>
        <Txt variant="caption" tone="muted">
          No bar + breathing spacing + Back link
        </Txt>
        <StoryFrame>
          <PageLayout header={<ComparisonHeader spacing="breathing" eyebrow={backLink} />}>
            <div className="mt-6">{resourceList}</div>
          </PageLayout>
        </StoryFrame>
      </div>
      <div>
        <Txt variant="caption" tone="muted">
          No bar (default unchanged)
        </Txt>
        <StoryFrame>
          <PageLayout header={<ComparisonHeader />}>
            <div className="mt-6">{resourceList}</div>
          </PageLayout>
        </StoryFrame>
      </div>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const layouts = canvasElement.querySelectorAll<HTMLElement>('[data-slot="page-layout"]');
    const offsets = Array.from(layouts, layout => {
      const title = layout.querySelector('[data-slot="page-header-title"]');
      if (!title) throw new Error('Missing page header title');
      const body = within(within(layout).getByRole('main')).getByRole('list');
      const top = layout.getBoundingClientRect().top;
      return {
        title: title.getBoundingClientRect().top - top,
        body: body.getBoundingClientRect().top - top,
      };
    });

    await expect(offsets.map(offset => offset.title)).toEqual([60, 60, 60, 20]);
    await expect(offsets.map(offset => offset.body)).toEqual([134, 134, 134, 94]);
  },
};

export const Workspace: Story = {
  render: () => (
    <StoryFrame>
      <PageLayout breadcrumbs={crumbs} headerActions={headerActions}>
        <PageLayout.Workspace>
          <div className="grid min-h-0 grid-cols-[minmax(0,1fr)_16rem]">
            <ul className="grid content-start gap-2 overflow-y-auto border-r border-border p-4">
              {Array.from({ length: 40 }, (_, index) => (
                <li key={index} className="rounded border border-border px-3 py-2">
                  Message {index + 1}
                </li>
              ))}
            </ul>
            <div className="p-4 text-placeholder">Side panel</div>
          </div>
        </PageLayout.Workspace>
      </PageLayout>
    </StoryFrame>
  ),
  play: async ({ canvasElement }) => {
    const list = within(canvasElement).getByText('Message 1').closest('ul');
    const body = list?.closest<HTMLElement>('[style*="overflow"]');
    await expect(list && list.scrollHeight > list.clientHeight).toBe(true);
    await expect(body && body.scrollHeight <= body.clientHeight).toBe(true);
  },
};

export const Grid: Story = {
  render: () => (
    <StoryFrame>
      <PageLayout breadcrumbs={crumbs} header={pageHeader}>
        <PageLayout.Grid>
          <section className="rounded-xl bg-card p-4 @4xl:col-span-8">Details</section>
          <aside className="rounded-xl bg-card p-4 @4xl:col-span-4">Properties</aside>
          <section className="rounded-xl bg-card p-4">Activity</section>
        </PageLayout.Grid>
      </PageLayout>
    </StoryFrame>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const details = canvas.getByText('Details').getBoundingClientRect();
    const properties = canvas.getByText('Properties').getBoundingClientRect();
    const activity = canvas.getByText('Activity').getBoundingClientRect();
    const gridWidth = canvas.getByText('Details').closest('[data-slot="page-layout-grid"]')?.clientWidth ?? 0;
    const sideBySide = gridWidth >= 896;

    await expect(sideBySide ? properties.top === details.top : properties.top > details.top).toBe(true);
    await expect(activity.width).toBeGreaterThanOrEqual(details.width);
  },
};

export const FullPage: Story = {
  render: () => (
    <StoryFrame>
      <PageLayout
        breadcrumbs={crumbs}
        headerActions={headerActions}
        actionRow={
          <ActionRow>
            <ActionRow.Start>
              <Input placeholder="Filter resources" className="max-w-120" />
            </ActionRow.Start>
            <ActionRow.End>
              <Button>Sort</Button>
            </ActionRow.End>
          </ActionRow>
        }
      >
        {resourceList}
      </PageLayout>
    </StoryFrame>
  ),
};

export const WithoutBreadcrumbsAndHeaderActions: Story = {
  render: () => (
    <StoryFrame>
      <PageLayout header={pageHeader}>
        <div className="mt-6">{resourceList}</div>
      </PageLayout>
    </StoryFrame>
  ),
};

export const Empty: Story = {
  render: () => (
    <StoryFrame>
      <PageLayout breadcrumbs={crumbs}>
        <div className="flex h-full items-center justify-center">
          <EmptyState titleSlot="No resources yet" descriptionSlot="Create a resource to get started." />
        </div>
      </PageLayout>
    </StoryFrame>
  ),
};

export const HeaderWithSectionsAndEmptyState: Story = {
  render: () => (
    <StoryFrame>
      <PageLayout breadcrumbs={crumbs} header={pageHeader}>
        <section className="mt-6">{resourceList}</section>
        <EmptyState
          variant="fill"
          titleSlot="No activity yet"
          descriptionSlot="Runs show up here once a resource is used."
        />
      </PageLayout>
    </StoryFrame>
  ),
  play: async ({ canvasElement }) => {
    const list = within(canvasElement).getByText('Research agent').closest('section');
    const fill = canvasElement.querySelector<HTMLElement>('[data-slot="empty-state-fill"]');
    const body = fill?.closest<HTMLElement>('[style*="overflow"]');
    if (!list || !fill || !body) throw new Error('Missing the page parts');
    await expect(fill.getBoundingClientRect().top).toBeCloseTo(list.getBoundingClientRect().bottom, 0);
    await expect(body.scrollHeight).toBeLessThanOrEqual(body.clientHeight);
  },
};

import type { Meta, StoryObj } from '@storybook/react-vite';
import { ArrowLeftIcon, BoxesIcon, PlusIcon } from 'lucide-react';
import type { ComponentProps, ReactNode } from 'react';
import { expect, within } from 'storybook/test';

import { ActionRow } from '../ActionRow';
import { Breadcrumb, Crumb } from '../Breadcrumb';
import { Button } from '../Button';
import { EmptyState } from '../EmptyState';
import { Input } from '../Input';
import { Txt } from '../Txt';
import { PageLayout } from './index';
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
      <BoxesIcon strokeWidth={2.5} />
    </PageHeader.Icon>
    <PageHeader.Title>Resources</PageHeader.Title>
    <PageHeader.Description>Agents, workflows and tools available in this workspace.</PageHeader.Description>
    <PageHeader.Action>
      <Button variant="primary">
        <PlusIcon />
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
      <ArrowLeftIcon aria-hidden />
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

export const Narrow: Story = {
  render: () => (
    <StoryFrame>
      <PageLayout variant="narrow" breadcrumbs={crumbs} headerActions={headerActions} header={pageHeader}>
        <div className="mt-6">{resourceList}</div>
      </PageLayout>
    </StoryFrame>
  ),
};

export const Fit: Story = {
  render: () => (
    <StoryFrame>
      <PageLayout variant="fit" breadcrumbs={crumbs} headerActions={headerActions} header={pageHeader}>
        <div className="mt-6 flex items-center justify-center border border-border text-placeholder">
          Full-height panel (graph, table…)
        </div>
      </PageLayout>
    </StoryFrame>
  ),
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
      <PageLayout variant="narrow" header={pageHeader}>
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

/** Compact application headers can keep primaryActions visible and tuck secondary headerActions into a menu. */
export const EssentialHeaderAction: Story = {
  render: () => (
    <StoryFrame>
      <PageLayout breadcrumbs={crumbs} headerActions={headerActions} primaryActions={<Button>Config</Button>}>
        <Txt>Essential actions stay available when the application switches to its compact header.</Txt>
      </PageLayout>
    </StoryFrame>
  ),
};
